# DemurrageShield core engine (v0.1)

Pure-Python, zero runtime dependencies. `pytest -q` runs 17 tests.

| Module | What it does |
|---|---|
| `edi.py` | X12 315 / 322 parser. Delimiters read from ISA; SE count validated; per-partner status-code maps; port-local timezones (unknown port = hard error); ISO 6346 check digit. |
| `timeline.py` | Resolves each milestone across sources by precedence, replays through import/export state machines, flags out-of-order, negative intervals, missing milestones, source conflicts > 4 h, late-reported and future events; builds hold intervals. |
| `rules.py` | All 20 minimum elements of 46 CFR 541.6 (a)-(e), 541.5 void logic, 541.7(a)/(b)/(d) 30-day issuance, 541.8(a) dispute deadline, stated-window check, math checks. Low-confidence "missing" goes to a human. |
| `lockout.py` | Recomputes free time and chargeable days from the contract terms; classifies every invoiced day (free time, before availability, after clock end, terminal closed, no pickup/return appointments, refused at gate, carrier hold, duplicate, rate above contract) with evidence strength. |
| `packet.py` | Carrier dispute request (541.8), FMC Charge Complaint (41310) for chargecomplaints@fmc.gov with eligibility gate, per-day CSV, exhibits, SHA-256 manifest. Markdown + HTML. |

`python examples_demo.py` writes a full sample packet to `examples/sample_packet/`.

## Before production
- Load each carrier/terminal's 315/322 implementation guide into `StatusCodeMap.for_partner()`; defaults are common codes only.
- Add every served port to `LocationTZ`.
- Free-time terms must come from the customer's service contract or tariff, never defaults.
- 545.5 reasonableness findings are always `needs_human=True`; have maritime counsel review the letter and complaint templates once.
- The customer signs and sends Charge Complaints. The engine prepares them and does not represent anyone before the FMC.

Legal basis (verified Oct 2026): 46 CFR Part 541 (eCFR current to 10/05/2026); 46 U.S.C. 41310; FMC Charge Complaint guidance (fmc.gov); 46 CFR 502.62(a)(4)(iii) as amended Sept 1 2026: no statute of limitations for Charge Complaints on charges assessed on or after June 16, 2022.
