---
title: "Demurrage & Detention Audit Engine — Production Spec v0.1"
subtitle: "Working name: DwellCheck · October 6, 2026"
---

# 0. Scope and legal ground truth

**Goal.** Ingest bills of lading (B/L), carrier/MTO/NVOCC D&D invoices, carrier and terminal event data, and drayage GPS pings; compute what the customer *actually* owes; and auto-generate dispute packets that cite federal rules, filed inside every deadline.

**Rules the engine encodes (verified against eCFR, 46 CFR Part 541, current as of Oct 5 2026):**

| Rule | Text (summary) | Engine effect |
|---|---|---|
| §541.5 | Missing any required minimum info **eliminates the obligation to pay** | Field-completeness check = strongest, cheapest win |
| §541.6(a) | Must show B/L no., container no., port of discharge (imports), **basis for why billed party is liable** | R1–R4 |
| §541.6(b) | Invoice date, due date, free days, free-time start/end, availability date (imports), earliest return date (exports), specific charged dates | R5–R12 |
| §541.6(c) | Total, applicable tariff/service-contract rule, specific rate(s) | R13–R15 |
| §541.6(d) | Dispute contact, URL/QR to public dispute-doc page, defined timeframes | R16–R18 |
| §541.6(e) | Certification of FMC compliance and that billing party's performance didn't cause the charges | R19–R20 |
| §541.7(a) | Invoice must issue **within 30 days** of the date the charge was last incurred, else **not payable** | R21 |
| §541.7(b) | NVOCC pass-through: 30 days from the invoice it received | R22 |
| §541.7(c) | NVOCC that is also billed can notify upstream; gets +30 days | Deadline extender |
| §541.7(d) | Re-bill to the correct party only within the original 30-day window | R23 |
| §541.8(a) | Billed party gets **≥30 days from invoice issuance** to request mitigation/refund/waiver | Dispute deadline |
| §541.8(b) | Billing party must attempt to resolve within 30 days of request | Escalation timer |
| 46 USC 41310 | Charge Complaint to FMC: needs B/L numbers + invoices; **carrier bears burden** of proving reasonableness under 46 CFR 545.5; refunds + civil penalties | Escalation path (Tier 3) |
| 46 CFR 545.5 | Interpretive rule: D&D must serve the incentive principle (moving cargo); charges when cargo *can't* move (no appointments, terminal closed, container unavailable, no empty-return location) are likely unreasonable | Reasonableness rules R30–R39 |

**Note.** FMC finalized updated Charge Complaint procedures (46 CFR Part 502) on Sept 1 2026; re-read before shipping Tier 3. Rules engine must be versioned by effective date (a 2023 invoice is judged on pre-May-28-2024 rules).

**Scope v1.** US imports/exports, ocean carriers (VOCC), MTOs, NVOCCs. Out of scope v1: rail storage, chassis per-diem from IEPs (different regime; v2), non-US ports.

---

# 1. System architecture

```
SOURCES
  Email inbox (invoices) | Carrier portals (browser workers) | EDI 310/315/322/810
  DCSA T&T API | Terminal portals | TMS / drayage GPS | Service contracts & tariffs
        |
        v
INGESTION:  Doc AI parser  +  Event normalizer  +  GPS geofencer
        |
        v
CORE:  Container Timeline -> Clock Engine (free time, chargeable days)
         -> Rules Engine (R1-R40 findings) --> Human Review Queue
        |
        v
OUTPUT:  Dispute Builder (packet PDF, letter, JSON)
         -> Submission Workers (email, portal, FMC complaint draft)
```

**Services**

| Service | Stack | Responsibility |
|---|---|---|
| `ingest-mail` | Gmail/Graph API watcher | Pull invoice PDFs/XLS from AP inboxes; dedupe by hash |
| `ingest-portal` | Browser worker pool (Playwright) | Log into carrier/terminal portals with customer creds from vault; download invoices, availability, gate events |
| `ingest-edi` | AS2/SFTP + X12 parser | 315 (status), 322 (terminal ops), 310 (freight receipt), 810 (invoice) |
| `ingest-api` | DCSA Track & Trace v2 + carrier APIs | Equipment/transport events |
| `ingest-gps` | Webhooks from TMS/ELD (Samsara, Motive, project44, etc.) | Truck pings, matched to container by dispatch |
| `docai` | Layout model + LLM extraction w/ JSON schema; confidence per field | Invoice, B/L, delivery order, EIR parsing |
| `timeline` | Postgres + event sourcing | Canonical container timeline, source precedence |
| `clock` | Deterministic TS/Python lib | Free time, chargeable days, calendar rules |
| `rules` | Versioned rule packs (YAML + code) | Findings with evidence pointers |
| `packet` | Template engine → PDF + JSON | Dispute letters, exhibits, FMC complaint draft |
| `submit` | Browser workers + SMTP + carrier APIs | File disputes, capture confirmation |
| `review` | Web app | Human-in-the-loop queue |
| `ledger` | Postgres | Money: disputed, credited, refunded, fee earned |

---

# 2. Canonical data schemas (JSON Schema 2020-12, abridged to fields that matter)

## 2.1 Shipment / B/L

```json
{
  "$id": "https://dwellcheck.io/schema/shipment.json",
  "type": "object",
  "required": ["shipment_id", "bl_number", "direction", "carrier_scac", "containers"],
  "properties": {
    "shipment_id": {"type": "string", "format": "uuid"},
    "tenant_id": {"type": "string"},
    "bl_number": {"type": "string", "pattern": "^[A-Z0-9]{6,20}$"},
    "house_bl_number": {"type": ["string", "null"]},
    "bl_type": {"enum": ["MASTER", "HOUSE", "SEAWAY"]},
    "direction": {"enum": ["IMPORT", "EXPORT"]},
    "carrier_scac": {"type": "string", "minLength": 2, "maxLength": 4},
    "nvocc_scac": {"type": ["string", "null"]},
    "service_contract_no": {"type": ["string", "null"]},
    "parties": {
      "type": "object",
      "properties": {
        "shipper": {"$ref": "#/$defs/party"},
        "consignee": {"$ref": "#/$defs/party"},
        "notify": {"$ref": "#/$defs/party"},
        "billed_party_of_record": {"$ref": "#/$defs/party"}
      }
    },
    "pol_unlocode": {"type": "string", "pattern": "^[A-Z]{5}$"},
    "pod_unlocode": {"type": "string", "pattern": "^[A-Z]{5}$"},
    "discharge_terminal_smdg": {"type": ["string", "null"]},
    "containers": {"type": "array", "items": {"$ref": "container.json"}},
    "documents": {"type": "array", "items": {"$ref": "#/$defs/docref"}}
  },
  "$defs": {
    "party": {"type": "object", "properties": {
      "name": {"type": "string"}, "scac_or_id": {"type": ["string", "null"]},
      "role": {"enum": ["SHIPPER", "CONSIGNEE", "NOTIFY", "BCO", "NVOCC", "FORWARDER", "TRUCKER"]}}},
    "docref": {"type": "object", "required": ["doc_id", "kind", "sha256"], "properties": {
      "doc_id": {"type": "string"}, "kind": {"enum": ["BL", "INVOICE", "DO", "EIR", "ARRIVAL_NOTICE", "TARIFF", "SC_AMENDMENT", "EMAIL", "SCREENSHOT"]},
      "sha256": {"type": "string"}, "source": {"type": "string"}, "captured_at": {"type": "string", "format": "date-time"}}}
  }
}
```

## 2.2 Container timeline event (canonical)

Mapped from DCSA event codes where possible.

```json
{
  "$id": "https://dwellcheck.io/schema/event.json",
  "type": "object",
  "required": ["event_id", "container_no", "type", "occurred_at", "source", "confidence"],
  "properties": {
    "event_id": {"type": "string"},
    "container_no": {"type": "string", "pattern": "^[A-Z]{4}[0-9]{7}$"},
    "type": {"enum": [
      "VESSEL_ARRIVED", "DISCHARGED", "AVAILABLE_FOR_PICKUP", "HOLD_PLACED", "HOLD_RELEASED",
      "GATE_OUT_FULL", "DELIVERED_TO_CONSIGNEE", "EMPTY_AVAILABLE", "GATE_IN_EMPTY",
      "EMPTY_RETURN_REFUSED", "APPT_UNAVAILABLE", "TERMINAL_CLOSED",
      "EXPORT_EARLIEST_RETURN", "GATE_IN_FULL", "LOADED", "CUTOFF_CHANGED", "ROLLED"
    ]},
    "occurred_at": {"type": "string", "format": "date-time"},
    "local_tz": {"type": "string"},
    "location": {"type": "object", "properties": {
      "unlocode": {"type": "string"}, "facility_smdg": {"type": ["string", "null"]},
      "lat": {"type": ["number", "null"]}, "lng": {"type": ["number", "null"]}}},
    "hold_type": {"enum": [null, "CUSTOMS", "USDA", "FREIGHT", "LINE", "TERMINAL", "CTF", "OTHER"]},
    "source": {"enum": ["DCSA_API", "EDI_315", "EDI_322", "TERMINAL_PORTAL", "CARRIER_PORTAL", "GPS_GEOFENCE", "EIR", "INVOICE_STATED", "USER"]},
    "source_ref": {"type": "string", "description": "doc_id, API request id, or GPS ping id"},
    "confidence": {"type": "number", "minimum": 0, "maximum": 1},
    "superseded_by": {"type": ["string", "null"]}
  }
}
```

**Source precedence when events conflict** (per event type, highest wins unless confidence < 0.6):
`EIR > TERMINAL_PORTAL > EDI_322 > DCSA_API > EDI_315 > GPS_GEOFENCE > CARRIER_PORTAL > INVOICE_STATED > USER`.
Conflicts > 4 hours on a chargeable boundary → finding `F_TIMELINE_CONFLICT` → human review.

## 2.3 Invoice (parsed)

```json
{
  "$id": "https://dwellcheck.io/schema/invoice.json",
  "type": "object",
  "required": ["invoice_id", "billing_party", "invoice_no", "lines", "fields"],
  "properties": {
    "invoice_id": {"type": "string"},
    "billing_party": {"type": "object", "properties": {
      "name": {"type": "string"}, "scac": {"type": ["string", "null"]},
      "kind": {"enum": ["VOCC", "MTO", "NVOCC"]}}},
    "billed_party": {"type": "object"},
    "invoice_no": {"type": "string"},
    "currency": {"type": "string", "default": "USD"},
    "fields": {
      "description": "Every §541.6 element, each with value + where found + extraction confidence",
      "type": "object",
      "properties": {
        "bl_numbers":           {"$ref": "#/$defs/f"},
        "container_numbers":    {"$ref": "#/$defs/f"},
        "port_of_discharge":    {"$ref": "#/$defs/f"},
        "liability_basis":      {"$ref": "#/$defs/f"},
        "invoice_date":         {"$ref": "#/$defs/f"},
        "due_date":             {"$ref": "#/$defs/f"},
        "free_days":            {"$ref": "#/$defs/f"},
        "free_time_start":      {"$ref": "#/$defs/f"},
        "free_time_end":        {"$ref": "#/$defs/f"},
        "availability_date":    {"$ref": "#/$defs/f"},
        "earliest_return_date": {"$ref": "#/$defs/f"},
        "charged_dates":        {"$ref": "#/$defs/f"},
        "total_amount":         {"$ref": "#/$defs/f"},
        "tariff_rule_ref":      {"$ref": "#/$defs/f"},
        "rates":                {"$ref": "#/$defs/f"},
        "dispute_contact":      {"$ref": "#/$defs/f"},
        "dispute_url_or_qr":    {"$ref": "#/$defs/f"},
        "dispute_timeframes":   {"$ref": "#/$defs/f"},
        "cert_fmc_compliance":  {"$ref": "#/$defs/f"},
        "cert_no_fault":        {"$ref": "#/$defs/f"}
      }
    },
    "lines": {"type": "array", "items": {"type": "object", "properties": {
      "container_no": {"type": "string"},
      "charge_type": {"enum": ["DEMURRAGE", "DETENTION", "COMBINED", "STORAGE", "PER_DIEM"]},
      "from_date": {"type": "string", "format": "date"},
      "to_date": {"type": "string", "format": "date"},
      "days": {"type": "integer"},
      "tiers": {"type": "array", "items": {"type": "object", "properties": {
        "days": {"type": "integer"}, "rate": {"type": "number"}, "amount": {"type": "number"}}}},
      "amount": {"type": "number"}}}},
    "issued_via": {"enum": ["EMAIL", "PORTAL", "EDI_810", "MAIL"]},
    "first_seen_at": {"type": "string", "format": "date-time"},
    "paid": {"type": "object", "properties": {
      "status": {"enum": ["UNPAID", "PAID", "PARTIAL", "PAID_UNDER_PROTEST"]},
      "amount": {"type": "number"}, "date": {"type": ["string", "null"]}}}
  },
  "$defs": {"f": {"type": "object", "properties": {
    "present": {"type": "boolean"},
    "value": {},
    "page": {"type": ["integer", "null"]},
    "bbox": {"type": ["array", "null"], "items": {"type": "number"}},
    "via_url": {"type": ["string", "null"], "description": "Element provided only via linked page"},
    "confidence": {"type": "number"}}}}
}
```

## 2.4 Claim (dispute) state

```json
{
  "$id": "https://dwellcheck.io/schema/claim.json",
  "type": "object",
  "required": ["claim_id", "invoice_id", "state", "findings", "deadlines"],
  "properties": {
    "claim_id": {"type": "string"},
    "invoice_id": {"type": "string"},
    "rulepack_version": {"type": "string", "example": "fmc541-2024.05.28+545.5-2022"},
    "state": {"enum": [
      "DETECTED", "ANALYZED", "NO_ACTION", "NEEDS_EVIDENCE", "NEEDS_REVIEW", "APPROVED",
      "SUBMITTED", "ACKNOWLEDGED", "INFO_REQUESTED", "PARTIAL_CREDIT", "CREDITED",
      "DENIED", "ESCALATION_REVIEW", "FMC_COMPLAINT_FILED", "REFUNDED", "CLOSED_WON",
      "CLOSED_LOST", "EXPIRED"
    ]},
    "findings": {"type": "array", "items": {"$ref": "#/$defs/finding"}},
    "amounts": {"type": "object", "properties": {
      "invoiced": {"type": "number"}, "engine_owed": {"type": "number"},
      "disputed": {"type": "number"}, "credited": {"type": "number"},
      "refunded": {"type": "number"}, "fee_earned": {"type": "number"}}},
    "deadlines": {"type": "object", "properties": {
      "dispute_due": {"type": "string", "format": "date", "description": "invoice_date + max(30, stated window) days"},
      "carrier_response_due": {"type": ["string", "null"], "format": "date"},
      "internal_submit_by": {"type": "string", "format": "date", "description": "dispute_due - 5 business days"}}},
    "submissions": {"type": "array", "items": {"type": "object", "properties": {
      "channel": {"enum": ["EMAIL", "CARRIER_PORTAL", "API", "FMC_CHARGE_COMPLAINT", "FMC_SMALL_CLAIM"]},
      "submitted_at": {"type": "string", "format": "date-time"},
      "confirmation_ref": {"type": ["string", "null"]},
      "packet_doc_id": {"type": "string"},
      "screenshot_doc_id": {"type": ["string", "null"]}}}},
    "reviewer": {"type": ["string", "null"]},
    "audit_log": {"type": "array", "items": {"type": "object"}}
  },
  "$defs": {"finding": {"type": "object", "required": ["rule_id", "severity", "amount_at_issue", "evidence"], "properties": {
    "rule_id": {"type": "string"},
    "category": {"enum": ["CONTENT_541_6", "TIMING_541_7", "MATH", "FREE_TIME", "REASONABLENESS_545_5", "PARTY", "DUPLICATE"]},
    "severity": {"enum": ["VOIDS_INVOICE", "VOIDS_LINE", "REDUCES", "INFO"]},
    "amount_at_issue": {"type": "number"},
    "explanation": {"type": "string"},
    "citation": {"type": "string"},
    "evidence": {"type": "array", "items": {"type": "string", "description": "doc_id#page or event_id"}},
    "confidence": {"type": "number"}}}}
}
```

**State machine (allowed transitions)**

```
DETECTED → ANALYZED → {NO_ACTION | NEEDS_EVIDENCE | NEEDS_REVIEW | APPROVED}
NEEDS_EVIDENCE → ANALYZED            (new docs/events arrive)
NEEDS_REVIEW → {APPROVED | NO_ACTION}
APPROVED → SUBMITTED → ACKNOWLEDGED → {INFO_REQUESTED | PARTIAL_CREDIT | CREDITED | DENIED}
INFO_REQUESTED → SUBMITTED
PARTIAL_CREDIT | DENIED → ESCALATION_REVIEW → {FMC_COMPLAINT_FILED | CLOSED_LOST}
FMC_COMPLAINT_FILED → {REFUNDED | CLOSED_LOST}
CREDITED | REFUNDED → CLOSED_WON
any pre-SUBMITTED state past deadlines.dispute_due → EXPIRED (alert, still allow Tier 3 if rule allows)
```

---

# 3. Clock engine (deterministic)

```python
def chargeable_days(direction, timeline, tariff, sc):
    # 1. Resolve free-time start
    if direction == "IMPORT":
        start = max(timeline.first("DISCHARGED"),
                    timeline.first("AVAILABLE_FOR_PICKUP"))          # availability, not discharge
        dem_end  = timeline.first("GATE_OUT_FULL")
        det_start= dem_end
        det_end  = timeline.first("GATE_IN_EMPTY")
    else:
        start    = timeline.first("EMPTY_PICKUP")                    # detention out
        dem_start= max(timeline.first("GATE_IN_FULL"),
                       timeline.first("EXPORT_EARLIEST_RETURN"))
        dem_end  = timeline.first("LOADED")

    # 2. Free days from service contract first, else tariff
    free = sc.free_days(charge_type) or tariff.free_days(charge_type)
    calendar = sc.calendar or tariff.calendar         # CALENDAR | WORKING (excl. Sat/Sun/holidays)

    # 3. Days the clock must stop (545.5 incentive principle + contract terms)
    stops = union(
        intervals(timeline, "HOLD_PLACED", "HOLD_RELEASED", where=hold_not_caused_by_customer),
        intervals(timeline, "TERMINAL_CLOSED"),
        days_with(timeline, "APPT_UNAVAILABLE", min_attempts=1),
        days_with(timeline, "EMPTY_RETURN_REFUSED"),
        sc.excluded_days, tariff.excluded_days
    )

    # 4. Walk days in port-local tz; count charged days after free time exhausted
    ...
    return {"free_start", "free_end", "charged_dates": [...], "tiers": [...], "amount": ...}
```

Rules: all dates evaluated in **port-local timezone**; a partial day counts as a full day only if tariff says so; tier boundaries follow tariff (e.g., days 1–4 @ $X, 5+ @ $Y); free time never starts before availability for imports.

---

# 4. Rules engine — the 40 rules

Each rule: `id`, `applies_if`, `logic`, `severity`, `amount`, `citation`, `evidence_needed`, `auto_threshold` (min confidence to skip human review).

## 4.1 Content rules (§541.5 / §541.6) — "void the invoice"

| ID | Check | Severity | Auto ≥ |
|---|---|---|---|
| R1 | B/L number(s) present | VOIDS_INVOICE | 0.95 |
| R2 | Container number(s) present | VOIDS_INVOICE | 0.95 |
| R3 | Port of discharge present (imports) | VOIDS_INVOICE | 0.95 |
| R4 | Basis for billed party's liability stated | VOIDS_INVOICE | 0.90 |
| R5 | Invoice date | VOIDS_INVOICE | 0.95 |
| R6 | Due date | VOIDS_INVOICE | 0.95 |
| R7 | Free days stated | VOIDS_INVOICE | 0.95 |
| R8 | Free-time start date | VOIDS_INVOICE | 0.95 |
| R9 | Free-time end date | VOIDS_INVOICE | 0.95 |
| R10 | Container availability date (imports) | VOIDS_INVOICE | 0.95 |
| R11 | Earliest return date (exports) | VOIDS_INVOICE | 0.95 |
| R12 | Specific charged dates | VOIDS_INVOICE | 0.95 |
| R13 | Total amount | VOIDS_INVOICE | 0.98 |
| R14 | Applicable tariff/SC rule reference | VOIDS_INVOICE | 0.90 |
| R15 | Specific rate(s) | VOIDS_INVOICE | 0.95 |
| R16 | Dispute contact | VOIDS_INVOICE | 0.90 |
| R17 | URL/QR to public dispute-doc page (and page resolves) | VOIDS_INVOICE | 0.90 |
| R18 | Defined dispute + resolution timeframes, ≥30 days to dispute | VOIDS_INVOICE | 0.90 |
| R19 | Certification: consistent with FMC rules incl. 545.5 | VOIDS_INVOICE | 0.90 |
| R20 | Certification: billing party's performance didn't cause charges | VOIDS_INVOICE | 0.90 |

```yaml
- id: R17
  applies_if: invoice.issue_date >= "2024-05-28"
  logic: |
    f = invoice.fields.dispute_url_or_qr
    if not f.present: FAIL
    resp = worker.fetch(f.value, follow_redirects=true, anonymous=true)
    if resp.status != 200 or resp.requires_login: FAIL("not publicly accessible")
    if not llm.classify(resp.text, "describes documentation needed for mitigation/refund/waiver"): FAIL
  citation: "46 CFR 541.6(d)(2); 541.5"
  evidence_needed: [invoice_pdf, url_fetch_screenshot]
```

**Accuracy guard:** element provided only on a linked page counts as present only if the rule text allows it (R17 explicitly digital; others must be on/with the invoice). Low-confidence "absent" (<0.9) → human review; false "missing" claims damage credibility with carriers.

## 4.2 Timing rules (§541.7)

| ID | Logic | Severity |
|---|---|---|
| R21 | `invoice_date − last_charged_date > 30 days` (VOCC/MTO) | VOIDS_INVOICE |
| R22 | NVOCC: `nvocc_invoice_date − upstream_invoice_date > 30` | VOIDS_INVOICE |
| R23 | Re-bill to corrected party after original 30-day window | VOIDS_INVOICE |
| R24 | Stated dispute window < 30 days from issuance | VOIDS_INVOICE (via R18) + note |

`invoice_date` source: stated date, cross-checked against email received timestamp / portal posting date; if stated date precedes first availability to customer by > 3 days, flag `F_BACKDATED` → review.

## 4.3 Math & free-time rules

| ID | Logic | Severity |
|---|---|---|
| R25 | Σ line amounts ≠ total (±$1) | REDUCES |
| R26 | Rate ≠ SC/tariff rate for that tier & date | REDUCES (difference) |
| R27 | Free days < contract free days | REDUCES |
| R28 | Free time started before availability (imports) | REDUCES |
| R29 | Charged dates outside engine's chargeable window | REDUCES |
| R40 | Duplicate: same container × charge type × overlapping dates on another invoice | VOIDS_LINE |

## 4.4 Reasonableness rules (46 CFR 545.5 incentive principle)

| ID | Evidence | Severity |
|---|---|---|
| R30 | Terminal closed / no gate hours on charged day | REDUCES (those days) |
| R31 | No pickup appointments available (portal screenshots, ≥1 attempt/day logged) | REDUCES |
| R32 | Container not available (hold not caused by customer, e.g. line or terminal hold; rolled/stacked unworkable) | REDUCES |
| R33 | Empty return refused / no return location designated | REDUCES |
| R34 | Customer gave notice and carrier/MTO failed to act (e.g., dual-transaction rule, chassis shortage notice) | REDUCES |
| R35 | Charges continued during government closure, strike, weather emergency at port | REDUCES |
| R36 | Export: earliest return date changed after booking; charged before new ERD | REDUCES |
| R37 | Export: vessel delay/roll moved cutoff; demurrage charged for carrier's delay | REDUCES |
| R38 | Billed party is not the party with contractual relationship / control (e.g., trucker or wrong consignee) | VOIDS_INVOICE |
| R39 | GPS shows truck at terminal gate in queue during window but turned away (geofence dwell ≥ 45 min, no GATE_OUT) | REDUCES (supporting R31) |

```yaml
- id: R39
  applies_if: gps_available and charge_type in [DEMURRAGE, COMBINED]
  logic: |
    for day in charged_dates:
      visits = gps.geofence_visits(terminal_polygon, day, truck in dispatch_for(container))
      if any(v.dwell_min >= 45 and not timeline.has("GATE_OUT_FULL", day) for v in visits):
        mark day as "attempted, denied"
  evidence: [gps_track_png, geofence_polygon_geojson, dispatch_record]
  citation: "46 CFR 545.5(c)(2) incentive principle; carrier bears burden under 46 U.S.C. 41310(b)(2)"
  auto_threshold: never     # reasonableness findings always human-reviewed in v1
```

---

# 5. Automation workflows

## W1 — Ingest & match (continuous)
1. `ingest-mail` sees new message to `ap@` / `dnd@` → classify (invoice / arrival notice / DO / other).
2. `docai` extracts invoice → `invoice.json` with per-field confidence + bbox.
3. Match to shipment by B/L, then container; if no shipment, create stub and request B/L from TMS or portal worker.
4. Portal worker pulls missing events (availability, gate in/out, holds) for each container from terminal portal → `event.json`.
5. GPS service pulls pings for dispatched trucks ±2 days around charged window.
6. Emit `ANALYZE(invoice_id)`.

## W2 — Analyze
1. Build timeline; resolve conflicts by precedence.
2. Clock engine → `engine_owed`.
3. Run rules (pack chosen by invoice date). Aggregate: if any `VOIDS_INVOICE` with confidence ≥ threshold → `disputed = invoiced`; else `disputed = invoiced − engine_owed`.
4. Thresholds: `disputed < $150` and no VOID finding → `NO_ACTION` (batch in monthly summary letter). Else `NEEDS_REVIEW` or `APPROVED` per auto rules (§7).
5. Compute deadlines; schedule reminders at D−10, D−5, D−2.

## W3 — Build packet
Contents (PDF, bookmarked) + machine JSON:
1. Cover letter (template T1) with summary table of findings and amount.
2. Exhibit A: invoice with highlighted missing/incorrect fields (bbox overlays).
3. Exhibit B: container timeline table + source of each event.
4. Exhibit C: tariff/SC excerpt with applicable rule.
5. Exhibit D: evidence (terminal screenshots, appointment-unavailable logs, GPS map, EIRs).
6. Exhibit E: rule citations (46 CFR 541.5–541.8, 545.5 text).

## W4 — Submit
Channel priority: carrier dispute portal/API → dispute email named on invoice (§541.6(d)(1)) → certified letter.
Browser worker steps for portal submission (generic):
```
login(vault[tenant][carrier]) → nav "Disputes"/"Invoice Dispute" → select invoice_no
→ reason code map (§5.2) → paste T2 summary (≤ 2,000 chars) → upload packet.pdf
→ submit → capture confirmation id + full-page screenshot → claim.submissions.push(...)
→ state SUBMITTED
on failure: retry ×2 with fresh session; then fallback to email channel; never miss internal_submit_by
```

## W5 — Track & respond
- Poll portal / parse replies daily. LLM classifies reply: `ACK | CREDIT_FULL | CREDIT_PARTIAL | DENIED | INFO_REQUEST`.
- Carrier must attempt resolution in 30 days (§541.8(b)); at day 31 with no resolution → auto follow-up T3, flag for escalation review.
- Credits reconciled against next carrier statement; fee invoiced to customer only on **realized** credit/refund.

## W6 — Escalate (Tier 3)
For denied/partial claims with VOID findings or strong 545.5 evidence and amount ≥ $2,500 (configurable): prepare **FMC Charge Complaint** draft (B/L numbers, invoices, alleged violations of 46 USC 41104(a)/41102, evidence). Customer signs and submits as the complainant (any person may submit under §41310). Option to route to partner maritime counsel for formal/small-claims proceedings.

## 5.1 Mock payloads

**Dispute API / portal JSON (normalized internal → carrier adapter)**
```json
{
  "dispute_ref": "DWC-2026-000418",
  "billing_party_scac": "MAEU",
  "invoice_no": "DD-7754120",
  "invoice_date": "2026-08-14",
  "bl_numbers": ["MAEU244118812"],
  "containers": [
    {"container_no": "MSKU7731042", "charge_type": "DEMURRAGE",
     "invoiced_amount": 3150.00, "disputed_amount": 3150.00,
     "reason_codes": ["MISSING_REQUIRED_INFO", "LATE_INVOICE"],
     "findings": [
       {"rule": "R10", "citation": "46 CFR 541.6(b)(6)", "text": "Invoice omits container availability date."},
       {"rule": "R21", "citation": "46 CFR 541.7(a)", "text": "Last charge incurred 2026-07-09; invoice issued 2026-08-14 (36 days)."}
     ]}
  ],
  "requested_action": "WAIVER",
  "contact": {"name": "AP Team, Acme Imports", "email": "dnd@acme.example", "phone": "+1-410-555-0100"},
  "attachments": [{"name": "DWC-2026-000418-packet.pdf", "sha256": "…"}]
}
```

**EDI 315 event → canonical**
```json
{"src": {"B4_03": "OA", "B4_07": "MSKU", "B4_08": "7731042", "DTM": "20260702", "R4_LOC": "USBAL"},
 "out": {"container_no": "MSKU7731042", "type": "GATE_OUT_FULL", "occurred_at": "2026-07-02T14:12:00-04:00",
         "location": {"unlocode": "USBAL"}, "source": "EDI_315", "confidence": 0.9}}
```

**GPS geofence visit**
```json
{"truck_id": "T-114", "container_no": "MSKU7731042", "facility": "Seagirt Marine Terminal",
 "enter": "2026-06-30T07:41:00-04:00", "exit": "2026-06-30T10:02:00-04:00", "dwell_min": 141,
 "gate_out_in_window": false, "ping_count": 47, "polygon_version": "smt-2026-03"}
```

## 5.2 Reason-code mapping (internal → typical carrier portal picklists)

| Internal | Typical picklist |
|---|---|
| MISSING_REQUIRED_INFO | "Invoice incomplete / regulatory" |
| LATE_INVOICE | "Invoice issued late" |
| FREE_TIME_ERROR | "Free time incorrect" |
| RATE_ERROR | "Tariff/contract rate incorrect" |
| CONTAINER_UNAVAILABLE | "Container not available / hold" |
| NO_APPOINTMENTS | "Terminal congestion / no appointments" |
| EMPTY_RETURN_REFUSED | "Empty return not accepted" |
| WRONG_PARTY | "Not liable party" |
| DUPLICATE | "Duplicate billing" |

## 5.3 Letter templates

**T1 — Dispute cover letter (summary)**
> RE: Request for waiver — Invoice {invoice_no}, B/L {bl}, Container(s) {containers}
> Under 46 CFR 541.8(a), {customer} requests waiver of {disputed_amount}. The invoice {omits required element(s): list} (46 CFR 541.6), which under 46 CFR 541.5 eliminates any obligation to pay. {Additionally/Alternatively: timing and reasonableness findings.} Please resolve within 30 days per 46 CFR 541.8(b). Exhibits attached.

**T3 — 30-day follow-up**: notes no resolution within §541.8(b) window; requests written decision within 10 business days; reserves rights under 46 USC 41310.

---

# 6. Error recovery

| Failure | Detection | Recovery |
|---|---|---|
| OCR/extraction low confidence | field conf < threshold | Re-run with alternate model; then human field-verify UI (click the field on the PDF) |
| Missing B/L or events | timeline gaps on chargeable boundary | Portal worker fetch; ask customer's TMS; `NEEDS_EVIDENCE` with checklist; never assume |
| Portal login fails | 401/MFA/captcha | Vault re-auth flow → customer prompt; switch to email channel if deadline < 3 days |
| Portal layout changed | selector/step failure ×2 | Mark adapter `DEGRADED`, fallback channel, page on-call to update playbook |
| Event conflicts | precedence tie or >4h discrepancy | `F_TIMELINE_CONFLICT` → review with both sources shown |
| GPS gaps | > 20 min ping gap in window | Don't use R39 for that day |
| Deadline risk | `internal_submit_by` reached, not SUBMITTED | Escalate to reviewer on-call; submit minimal content-rule-only dispute to preserve rights |
| Duplicate submission | idempotency key `(tenant, invoice_no, version)` | Block second submit; append supplement instead |
| Carrier re-issues corrected invoice | new invoice same containers/dates | Link as `supersedes`; re-run R21/R23 (correction outside 30 days is still late) |
| Rule pack change | new FMC rule / effective date | Versioned packs; re-analyze open claims; never re-judge closed ones |
| Payment already made | invoice.paid = PAID | Request refund not waiver; Tier 3 eligible ("refund of charges paid") |

All worker actions are idempotent and logged with screenshots; every claim is rebuildable from its event log.

---

# 7. Human-in-the-loop boundaries

**Auto-submit allowed (no human) only when ALL hold:**
- Findings are content (R1–R20) or timing (R21–R23) rules only.
- Every finding confidence ≥ its auto threshold, and invoice field extraction verified by two independent passes.
- Disputed amount ≤ $5,000 per invoice (tenant-configurable down, never up past $25k).
- Customer enabled auto-submit for that billing party.
- Not the first dispute against that billing party for this tenant (first one always reviewed).

**Always human-reviewed:**
- Any reasonableness finding (R30–R39) or wrong-party finding (R38).
- Anything sent to the FMC, any legal threat language, any formal/small claim.
- Statements of fact made on the customer's behalf beyond documents (e.g., "we attempted pickup").
- Relationship-sensitive carriers flagged by the customer (key accounts).
- Disputes > $5,000 or bundle > $25,000.
- Disagreement between engine and invoice stated dates > 1 day.

**Customer-only actions (product never does):**
- Signing or verifying FMC complaints (complainant is the customer; representation before FMC limited to admitted practitioners — partner counsel for formal cases).
- Paying invoices or accepting settlements below 50% of disputed amount.
- Waiving rights or signing releases.

**Reviewer UI:** side-by-side invoice PDF (highlights), timeline, clock math, findings with toggle, edited letter preview; actions Approve / Edit / Request evidence / Drop; target SLA 4 business hours; reviewer decisions train threshold calibration.

---

# 8. Security, data, and metrics

- Customer portal credentials in a vault (per-tenant KMS keys); workers get short-lived decrypt; no credential reaches LLM context.
- SOC 2 Type II path from month 1; data retention 7 years (tax/audit) configurable.
- PII minimal; GPS stored only for dispatched trucks within ±2 days of charged windows.

**North-star metrics:** $ recovered / $ invoiced; win rate by rule and billing party; median days to credit; % auto-submitted; false-finding rate (target < 2%); deadline misses (target 0).

**Business model hook:** 25–35% of realized credits/refunds; free 12-month look-back audit (only invoices still within dispute windows are disputable — older ones feed Tier 3 if paid and violating).

---

# 9. MVP build order (8 weeks)

1. Wk 1–2: invoice parser + §541.6 completeness checker (R1–R20) + R21 late-invoice. Backtest on 500 real invoices from 3 design partners. This alone is a product.
2. Wk 3–4: timeline + clock engine from terminal portals/EDI; R25–R29; packet builder; email submission.
3. Wk 5–6: review UI, deadline scheduler, reply classifier, ledger and fee billing.
4. Wk 7–8: portal adapters for top 5 carriers by tenant volume; R30–R33 with screenshots; GPS R39 for tenants with ELD.
5. Post-MVP: FMC Charge Complaint drafting, NVOCC flows, chassis per-diem (IEP) pack.

*Not legal advice. Rule citations from 46 CFR Part 541 as published on eCFR (current to Oct 5 2026) and 46 U.S.C. 41310; 46 CFR 545.5 summarized, verify full text before production. Charge Complaint procedures updated by FMC final rule published Sept 1 2026.*
