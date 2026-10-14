"""Chargeable-day engine: recomputes what the billed party actually owes and classifies
every invoiced day as VALID or INVALID with a reason and evidence.

Legal hooks
- 46 CFR 545.5 (interpretive rule, incentive principle): D&D is reasonable only when it
  can incentivize cargo / equipment movement. Days the billed party could not act
  (terminal closed, no pickup or return appointments, carrier/terminal holds, container
  not yet available, empty return refused) are the classic unreasonable days.
- 46 U.S.C. 41310(b)(2): in a Charge Complaint the carrier bears the burden of proving
  reasonableness, but we still build the record (portal snapshots, denied attempts, GPS).
- Free-time terms come from the service contract first, then the tariff; both are
  inputs here, never assumed.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from decimal import Decimal
from enum import Enum
from typing import Iterable, Optional
from zoneinfo import ZoneInfo

from .models import Direction, EventType as E, Finding, InvoiceLine
from .timeline import Timeline


class Reason(str, Enum):
    VALID = "VALID"
    WITHIN_FREE_TIME = "WITHIN_FREE_TIME"
    BEFORE_AVAILABILITY = "BEFORE_AVAILABILITY"
    AFTER_CLOCK_END = "AFTER_CLOCK_END"
    TERMINAL_CLOSED = "TERMINAL_CLOSED"
    NO_PICKUP_APPOINTMENTS = "NO_PICKUP_APPOINTMENTS"
    NO_RETURN_APPOINTMENTS = "NO_RETURN_APPOINTMENTS"
    EMPTY_RETURN_REFUSED = "EMPTY_RETURN_REFUSED"
    CARRIER_OR_TERMINAL_HOLD = "CARRIER_OR_TERMINAL_HOLD"
    GOVERNMENT_HOLD_REVIEW = "GOVERNMENT_HOLD_REVIEW"
    BEFORE_EARLIEST_RETURN = "BEFORE_EARLIEST_RETURN"
    DUPLICATE_DAY = "DUPLICATE_DAY"
    RATE_ABOVE_CONTRACT = "RATE_ABOVE_CONTRACT"


INVALID_HARD = {Reason.WITHIN_FREE_TIME, Reason.BEFORE_AVAILABILITY, Reason.AFTER_CLOCK_END,
                Reason.DUPLICATE_DAY, Reason.BEFORE_EARLIEST_RETURN}        # contract / math errors
INVALID_545 = {Reason.TERMINAL_CLOSED, Reason.NO_PICKUP_APPOINTMENTS, Reason.NO_RETURN_APPOINTMENTS,
               Reason.EMPTY_RETURN_REFUSED, Reason.CARRIER_OR_TERMINAL_HOLD}  # reasonableness, human-reviewed


@dataclass
class FreeTimeTerms:
    free_days: int
    calendar: str = "CALENDAR"            # CALENDAR | WORKING (excludes Sat/Sun + holidays)
    holidays: frozenset[date] = frozenset()
    start_offset_days: int = 1            # free time starts the day AFTER availability (common tariff wording)
    stopped_days_extend_free_time: bool = True
    tiers: list[tuple[int, Decimal]] = field(default_factory=list)  # [(from_chargeable_day_n, rate)], 1-based
    source: str = ""                      # "SC 24-1187 Amdt 3, Sec. 9" or "MAEU Tariff Rule 22"

    def rate_for(self, n: int) -> Optional[Decimal]:
        r = None
        for start, rate in sorted(self.tiers):
            if n >= start:
                r = rate
        return r

    def counts(self, d: date) -> bool:
        if self.calendar == "WORKING":
            return d.weekday() < 5 and d not in self.holidays
        return True


@dataclass
class AppointmentDay:
    """One local date at one facility. Built from portal snapshots + our attempt log."""
    day: date
    kind: str                       # "PICKUP" | "EMPTY_RETURN"
    slots_offered: Optional[int]    # from portal snapshot; None = no snapshot
    attempts: int = 0
    attempts_denied: int = 0
    return_location_designated: bool = True
    refused_at_gate: bool = False   # GPS dwell >= threshold w/o gate transaction, or trouble ticket
    evidence: list[str] = field(default_factory=list)


@dataclass
class TerminalCalendar:
    closed: dict[date, str] = field(default_factory=dict)   # date -> reason ("ILA strike", "Hurricane", "Sunday")


@dataclass
class DayResult:
    day: date
    reason: Reason
    invoiced_amount: Decimal
    allowed_amount: Decimal
    evidence: list[str]
    strength: str = "N/A"          # STRONG | MODERATE | WEAK


def _daterange(a: date, b: date) -> Iterable[date]:
    d = a
    while d <= b:
        yield d
        d += timedelta(days=1)


def _local(dt: datetime, tz: ZoneInfo) -> date:
    return dt.astimezone(tz).date()


def lockout_strength(a: Optional[AppointmentDay]) -> tuple[bool, str]:
    """Is the day a lockout, and how strong is the record?
    STRONG: snapshot shows 0 slots AND we attempted (or GPS refusal).
    MODERATE: every attempt denied but no snapshot; or snapshot 0 slots without attempt.
    WEAK/none: no attempt and no snapshot -> not claimed."""
    if a is None:
        return False, "NONE"
    if a.kind == "EMPTY_RETURN" and not a.return_location_designated:
        return True, "STRONG"
    zero = a.slots_offered == 0
    tried_and_denied = a.attempts > 0 and a.attempts_denied == a.attempts
    if (zero and (a.attempts > 0 or a.refused_at_gate)) or (a.refused_at_gate and tried_and_denied):
        return True, "STRONG"
    if zero or tried_and_denied or a.refused_at_gate:
        return True, "MODERATE"
    return False, "WEAK"


@dataclass
class LockoutInputs:
    timeline: Timeline
    line: InvoiceLine
    terms: FreeTimeTerms
    port_tz: ZoneInfo
    calendar: TerminalCalendar = field(default_factory=TerminalCalendar)
    appointments: dict[tuple[date, str], AppointmentDay] = field(default_factory=dict)
    customer_caused_hold_types: frozenset[str] = frozenset({"CUSTOMS", "USDA", "FREIGHT"})
    earliest_return: Optional[date] = None
    already_billed_days: frozenset[date] = frozenset()


@dataclass
class LockoutResult:
    container_no: str
    charge_type: str
    clock_start: Optional[date]
    free_time_end: Optional[date]
    clock_end: Optional[date]
    days: list[DayResult]
    findings: list[Finding]

    @property
    def invalid_amount(self) -> Decimal:
        return sum((d.invoiced_amount - d.allowed_amount for d in self.days), Decimal("0"))

    @property
    def invalid_days(self) -> list[DayResult]:
        return [d for d in self.days if d.reason != Reason.VALID]


def compute(inp: LockoutInputs) -> LockoutResult:
    tl, line, terms, tz = inp.timeline, inp.line, inp.terms, inp.port_tz
    ct = line.charge_type
    is_import = tl.direction == Direction.IMPORT
    appt_kind = "PICKUP" if ct == "DEMURRAGE" else "EMPTY_RETURN"

    # ---- clock window per charge type
    if is_import and ct in ("DEMURRAGE", "COMBINED"):
        avail = tl.at(E.AVAILABLE) or tl.at(E.DISCHARGED)
        start_evt = avail
        end_evt = tl.at(E.GATE_OUT_FULL) if ct == "DEMURRAGE" else tl.at(E.GATE_IN_EMPTY)
    elif is_import and ct in ("DETENTION", "PER_DIEM"):
        start_evt = tl.at(E.GATE_OUT_FULL)
        end_evt = tl.at(E.GATE_IN_EMPTY)
    elif not is_import and ct in ("DETENTION", "PER_DIEM"):
        start_evt = tl.at(E.EMPTY_DISPATCHED)
        end_evt = tl.at(E.GATE_IN_FULL)
    else:  # export demurrage
        gi = tl.at(E.GATE_IN_FULL)
        start_evt = gi
        end_evt = tl.at(E.LOADED)

    findings: list[Finding] = []
    if start_evt is None:
        findings.append(Finding("L_NO_CLOCK_START", "LOCKOUT", "REVIEW", "46 CFR 541.6(b)(4),(6)",
                                f"{line.container_no}: no event establishes when the {ct} clock starts.",
                                container_no=line.container_no, needs_human=True))
        return LockoutResult(line.container_no, ct, None, None, None, [], findings)

    start_day = _local(start_evt, tz)
    if not is_import and ct == "DEMURRAGE" and inp.earliest_return:
        start_day = max(start_day, inp.earliest_return)
    end_day = _local(end_evt, tz) if end_evt else max(line.charged_dates)

    # ---- hold intervals by local date
    hold_days: dict[date, str] = {}
    for h in tl.holds:
        hs = _local(h.start, tz)
        he = _local(h.end, tz) if h.end else end_day
        for d in _daterange(hs, he):
            hold_days.setdefault(d, h.kind)

    # ---- walk the calendar from first possible day; build allowed chargeable set
    first = start_day + timedelta(days=terms.start_offset_days)
    free_used = 0
    chargeable_n = 0
    classification: dict[date, tuple[Reason, list[str], str, Optional[Decimal]]] = {}
    free_end: Optional[date] = None
    horizon = max(end_day, max(line.charged_dates))
    for d in _daterange(first, horizon):
        if d > end_day:
            classification[d] = (Reason.AFTER_CLOCK_END, [f"clock ended {end_day}"], "STRONG", None)
            continue
        stop: Optional[tuple[Reason, list[str], str]] = None
        if d in inp.calendar.closed:
            stop = (Reason.TERMINAL_CLOSED, [f"terminal closed: {inp.calendar.closed[d]}"], "STRONG")
        elif d in hold_days and hold_days[d] not in inp.customer_caused_hold_types:
            stop = (Reason.CARRIER_OR_TERMINAL_HOLD, [f"{hold_days[d]} hold"], "STRONG")
        else:
            appt = inp.appointments.get((d, appt_kind))
            locked, strength = lockout_strength(appt)
            if locked:
                r = Reason.NO_PICKUP_APPOINTMENTS if appt_kind == "PICKUP" else (
                    Reason.EMPTY_RETURN_REFUSED if (appt.refused_at_gate or not appt.return_location_designated)
                    else Reason.NO_RETURN_APPOINTMENTS)
                stop = (r, list(appt.evidence), strength)
        gov_hold = d in hold_days and hold_days[d] in inp.customer_caused_hold_types

        if stop:
            classification[d] = (*stop, None)
            if not terms.stopped_days_extend_free_time and terms.counts(d) and free_used < terms.free_days:
                free_used += 1
            continue
        if free_used < terms.free_days:
            if terms.counts(d):
                free_used += 1
                if free_used == terms.free_days:
                    free_end = d
            classification[d] = (Reason.WITHIN_FREE_TIME, [f"free day {free_used}/{terms.free_days}"], "STRONG", None)
            continue
        chargeable_n += 1
        rate = terms.rate_for(chargeable_n)
        if gov_hold:
            classification[d] = (Reason.GOVERNMENT_HOLD_REVIEW, [f"{hold_days[d]} hold (billed-party side)"],
                                 "WEAK", rate)
        else:
            classification[d] = (Reason.VALID, [], "N/A", rate)

    # ---- compare each invoiced day
    results: list[DayResult] = []
    for d in sorted(line.charged_dates):
        inv_amt = line.rate_by_date.get(d, Decimal("0"))
        if d in inp.already_billed_days:
            results.append(DayResult(d, Reason.DUPLICATE_DAY, inv_amt, Decimal("0"), ["billed on prior invoice"], "STRONG"))
            continue
        if d < first:
            results.append(DayResult(d, Reason.BEFORE_AVAILABILITY, inv_amt, Decimal("0"),
                                     [f"clock starts {first}"], "STRONG"))
            continue
        reason, ev, strength, rate = classification.get(d, (Reason.AFTER_CLOCK_END, [], "STRONG", None))
        if reason in (Reason.VALID, Reason.GOVERNMENT_HOLD_REVIEW):
            allowed = min(inv_amt, rate) if rate is not None else inv_amt
            r = reason
            if rate is not None and inv_amt > rate:
                r, ev = Reason.RATE_ABOVE_CONTRACT, ev + [f"contract rate {rate} ({terms.source})"]
            results.append(DayResult(d, r, inv_amt, allowed, ev, strength if r != Reason.RATE_ABOVE_CONTRACT else "STRONG"))
        else:
            results.append(DayResult(d, reason, inv_amt, Decimal("0"), ev, strength))

    # ---- findings
    for dr in results:
        if dr.reason == Reason.VALID or dr.reason == Reason.GOVERNMENT_HOLD_REVIEW:
            if dr.reason == Reason.GOVERNMENT_HOLD_REVIEW:
                findings.append(Finding("L_GOV_HOLD", "LOCKOUT", "REVIEW", "46 CFR 545.5",
                                        f"{line.container_no} {dr.day}: charged during government/freight hold; "
                                        f"reasonableness depends on facts.", Decimal("0"), line.container_no,
                                        dr.evidence, needs_human=True))
            continue
        hard = dr.reason in INVALID_HARD or dr.reason == Reason.RATE_ABOVE_CONTRACT
        findings.append(Finding(
            rule_id=f"L_{dr.reason.value}", category="LOCKOUT", severity="REDUCES",
            citation=("Service contract / tariff free-time terms; 46 CFR 541.6 accuracy" if hard
                      else "46 CFR 545.5 (incentive principle); 46 U.S.C. 41310(b)(2)"),
            message=f"{line.container_no} {dr.day}: {dr.reason.value.replace('_', ' ').lower()}",
            amount_at_issue=dr.invoiced_amount - dr.allowed_amount, container_no=line.container_no,
            evidence=dr.evidence, confidence=1.0 if hard else {"STRONG": 0.9, "MODERATE": 0.7}.get(dr.strength, 0.4),
            needs_human=not hard))

    # Accuracy cross-check of invoice-stated free-time end (541.6(b)(5))
    return LockoutResult(line.container_no, ct, start_day, free_end, end_day, results, findings)
