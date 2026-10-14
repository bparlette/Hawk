from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest

from demurrageshield.edi import EDIError, check_digit_ok, parse_interchange
from demurrageshield.lockout import (AppointmentDay, FreeTimeTerms, LockoutInputs, Reason,
                                     TerminalCalendar, compute)
from demurrageshield.models import (BillingPartyKind, ContainerEvent, Direction, EventType as E,
                                    Invoice, InvoiceField, InvoiceLine)
from demurrageshield.packet import ClaimInput, Party, build_packet, disputed_amount, fmc_eligibility
from demurrageshield.rules import ELEMENTS, RuleContext, dispute_deadline, invoice_void, run_all
from demurrageshield.timeline import build_timeline

NY = ZoneInfo("America/New_York")
CNTR = "MSKU7731044"


def isa(icn="000000101", d="260710", t="0930"):
    s = (f"ISA*00*          *00*          *02*MAEU           *ZZ*DEMSHIELD      *{d}*{t}*U*00401*{icn}*0*P*>~")
    assert len(s) == 106, len(s)
    return s


def env(sets: list[list[str]], code="QO") -> str:
    out = [isa(), f"GS*{code}*MAEU*DEMSHIELD*20260710*0930*101*X*004010"]
    for i, segs in enumerate(sets, 1):
        st = sets[i - 1][0].split("*")[0]
        body = [f"ST*{st}*{i:04d}"] + segs[1:] + [f"SE*{len(segs) + 1}*{i:04d}"]
        out += body
    out += ["GE*%d*101" % len(sets), "IEA*1*000000101"]
    return "~".join(out) + "~"


def t315(code, d, t, eq="L"):
    return ["315", f"B4***{code}*{d}*{t}**MSKU*7731044*{eq}*45G1*USBAL*UN*4",
            "N9*BM*MAEU244118812", "Q2*9876543*US***ABC*****MAERSK BALTIMORE",
            "R4*D*UN*USBAL*SEAGIRT MARINE TERMINAL"]


def t322(code, d, t, tc="LT"):
    return ["322", "ZC1*MAEU*101*Q*", "N7*MSKU*7731044*****CN****L",
            f"Q5*{code}*{d}*{t}*{tc}***USBAL", "N9*BM*MAEU244118812"]


RAW = env([
    t315("UV", "20260624", "0800"),
    t315("AV", "20260625", "0600"),
    t322("OA", "20260706", "1412"),
    t315("RD", "20260709", "1030", eq="E"),
])


def events():
    return parse_interchange(RAW)


# ------------------------------------------------------------------ EDI

def test_parse_events_and_timezones():
    evs = events()
    assert [e.type for e in evs] == [E.DISCHARGED, E.AVAILABLE, E.GATE_OUT_FULL, E.GATE_IN_EMPTY]
    assert evs[0].occurred_at == datetime(2026, 6, 24, 8, 0, tzinfo=NY)
    assert evs[0].bl_numbers == ("MAEU244118812",)
    assert all(e.container_no == CNTR for e in evs)
    assert evs[2].source == "EDI_322"


def test_se_count_mismatch_rejected():
    bad = RAW.replace("SE*6*0001", "SE*9*0001")
    with pytest.raises(EDIError):
        parse_interchange(bad)


def test_unknown_location_raises():
    with pytest.raises(EDIError):
        parse_interchange(RAW.replace("USBAL*UN*4", "XXZZZ*UN*4", 1))


def test_iso6346():
    assert check_digit_ok("CSQU3054383") and check_digit_ok(CNTR)
    assert not check_digit_ok("MSKU7731042")


# ------------------------------------------------------------------ timeline

def test_timeline_clean():
    tl = build_timeline(CNTR, Direction.IMPORT, events())
    assert tl.at(E.GATE_OUT_FULL).day == 6
    assert not [f for f in tl.findings if f.severity == "REVIEW"]


def test_timeline_flags_out_of_order_and_conflict():
    evs = events() + [
        ContainerEvent(CNTR, E.GATE_OUT_FULL, datetime(2026, 7, 7, 9, 0, tzinfo=NY), "CARRIER_PORTAL", "OA"),
        ContainerEvent(CNTR, E.AVAILABLE, datetime(2026, 7, 10, 9, 0, tzinfo=NY), "TERMINAL_PORTAL", "AV"),
    ]
    tl = build_timeline(CNTR, Direction.IMPORT, evs)
    ids = {f.rule_id for f in tl.findings}
    assert "T_SOURCE_CONFLICT" in ids          # gate-out 7/6 (322) vs 7/7 (portal)
    assert "T_NEGATIVE_INTERVAL" in ids        # terminal says available after gate-out


# ------------------------------------------------------------------ rules

def full_fields(**over):
    base = {e.key: InvoiceField(True, "x", 1, 0.99) for e in ELEMENTS}
    base["total_amount"] = InvoiceField(True, "1500.00", 1, 0.99)
    base["dispute_timeframes"] = InvoiceField(True, {"request_days": 30, "resolve_days": 30}, 2, 0.99)
    base.update(over)
    return base


DATES = [date(2026, 6, 27 + i) if 27 + i <= 30 else date(2026, 7, 27 + i - 30) for i in range(10)]


def make_invoice(fields=None, issued=date(2026, 8, 14)):
    line = InvoiceLine(CNTR, "DEMURRAGE", DATES, {d: Decimal("150") for d in DATES}, Decimal("1500"))
    return Invoice("DD-7754120", "Maersk A/S", BillingPartyKind.VOCC, "MAEU", "Acme Imports LLC",
                   Direction.IMPORT, fields or full_fields(), [line]), issued


def test_twenty_elements_and_void():
    assert len(ELEMENTS) == 20
    inv, issued = make_invoice(full_fields(availability_date=InvoiceField(False, confidence=0.98)),
                               issued=date(2026, 7, 20))
    fs = run_all(inv, RuleContext(issued, date(2026, 7, 6), date(2026, 7, 21)))
    assert [f.rule_id for f in fs] == ["C_AVAILABILITY_DATE"]
    assert invoice_void(fs)


def test_export_elements_not_required_on_import():
    inv, issued = make_invoice(full_fields(earliest_return_date=InvoiceField(False)), issued=date(2026, 7, 20))
    assert run_all(inv, RuleContext(issued, date(2026, 7, 6), date(2026, 7, 21))) == []


def test_late_invoice_and_short_window():
    f = full_fields(dispute_timeframes=InvoiceField(True, {"request_days": 15}, 2, 0.99))
    inv, issued = make_invoice(f)
    ids = {x.rule_id for x in run_all(inv, RuleContext(issued, date(2026, 7, 6), date(2026, 8, 20)))}
    assert {"T_LATE_INVOICE", "C_WINDOW_TOO_SHORT"} <= ids


def test_link_only_element_counts_missing_except_dispute_url():
    f = full_fields(rates=InvoiceField(True, "see portal", None, 0.99, via_url=True),
                    dispute_url_or_qr=InvoiceField(True, "https://x", None, 0.99, via_url=True))
    inv, issued = make_invoice(f, issued=date(2026, 7, 20))
    ids = [x.rule_id for x in run_all(inv, RuleContext(issued, date(2026, 7, 6), date(2026, 7, 21)))]
    assert ids == ["C_RATES"]


def test_low_confidence_goes_to_human():
    inv, issued = make_invoice(full_fields(liability_basis=InvoiceField(False, confidence=0.6)),
                               issued=date(2026, 7, 20))
    fs = run_all(inv, RuleContext(issued, date(2026, 7, 6), date(2026, 7, 21)))
    assert fs[0].needs_human


def test_deadline():
    inv, issued = make_invoice()
    assert dispute_deadline(inv, RuleContext(issued, date(2026, 7, 6), issued)) == date(2026, 9, 13)


# ------------------------------------------------------------------ lockout

def lockout_inputs():
    tl = build_timeline(CNTR, Direction.IMPORT, events())
    inv, _ = make_invoice()
    appts = {
        (date(2026, 6, 29), "PICKUP"): AppointmentDay(date(2026, 6, 29), "PICKUP", 0, 2, 2,
                                                      evidence=["snap_0629.png", "attempt_log#14"]),
        (date(2026, 6, 30), "PICKUP"): AppointmentDay(date(2026, 6, 30), "PICKUP", 0, 1, 1, refused_at_gate=True,
                                                      evidence=["snap_0630.png", "gps_T114_0630.geojson"]),
        (date(2026, 7, 3), "PICKUP"): AppointmentDay(date(2026, 7, 3), "PICKUP", 6, 0, 0),
    }
    return LockoutInputs(tl, inv.lines[0],
                         FreeTimeTerms(4, tiers=[(1, Decimal("150"))], source="SC 24-1187 Sec. 9"),
                         NY, TerminalCalendar({date(2026, 6, 28): "Terminal closed Sunday (notice 6/26)"}),
                         appts)


def test_lockout_days():
    r = compute(lockout_inputs())
    by = {d.day: d.reason for d in r.days}
    assert by[date(2026, 6, 27)] == Reason.WITHIN_FREE_TIME
    assert by[date(2026, 6, 28)] == Reason.TERMINAL_CLOSED
    assert by[date(2026, 6, 29)] == Reason.NO_PICKUP_APPOINTMENTS
    assert by[date(2026, 6, 30)] == Reason.NO_PICKUP_APPOINTMENTS
    assert by[date(2026, 7, 1)] == Reason.WITHIN_FREE_TIME
    assert by[date(2026, 7, 2)] == Reason.WITHIN_FREE_TIME
    assert all(by[date(2026, 7, d)] == Reason.VALID for d in (3, 4, 5, 6))
    assert r.free_time_end == date(2026, 7, 2)
    assert r.invalid_amount == Decimal("900")
    strong = {d.day: d.strength for d in r.days}
    assert strong[date(2026, 6, 29)] == "STRONG"


def test_rate_above_contract():
    inp = lockout_inputs()
    inp.terms.tiers = [(1, Decimal("125"))]
    r = compute(inp)
    assert {d.reason for d in r.days if d.day >= date(2026, 7, 3)} == {Reason.RATE_ABOVE_CONTRACT}
    assert r.invalid_amount == Decimal("900") + 4 * Decimal("25")


def test_carrier_hold_stops_clock():
    inp = lockout_inputs()
    from demurrageshield.timeline import Interval
    inp.timeline.holds.append(Interval(datetime(2026, 7, 3, 0, 1, tzinfo=NY), datetime(2026, 7, 3, 23, 0, tzinfo=NY),
                                       "LINE", "EDI"))
    r = compute(inp)
    assert {d.day: d.reason for d in r.days}[date(2026, 7, 3)] == Reason.CARRIER_OR_TERMINAL_HOLD


# ------------------------------------------------------------------ packet

def test_packet(tmp_path: Path):
    inv, issued = make_invoice(full_fields(availability_date=InvoiceField(False, confidence=0.98)))
    ctx = RuleContext(issued, date(2026, 7, 6), date(2026, 8, 20))
    fs = run_all(inv, ctx)
    lr = compute(lockout_inputs())
    ex = tmp_path / "invoice_DD-7754120.pdf"
    ex.write_bytes(b"%PDF-1.4 fake")
    c = ClaimInput("DWC-2026-000418", inv, issued, ["MAEU244118812"], "USBAL (Seagirt)",
                   Party("Acme Imports LLC", "100 Pier Rd, Baltimore, MD 21224", "Jane Doe",
                         "dnd@acme.example", "+1-410-555-0100"),
                   "usdisputes@maersk.example", fs, [lr], dispute_deadline(inv, ctx),
                   exhibits=[("Carrier invoice", ex)], paid=True)
    inv.paid_amount, inv.paid_on = Decimal("1500"), date(2026, 8, 25)
    assert fmc_eligibility(c) == []
    assert disputed_amount(c) == Decimal("1500")          # void => whole invoice
    m = build_packet(c, tmp_path / "pkt")
    assert m["fmc_submit_to"] == "chargecomplaints@fmc.gov"
    fmc = (tmp_path / "pkt" / "02_fmc_charge_complaint.md").read_text()
    assert "41310" in fmc and "541.6(b)(6)" in fmc and "545.5" in fmc and "Signature" in fmc
    carrier = (tmp_path / "pkt" / "01_carrier_dispute.md").read_text()
    assert "541.8(a)" in carrier and "$1,500.00" in carrier
    assert (tmp_path / "pkt" / "03_day_schedule.csv").read_text().count("\n") == 11


def test_mto_not_fmc_eligible(tmp_path: Path):
    inv, issued = make_invoice()
    inv.billing_party_kind = BillingPartyKind.MTO
    c = ClaimInput("X", inv, issued, ["B"], "USBAL", Party("A", "a", "b", "c", "d"), "e", [], [], issued)
    assert fmc_eligibility(c)
