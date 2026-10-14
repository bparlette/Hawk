"""46 CFR Part 541 rule engine (Demurrage and Detention Billing Requirements).

Text verified against eCFR, Title 46 up to date as of 10/05/2026. Part 541 applies to
invoices issued by ocean common carriers, marine terminal operators, and NVOCCs
(541.2(a)); effective May 28, 2024 (89 FR 14362; 89 FR 41895 for 541.6).

541.6 lists 20 minimum elements across five groups. 541.5: failure to include ANY
required element eliminates the billed party's obligation to pay the charge.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal
from typing import Callable, Optional

from .models import BillingPartyKind, Direction, Finding, Invoice

EFFECTIVE = date(2024, 5, 28)


@dataclass(frozen=True)
class Element:
    key: str
    citation: str
    label: str
    applies: Callable[[Invoice], bool] = lambda inv: True
    via_url_ok: bool = False      # only 541.6(d)(2) is by definition a link
    auto_threshold: float = 0.95  # min extraction confidence to auto-assert "missing"


IMPORT = lambda inv: inv.direction == Direction.IMPORT
EXPORT = lambda inv: inv.direction == Direction.EXPORT

ELEMENTS: list[Element] = [
    # (a) Identifying information
    Element("bl_numbers", "46 CFR 541.6(a)(1)", "Bill of lading number(s)"),
    Element("container_numbers", "46 CFR 541.6(a)(2)", "Container number(s)"),
    Element("port_of_discharge", "46 CFR 541.6(a)(3)", "Port(s) of discharge (imports)", IMPORT),
    Element("liability_basis", "46 CFR 541.6(a)(4)",
            "Basis for why the billed party is the proper party of interest", auto_threshold=0.9),
    # (b) Timing information
    Element("invoice_date", "46 CFR 541.6(b)(1)", "Invoice date"),
    Element("due_date", "46 CFR 541.6(b)(2)", "Invoice due date"),
    Element("free_days", "46 CFR 541.6(b)(3)", "Allowed free time in days"),
    Element("free_time_start", "46 CFR 541.6(b)(4)", "Start date of free time"),
    Element("free_time_end", "46 CFR 541.6(b)(5)", "End date of free time"),
    Element("availability_date", "46 CFR 541.6(b)(6)", "Container availability date (imports)", IMPORT),
    Element("earliest_return_date", "46 CFR 541.6(b)(7)", "Earliest return date (exports)", EXPORT),
    Element("charged_dates", "46 CFR 541.6(b)(8)", "Specific date(s) for which D&D were charged"),
    # (c) Rate information
    Element("total_amount", "46 CFR 541.6(c)(1)", "Total amount due"),
    Element("tariff_rule_ref", "46 CFR 541.6(c)(2)",
            "Applicable D&D rule (tariff rule, terminal schedule, or service contract section)",
            auto_threshold=0.9),
    Element("rates", "46 CFR 541.6(c)(3)", "Specific rate(s) per the tariff rule or service contract"),
    # (d) Dispute information
    Element("dispute_contact", "46 CFR 541.6(d)(1)",
            "Contact for questions or mitigation/refund/waiver requests", auto_threshold=0.9),
    Element("dispute_url_or_qr", "46 CFR 541.6(d)(2)",
            "URL/QR to a publicly accessible page describing required dispute documentation",
            via_url_ok=True, auto_threshold=0.9),
    Element("dispute_timeframes", "46 CFR 541.6(d)(3)",
            "Defined timeframes to request mitigation and to resolve requests", auto_threshold=0.9),
    # (e) Certifications
    Element("cert_fmc_compliance", "46 CFR 541.6(e)(1)",
            "Certification that charges are consistent with FMC D&D rules incl. 46 CFR 545.5",
            auto_threshold=0.9),
    Element("cert_no_fault", "46 CFR 541.6(e)(2)",
            "Certification that billing party's performance did not cause or contribute to the charges",
            auto_threshold=0.9),
]
assert len(ELEMENTS) == 20


@dataclass
class RuleContext:
    invoice_issue_date: date
    last_charge_date: date
    today: date
    url_check: Optional[Callable[[str], bool]] = None   # True if URL is public & describes docs
    correct_billed_party: Optional[bool] = None          # from party resolution; None = unknown
    original_invoice_to_wrong_party: bool = False         # this invoice is a 541.7(d) re-bill


def check_contents(inv: Invoice, ctx: RuleContext) -> list[Finding]:
    out: list[Finding] = []
    if ctx.invoice_issue_date < EFFECTIVE:
        return [Finding("C_PRE_EFFECTIVE", "CONTENT", "INFO", "89 FR 14362",
                        "Invoice predates 541.6 effective date (2024-05-28); content rules not applied.")]
    for el in ELEMENTS:
        if not el.applies(inv):
            continue
        fv = inv.f(el.key)
        missing = not fv.present or (fv.via_url and not el.via_url_ok)
        if el.key == "dispute_url_or_qr" and fv.present and ctx.url_check:
            if not ctx.url_check(str(fv.value)):
                missing = True
        if not missing:
            continue
        human = fv.confidence < el.auto_threshold
        out.append(Finding(
            rule_id=f"C_{el.key.upper()}", category="CONTENT", severity="VOIDS_INVOICE",
            citation=f"{el.citation}; 46 CFR 541.5",
            message=f"Invoice omits required element: {el.label}."
                    + (" (Provided only on a linked page.)" if fv.via_url and not el.via_url_ok else ""),
            amount_at_issue=inv.total, evidence=[f"invoice:{inv.invoice_no}" + (f"#p{fv.page}" if fv.page else "")],
            confidence=fv.confidence, needs_human=human))
    # 541.6(d)(3) substance: stated dispute window must allow >= 30 days (541.8(a))
    tf = inv.f("dispute_timeframes")
    if tf.present and isinstance(tf.value, dict):
        win = tf.value.get("request_days")
        if win is not None and int(win) < 30:
            out.append(Finding("C_WINDOW_TOO_SHORT", "CONTENT", "VOIDS_INVOICE",
                               "46 CFR 541.6(d)(3); 541.8(a); 541.5",
                               f"Stated dispute window is {win} days; rule requires at least 30 days "
                               f"from invoice issuance.", inv.total, evidence=[f"invoice:{inv.invoice_no}"]))
    return out


def check_timing(inv: Invoice, ctx: RuleContext) -> list[Finding]:
    out: list[Finding] = []
    issued = ctx.invoice_issue_date
    # Prefer the date the billed party actually received it if the stated date looks backdated
    if inv.first_received_at and (inv.first_received_at.date() - issued).days > 3:
        out.append(Finding("T_BACKDATED_INVOICE", "TIMING", "REVIEW", "46 CFR 541.7(a)",
                           f"Invoice dated {issued} but first received {inv.first_received_at.date()}.",
                           evidence=[f"invoice:{inv.invoice_no}"], needs_human=True))
    if inv.billing_party_kind == BillingPartyKind.NVOCC and inv.upstream_invoice_date:
        lag = (issued - inv.upstream_invoice_date).days
        if lag > 30:
            out.append(Finding("T_NVOCC_LATE", "TIMING", "VOIDS_INVOICE", "46 CFR 541.7(b)",
                               f"NVOCC invoice issued {lag} days after the upstream invoice "
                               f"({inv.upstream_invoice_date}); limit is 30.", inv.total))
    else:
        lag = (issued - ctx.last_charge_date).days
        if lag > 30:
            out.append(Finding("T_LATE_INVOICE", "TIMING", "VOIDS_INVOICE", "46 CFR 541.7(a)",
                               f"Charge last incurred {ctx.last_charge_date}; invoice issued {issued} "
                               f"({lag} days). Limit is 30 calendar days.", inv.total))
    if ctx.original_invoice_to_wrong_party and (issued - ctx.last_charge_date).days > 30:
        out.append(Finding("T_LATE_REBILL", "TIMING", "VOIDS_INVOICE", "46 CFR 541.7(d)",
                           "Corrected invoice to the proper party issued outside the 30-day window.",
                           inv.total))
    if ctx.correct_billed_party is False:
        out.append(Finding("P_WRONG_PARTY", "TIMING", "VOIDS_INVOICE", "46 CFR 541.6(a)(4); 541.7(d)",
                           "Billed party is not the proper party of interest.", inv.total, needs_human=True))
    return out


def check_math(inv: Invoice) -> list[Finding]:
    out: list[Finding] = []
    stated = inv.f("total_amount")
    if stated.present and stated.value is not None:
        diff = Decimal(str(stated.value)) - inv.total
        if abs(diff) > Decimal("1.00"):
            out.append(Finding("M_TOTAL_MISMATCH", "MATH", "REDUCES", "46 CFR 541.6(c)(1) accuracy",
                               f"Stated total {stated.value} differs from sum of lines {inv.total}.",
                               max(diff, Decimal("0"))))
    for line in inv.lines:
        computed = sum((line.rate_by_date.get(d, Decimal("0")) for d in line.charged_dates), Decimal("0"))
        if abs(computed - line.amount) > Decimal("1.00"):
            out.append(Finding("M_LINE_MISMATCH", "MATH", "REDUCES", "46 CFR 541.6(c)(3) accuracy",
                               f"{line.container_no}: days x rates = {computed}, invoiced {line.amount}.",
                               max(line.amount - computed, Decimal("0")), line.container_no))
    return out


def dispute_deadline(inv: Invoice, ctx: RuleContext) -> date:
    """541.8(a): at least 30 days from issuance; honor a longer stated window."""
    days = 30
    tf = inv.f("dispute_timeframes")
    if tf.present and isinstance(tf.value, dict) and tf.value.get("request_days"):
        days = max(30, int(tf.value["request_days"]))
    return ctx.invoice_issue_date + timedelta(days=days)


def run_all(inv: Invoice, ctx: RuleContext) -> list[Finding]:
    return check_contents(inv, ctx) + check_timing(inv, ctx) + check_math(inv)


def invoice_void(findings: list[Finding]) -> bool:
    return any(f.severity == "VOIDS_INVOICE" for f in findings)
