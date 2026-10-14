"""Dispute packet generator.

Produces, per claim, a directory with:
  01_carrier_dispute.md / .html   46 CFR 541.8 request for waiver/refund, to the contact on the invoice
  02_fmc_charge_complaint.md/.html  46 U.S.C. 41310 Charge Complaint, for email to chargecomplaints@fmc.gov
  03_day_schedule.csv             every invoiced day: reason, invoiced, allowed, evidence
  exhibits/                       invoice, B/L, EDI extracts, portal snapshots, GPS maps (copied in)
  manifest.json                   SHA-256 of every file, rule-pack version, deadlines, amounts

FMC submission facts (fmc.gov "Guidance on Charge Complaint Interim Procedure"):
  - Submit by email to chargecomplaints@fmc.gov.
  - Include: identification of the common carrier; a statement of how the charge
    violated 46 U.S.C. 41104(a) or 41102; supporting documents (invoices, bills of
    lading, proof of payment; screenshots of denied appointments, gate closures, emails).
  - Not covered: charges assessed by an MTO (unless on behalf of a common carrier),
    charges not yet invoiced, charges invoiced before June 16, 2022, cargo loading or
    discharging at non-U.S. ports.
  - The common carrier bears the burden of proving D&D reasonableness (41310(b)(2)).
The complainant (the customer) signs and sends. DemurrageShield prepares; it does not
appear before the Commission on anyone's behalf.
"""
from __future__ import annotations

import csv
import hashlib
import html
import json
import shutil
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from pathlib import Path
from typing import Optional

from .lockout import LockoutResult
from .models import BillingPartyKind, Finding, Invoice

FMC_EMAIL = "chargecomplaints@fmc.gov"
OSRA_EFFECTIVE = date(2022, 6, 16)
RULEPACK = "fmc-541@2024-05-28+545.5+41310"


@dataclass
class Party:
    name: str
    address: str
    contact_name: str
    email: str
    phone: str
    role: str = "Consignee"           # Shipper | Consignee | Trucker | NVOCC


@dataclass
class ClaimInput:
    claim_ref: str
    invoice: Invoice
    invoice_issue_date: date
    bl_numbers: list[str]
    port_of_discharge: str
    complainant: Party
    carrier_contact_email: str
    findings: list[Finding]
    lockouts: list[LockoutResult]
    dispute_deadline: date
    exhibits: list[tuple[str, Path]] = field(default_factory=list)   # (label, path)
    carrier_response: Optional[str] = None     # summary of carrier's denial, if any
    carrier_request_date: Optional[date] = None
    paid: bool = False
    us_port: bool = True
    assessed_on_behalf_of_carrier: bool = False


def _money(x: Decimal) -> str:
    return f"${x:,.2f}"


def _void_findings(fs: list[Finding]) -> list[Finding]:
    return [f for f in fs if f.severity == "VOIDS_INVOICE"]


def disputed_amount(c: ClaimInput) -> Decimal:
    if _void_findings(c.findings):
        return c.invoice.total
    return min(c.invoice.total, sum((l.invalid_amount for l in c.lockouts), Decimal("0"))
               + sum((f.amount_at_issue for f in c.findings if f.category == "MATH"), Decimal("0")))


def fmc_eligibility(c: ClaimInput) -> list[str]:
    """Reasons a 41310 Charge Complaint is NOT available. Empty list = eligible."""
    blockers = []
    if c.invoice.billing_party_kind == BillingPartyKind.MTO and not c.assessed_on_behalf_of_carrier:
        blockers.append("Charge assessed by a marine terminal operator, not a common carrier.")
    if c.invoice_issue_date < OSRA_EFFECTIVE:
        blockers.append("Charge invoiced before June 16, 2022.")
    if not c.us_port:
        blockers.append("Cargo loaded/discharged at a non-U.S. port.")
    if not c.bl_numbers:
        blockers.append("41310(a) requires bill of lading numbers.")
    return blockers


# --------------------------------------------------------------------------- letters

def carrier_dispute_md(c: ClaimInput) -> str:
    inv = c.invoice
    voids = _void_findings(c.findings)
    amt = disputed_amount(c)
    ask = "refund" if c.paid else "waiver"
    lines = [
        f"**To:** {inv.billing_party_name} — {c.carrier_contact_email}",
        f"**From:** {c.complainant.name}, {c.complainant.contact_name} ({c.complainant.email}, {c.complainant.phone})",
        f"**Date:** {date.today().isoformat()}",
        f"**Reference:** {c.claim_ref}",
        "",
        f"## Request for {ask} of demurrage/detention charges — Invoice {inv.invoice_no}",
        "",
        f"Bill(s) of lading: {', '.join(c.bl_numbers)}  ",
        f"Container(s): {', '.join(sorted({l.container_no for l in inv.lines}))}  ",
        f"Port of discharge: {c.port_of_discharge}  ",
        f"Invoice date: {c.invoice_issue_date.isoformat()}  ",
        f"Invoiced: {_money(inv.total)}  |  **Amount disputed: {_money(amt)}**",
        "",
        f"Pursuant to 46 CFR 541.8(a), {c.complainant.name} requests {ask} of {_money(amt)} on the grounds below. "
        f"This request is made within the period allowed by 46 CFR 541.8(a) (deadline {c.dispute_deadline.isoformat()}). "
        f"Under 46 CFR 541.8(b), please attempt to resolve this request within 30 calendar days of receipt.",
        "",
    ]
    n = 1
    if voids:
        lines += ["### Grounds that eliminate the obligation to pay", ""]
        for f in voids:
            lines.append(f"{n}. {f.message} ({f.citation})")
            n += 1
        lines += ["", "Under 46 CFR 541.5, failure to include any required minimum information eliminates any "
                  "obligation of the billed party to pay the applicable charge. Under 46 CFR 541.7, an invoice "
                  "not issued within the required period is not payable.", ""]
    day_findings = [f for f in c.findings if f.category in ("LOCKOUT", "MATH")]
    for lr in c.lockouts:
        day_findings += lr.findings
    claimed = [f for f in day_findings if f.severity == "REDUCES" and f.amount_at_issue > 0]
    if claimed:
        lines += [("### Additional and alternative grounds" if voids else "### Grounds"), "",
                  "| Container | Date | Issue | Amount | Basis |", "|---|---|---|---|---|"]
        for f in sorted(claimed, key=lambda f: (f.container_no or "", f.message)):
            d = f.message.split(": ")[0].split(" ")[-1] if ":" in f.message else ""
            issue = f.message.split(": ", 1)[-1]
            lines.append(f"| {f.container_no or ''} | {d} | {issue} | {_money(f.amount_at_issue)} | {f.citation} |")
        lines.append("")
        if any("545.5" in f.citation for f in claimed):
            lines += ["Charges for days on which the cargo or equipment could not be moved do not serve the "
                      "incentive principle described in 46 CFR 545.5 and are unreasonable. Supporting records "
                      "(terminal notices, appointment-system snapshots, denied attempts, and truck GPS logs) are "
                      "attached.", ""]
    lines += ["### Exhibits", ""]
    for i, (label, p) in enumerate(c.exhibits, 1):
        lines.append(f"- Exhibit {i}: {label} ({p.name})")
    lines += ["", "Please confirm receipt and provide a written decision. "
              f"{c.complainant.name} reserves all rights, including submission of a Charge Complaint to the "
              "Federal Maritime Commission under 46 U.S.C. 41310.", "",
              f"{c.complainant.contact_name}  ", f"{c.complainant.name}  ", c.complainant.address]
    return "\n".join(lines)


def fmc_charge_complaint_md(c: ClaimInput) -> str:
    blockers = fmc_eligibility(c)
    if blockers:
        raise ValueError("Charge Complaint not available: " + " ".join(blockers))
    inv = c.invoice
    amt = disputed_amount(c)
    voids = _void_findings(c.findings)
    reasonableness = [f for lr in c.lockouts for f in lr.findings if "545.5" in f.citation and f.amount_at_issue > 0]
    hard = [f for lr in c.lockouts for f in lr.findings if "545.5" not in f.citation and f.amount_at_issue > 0]
    out = [
        f"**To:** {FMC_EMAIL}",
        f"**Subject:** Charge Complaint under 46 U.S.C. 41310 — {inv.billing_party_name} — B/L {', '.join(c.bl_numbers)} — Invoice {inv.invoice_no}",
        "",
        "## Charge Complaint (46 U.S.C. 41310)",
        "",
        "### 1. Complainant",
        f"{c.complainant.name} ({c.complainant.role})  ",
        f"{c.complainant.address}  ",
        f"Contact: {c.complainant.contact_name}, {c.complainant.email}, {c.complainant.phone}",
        "",
        "### 2. Common carrier",
        f"{inv.billing_party_name} ({inv.billing_party_kind.value}"
        + (f", SCAC {inv.billing_party_scac}" if inv.billing_party_scac else "") + ")",
        "",
        "### 3. Charges complained of",
        "",
        "| Invoice | Invoice date | Bill(s) of lading | Container(s) | Invoiced | Disputed | Paid |",
        "|---|---|---|---|---|---|---|",
        f"| {inv.invoice_no} | {c.invoice_issue_date.isoformat()} | {', '.join(c.bl_numbers)} | "
        f"{', '.join(sorted({l.container_no for l in inv.lines}))} | {_money(inv.total)} | {_money(amt)} | "
        f"{_money(inv.paid_amount) + (' on ' + inv.paid_on.isoformat() if inv.paid_on else '') if c.paid else 'No'} |",
        "",
        "### 4. How the charges violate 46 U.S.C. 41102 and/or 41104(a)",
        "",
    ]
    n = 1
    if voids:
        out.append(f"{n}. **Noncompliant invoice (46 CFR Part 541).** The invoice fails the Commission's billing "
                   "requirements as follows:")
        for f in voids:
            out.append(f"   - {f.message} ({f.citation})")
        out.append("   Under 46 CFR 541.5 and 541.7, the billed party has no obligation to pay these charges. "
                   "Demanding and collecting them is alleged to be an unjust and unreasonable practice under "
                   "46 U.S.C. 41102(c) and contrary to 46 U.S.C. 41104(a).")
        n += 1
    if reasonableness:
        tot = sum((f.amount_at_issue for f in reasonableness), Decimal("0"))
        out.append(f"{n}. **Unreasonable demurrage/detention (46 CFR 545.5).** {_money(tot)} was charged for days "
                   "on which the cargo or equipment could not be moved:")
        for f in reasonableness:
            out.append(f"   - {f.message} — {_money(f.amount_at_issue)}")
        out.append("   These charges cannot serve the incentive principle and are alleged to be unjust and "
                   "unreasonable under 46 U.S.C. 41102(c). Under 46 U.S.C. 41310(b)(2) the carrier bears the "
                   "burden of establishing their reasonableness.")
        n += 1
    if hard:
        tot = sum((f.amount_at_issue for f in hard), Decimal("0"))
        out.append(f"{n}. **Charges outside the applicable free-time terms.** {_money(tot)} was charged for days "
                   "within free time, outside the clock, duplicated, or above the contract rate:")
        for f in hard:
            out.append(f"   - {f.message} — {_money(f.amount_at_issue)}")
        n += 1
    if c.carrier_request_date:
        out += ["", f"### 5. Prior request to the carrier",
                f"A request under 46 CFR 541.8 was sent on {c.carrier_request_date.isoformat()}. "
                + (f"Carrier response: {c.carrier_response}" if c.carrier_response else
                   "No resolution was provided within 30 days (46 CFR 541.8(b)).")]
    out += ["", "### 6. Relief requested",
            f"{'Refund' if c.paid else 'Waiver'} of {_money(amt)}, and such further action as the Commission "
            "finds appropriate under 46 U.S.C. 41310(c)-(d).",
            "", "### 7. Supporting documentation", ""]
    for i, (label, p) in enumerate(c.exhibits, 1):
        out.append(f"- Exhibit {i}: {label} ({p.name})")
    out += ["", "### 8. Certification",
            f"I am authorized to submit this complaint on behalf of {c.complainant.name}. To the best of my "
            "knowledge, the information and attached documents are true and complete.", "",
            "Signature: ______________________   Date: ____________", "",
            f"{c.complainant.contact_name}, {c.complainant.name}"]
    return "\n".join(out)


# --------------------------------------------------------------------------- rendering

def md_to_html(md: str, title: str) -> str:
    """Small, dependency-free renderer for the subset we emit (headings, bold, lists, tables)."""
    import re
    def inline(s: str) -> str:
        s = html.escape(s)
        return re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    body, in_ul, in_ol, table = [], False, False, []
    def flush_table():
        nonlocal table
        if not table:
            return
        rows = [r.strip().strip("|").split("|") for r in table if not set(r.replace("|", "").strip()) <= {"-", " "}]
        h = "".join(f"<th>{inline(x.strip())}</th>" for x in rows[0])
        b = "".join("<tr>" + "".join(f"<td>{inline(x.strip())}</td>" for x in r) + "</tr>" for r in rows[1:])
        body.append(f"<table><thead><tr>{h}</tr></thead><tbody>{b}</tbody></table>")
        table = []
    for raw in md.split("\n"):
        line = raw.rstrip()
        if line.startswith("|"):
            table.append(line); continue
        flush_table()
        if in_ul and not line.lstrip().startswith("- "):
            body.append("</ul>"); in_ul = False
        if in_ol and not re.match(r"^\d+\. |^   ", line):
            body.append("</ol>"); in_ol = False
        if line.startswith("### "):
            body.append(f"<h3>{inline(line[4:])}</h3>")
        elif line.startswith("## "):
            body.append(f"<h2>{inline(line[3:])}</h2>")
        elif line.lstrip().startswith("- "):
            if not in_ul:
                body.append("<ul>"); in_ul = True
            body.append(f"<li>{inline(line.lstrip()[2:])}</li>")
        elif re.match(r"^\d+\. ", line):
            if not in_ol:
                body.append("<ol>"); in_ol = True
            body.append(f"<li>{inline(line.split('. ', 1)[1])}</li>")
        elif line.startswith("   ") and in_ol:
            body.append(f"<p class='sub'>{inline(line.strip())}</p>")
        elif line:
            body.append(f"<p>{inline(line.rstrip(' '))}</p>")
    flush_table()
    if in_ul: body.append("</ul>")
    if in_ol: body.append("</ol>")
    css = ("body{font:11pt/1.45 Georgia,serif;max-width:7.5in;margin:.6in auto;color:#111}"
           "h2{font-size:15pt;border-bottom:1px solid #999}h3{font-size:12pt;margin-top:1.2em}"
           "table{border-collapse:collapse;width:100%;font-size:9.5pt}td,th{border:1px solid #bbb;padding:3px 6px;"
           "text-align:left;vertical-align:top}.sub{margin:.2em 0 .2em 2em}")
    return f"<!doctype html><html><head><meta charset='utf-8'><title>{html.escape(title)}</title><style>{css}</style></head><body>{''.join(body)}</body></html>"


def _sha(p: Path) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


def build_packet(c: ClaimInput, out_dir: Path, include_fmc: bool = True) -> dict:
    out_dir.mkdir(parents=True, exist_ok=True)
    ex_dir = out_dir / "exhibits"
    ex_dir.mkdir(exist_ok=True)
    copied: list[tuple[str, Path]] = []
    for i, (label, p) in enumerate(c.exhibits, 1):
        dst = ex_dir / f"{i:02d}_{p.name}"
        shutil.copyfile(p, dst)
        copied.append((label, dst))
    c.exhibits = copied

    files: dict[str, Path] = {}
    md = carrier_dispute_md(c)
    files["carrier_md"] = out_dir / "01_carrier_dispute.md"
    files["carrier_md"].write_text(md)
    files["carrier_html"] = out_dir / "01_carrier_dispute.html"
    files["carrier_html"].write_text(md_to_html(md, f"Dispute {c.invoice.invoice_no}"))

    blockers = fmc_eligibility(c)
    if include_fmc and not blockers:
        fmd = fmc_charge_complaint_md(c)
        files["fmc_md"] = out_dir / "02_fmc_charge_complaint.md"
        files["fmc_md"].write_text(fmd)
        files["fmc_html"] = out_dir / "02_fmc_charge_complaint.html"
        files["fmc_html"].write_text(md_to_html(fmd, f"Charge Complaint {c.invoice.invoice_no}"))

    files["schedule"] = out_dir / "03_day_schedule.csv"
    with open(files["schedule"], "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["container", "charge_type", "date", "reason", "invoiced", "allowed", "invalid", "strength", "evidence"])
        for lr in c.lockouts:
            for d in lr.days:
                w.writerow([lr.container_no, lr.charge_type, d.day.isoformat(), d.reason.value,
                            f"{d.invoiced_amount:.2f}", f"{d.allowed_amount:.2f}",
                            f"{d.invoiced_amount - d.allowed_amount:.2f}", d.strength, "; ".join(d.evidence)])

    manifest = {
        "claim_ref": c.claim_ref,
        "rulepack": RULEPACK,
        "invoice_no": c.invoice.invoice_no,
        "billing_party": c.invoice.billing_party_name,
        "invoiced": str(c.invoice.total),
        "disputed": str(disputed_amount(c)),
        "dispute_deadline": c.dispute_deadline.isoformat(),
        "fmc_eligible": not blockers,
        "fmc_blockers": blockers,
        "fmc_submit_to": FMC_EMAIL if not blockers else None,
        "needs_human_review": any(f.needs_human for f in c.findings)
                              or any(f.needs_human for lr in c.lockouts for f in lr.findings),
        "files": {k: {"path": str(p.relative_to(out_dir)), "sha256": _sha(p)} for k, p in files.items()},
        "exhibits": [{"label": l, "path": str(p.relative_to(out_dir)), "sha256": _sha(p)} for l, p in copied],
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2))
    return manifest
