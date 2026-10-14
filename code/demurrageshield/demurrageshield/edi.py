"""X12 EDI 315 (Status Details, Ocean) and 322 (Terminal Operations and Intermodal
Ramp Activity) parser.

Design notes
- Delimiters are read from the ISA header (element sep = ISA[3], repetition / component
  sep = ISA[104], segment terminator = char after ISA16), never hard-coded.
- Status code -> canonical EventType mapping is a per-trading-partner table. The defaults
  below cover the codes most carriers and terminals use, but implementation guides
  differ: load the partner's map via `StatusCodeMap.for_partner()` before production.
- EDI times are local to the reporting location unless a time code says otherwise. The
  parser attaches the location's IANA zone from `LocationTZ`; unknown locations raise
  rather than silently assuming UTC.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Iterable, Iterator, Optional
from zoneinfo import ZoneInfo

from .models import ContainerEvent, EventType


class EDIError(ValueError):
    pass


# --------------------------------------------------------------------------- envelope

@dataclass
class Segment:
    tag: str
    elements: list[str]
    index: int

    def el(self, n: int, default: str = "") -> str:
        """1-based element access: seg.el(1) == B401."""
        return self.elements[n - 1].strip() if 0 < n <= len(self.elements) else default


@dataclass
class Transaction:
    set_id: str            # "315" | "322"
    control_no: str
    segments: list[Segment]
    sender_id: str
    interchange_control_no: str
    transmitted_at: Optional[datetime]


def tokenize(raw: str) -> tuple[list[Segment], dict]:
    raw = raw.lstrip("\ufeff").lstrip()
    if not raw.startswith("ISA") or len(raw) < 106:
        raise EDIError("Interchange must start with a 106-char ISA segment")
    el_sep = raw[3]
    comp_sep = raw[104]
    seg_term = raw[105]
    body = raw.replace("\r", "").replace("\n", "") if seg_term not in "\r\n" else raw
    segs: list[Segment] = []
    for i, chunk in enumerate(s for s in body.split(seg_term) if s.strip()):
        parts = chunk.strip().split(el_sep)
        segs.append(Segment(tag=parts[0], elements=parts[1:], index=i))
    return segs, {"element": el_sep, "component": comp_sep, "segment": seg_term}


def _isa_datetime(isa: Segment) -> Optional[datetime]:
    try:
        return datetime.strptime(isa.el(9) + isa.el(10), "%y%m%d%H%M").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def transactions(raw: str) -> Iterator[Transaction]:
    segs, _ = tokenize(raw)
    isa = segs[0]
    sender = isa.el(6)
    icn = isa.el(13)
    sent = _isa_datetime(isa)
    gs_dt: Optional[datetime] = None
    cur: Optional[Transaction] = None
    for s in segs[1:]:
        if s.tag == "GS":
            try:
                gs_dt = datetime.strptime(s.el(4) + s.el(5)[:4], "%Y%m%d%H%M").replace(tzinfo=timezone.utc)
            except ValueError:
                gs_dt = None
        elif s.tag == "ST":
            cur = Transaction(s.el(1), s.el(2), [], sender, icn, gs_dt or sent)
        elif s.tag == "SE":
            if cur is None:
                raise EDIError(f"SE without ST at segment {s.index}")
            declared = int(s.el(1) or 0)
            actual = len(cur.segments) + 2  # ST + SE
            if declared != actual:
                raise EDIError(f"ST {cur.control_no}: SE01 says {declared} segments, found {actual}")
            yield cur
            cur = None
        elif cur is not None:
            cur.segments.append(s)
    if cur is not None:
        raise EDIError(f"ST {cur.control_no} not closed by SE")


# --------------------------------------------------------------------------- mapping

DEFAULT_STATUS_MAP: dict[str, EventType] = {
    # 315 B403 / 322 Q501 shipment status codes (verify per partner guide)
    "VA": EventType.VESSEL_ARRIVED,
    "UV": EventType.DISCHARGED,
    "AV": EventType.AVAILABLE,
    "CT": EventType.HOLD_RELEASED,     # customs release
    "CR": EventType.HOLD_RELEASED,     # carrier release
    "CH": EventType.HOLD_PLACED,       # customs hold
    "OA": EventType.GATE_OUT_FULL,     # out-gate (full on import; see direction fix-up)
    "D":  EventType.DELIVERED,
    "X1": EventType.DELIVERED,
    "RD": EventType.GATE_IN_EMPTY,     # empty returned
    "EE": EventType.EMPTY_DISPATCHED,
    "I":  EventType.GATE_IN_FULL,      # in-gate (full on export; see direction fix-up)
    "AE": EventType.LOADED,
    "VD": EventType.VESSEL_DEPARTED,
}

HOLD_CODES = {"CH": "CUSTOMS", "CT": "CUSTOMS", "CR": "FREIGHT"}


@dataclass
class StatusCodeMap:
    codes: dict[str, EventType] = field(default_factory=lambda: dict(DEFAULT_STATUS_MAP))

    @classmethod
    def for_partner(cls, overrides: dict[str, str]) -> "StatusCodeMap":
        m = cls()
        m.codes.update({k: EventType(v) for k, v in overrides.items()})
        return m

    def map(self, code: str, equipment_status: str = "") -> EventType:
        et = self.codes.get(code.strip(), EventType.UNKNOWN)
        # Gate moves are ambiguous without load status: E = empty, L = loaded
        if et == EventType.GATE_OUT_FULL and equipment_status == "E":
            return EventType.EMPTY_DISPATCHED
        if et == EventType.GATE_IN_FULL and equipment_status == "E":
            return EventType.GATE_IN_EMPTY
        return et


@dataclass
class LocationTZ:
    zones: dict[str, str] = field(default_factory=lambda: {
        "USBAL": "America/New_York", "USNYC": "America/New_York", "USSAV": "America/New_York",
        "USCHS": "America/New_York", "USORF": "America/New_York", "USMIA": "America/New_York",
        "USHOU": "America/Chicago", "USMOB": "America/Chicago", "USNOL": "America/Chicago",
        "USLAX": "America/Los_Angeles", "USLGB": "America/Los_Angeles", "USOAK": "America/Los_Angeles",
        "USSEA": "America/Los_Angeles", "USTIW": "America/Los_Angeles",
    })

    def tz(self, loc: str) -> ZoneInfo:
        key = loc.strip().upper()
        if key not in self.zones:
            raise EDIError(f"No timezone for location '{loc}'. Add it to LocationTZ.")
        return ZoneInfo(self.zones[key])


_X12_TZ_OFFSETS = {"ET": None, "LT": None, "UT": 0, "GM": 0,
                   "ES": -5, "ED": -4, "CS": -6, "CD": -5, "PS": -8, "PD": -7}


def _parse_dt(d: str, t: str, tz: ZoneInfo, time_code: str = "") -> datetime:
    t = (t or "0000").ljust(4, "0")[:6]
    fmt = "%Y%m%d" if len(d) == 8 else "%y%m%d"
    base = datetime.strptime(d, fmt)
    hh, mm = int(t[:2]), int(t[2:4])
    ss = int(t[4:6]) if len(t) >= 6 else 0
    naive = base.replace(hour=hh, minute=mm, second=ss)
    off = _X12_TZ_OFFSETS.get(time_code.upper()) if time_code else None
    if off is not None:
        return naive.replace(tzinfo=timezone(timedelta(hours=off))).astimezone(tz)
    return naive.replace(tzinfo=tz)


# --------------------------------------------------------------------------- 315

def parse_315(tx: Transaction, codes: StatusCodeMap, tzs: LocationTZ) -> list[ContainerEvent]:
    """One 315 = one status event for one container (B4), with N9 refs, Q2 vessel,
    R4 ports and DTM dates in the loop."""
    b4 = next((s for s in tx.segments if s.tag == "B4"), None)
    if b4 is None:
        raise EDIError(f"315 {tx.control_no}: missing B4")
    code = b4.el(3)
    container = (b4.el(7) + b4.el(8)).upper()
    eq_status = b4.el(9)
    status_loc = b4.el(11) or b4.el(6)
    bls = tuple(s.el(2) for s in tx.segments if s.tag == "N9" and s.el(1) in ("BM", "MB", "BL"))
    if not status_loc:
        r4 = next((s for s in tx.segments if s.tag == "R4" and s.el(2) == "UN"), None)
        status_loc = r4.el(3) if r4 else ""
    tz = tzs.tz(status_loc)
    when = _parse_dt(b4.el(4), b4.el(5), tz)
    et = codes.map(code, eq_status)
    return [ContainerEvent(
        container_no=container, type=et, occurred_at=when, source="EDI_315",
        raw_code=code, location=status_loc, bl_numbers=bls,
        hold_type=HOLD_CODES.get(code), transmitted_at=tx.transmitted_at,
        source_ref=f"ISA{tx.interchange_control_no}/ST{tx.control_no}/B4@{b4.index}",
        confidence=0.9 if et != EventType.UNKNOWN else 0.0,
    )]


# --------------------------------------------------------------------------- 322

def parse_322(tx: Transaction, codes: StatusCodeMap, tzs: LocationTZ) -> list[ContainerEvent]:
    """322 loops: N7 (equipment) followed by Q5 (status, date, time, time code, location)
    and N9 references. A single 322 can carry multiple Q5 events for one container."""
    out: list[ContainerEvent] = []
    container = ""
    eq_status = ""
    bls: list[str] = []
    pending: list[Segment] = []
    for s in tx.segments:
        if s.tag == "N7":
            container = (s.el(1) + s.el(2)).upper()
            eq_status = s.el(12) if len(s.elements) >= 12 else ""
        elif s.tag == "N9" and s.el(1) in ("BM", "MB", "BL"):
            bls.append(s.el(2))
        elif s.tag == "Q5":
            pending.append(s)
    if not container:
        raise EDIError(f"322 {tx.control_no}: missing N7 equipment")
    for q5 in pending:
        code = q5.el(1)
        loc = q5.el(7) or q5.el(6)
        tz = tzs.tz(loc)
        when = _parse_dt(q5.el(2), q5.el(3), tz, q5.el(4))
        et = codes.map(code, eq_status)
        out.append(ContainerEvent(
            container_no=container, type=et, occurred_at=when, source="EDI_322",
            raw_code=code, location=loc, bl_numbers=tuple(bls),
            hold_type=HOLD_CODES.get(code), transmitted_at=tx.transmitted_at,
            source_ref=f"ISA{tx.interchange_control_no}/ST{tx.control_no}/Q5@{q5.index}",
            confidence=0.92 if et != EventType.UNKNOWN else 0.0,
        ))
    return out


def parse_interchange(raw: str, codes: Optional[StatusCodeMap] = None,
                      tzs: Optional[LocationTZ] = None) -> list[ContainerEvent]:
    codes = codes or StatusCodeMap()
    tzs = tzs or LocationTZ()
    events: list[ContainerEvent] = []
    for tx in transactions(raw):
        if tx.set_id == "315":
            events += parse_315(tx, codes, tzs)
        elif tx.set_id == "322":
            events += parse_322(tx, codes, tzs)
    return events


def check_digit_ok(container_no: str) -> bool:
    """ISO 6346 check digit."""
    c = container_no.strip().upper()
    if len(c) != 11 or not c[:4].isalpha() or not c[4:].isdigit():
        return False
    vals = {}
    v = 10
    for ch in "ABCDEFGHIJKLMNOPQRSTUVWXYZ":
        if v % 11 == 0:
            v += 1
        vals[ch] = v
        v += 1
    total = sum((vals[ch] if ch.isalpha() else int(ch)) * (2 ** i) for i, ch in enumerate(c[:10]))
    return (total % 11) % 10 == int(c[10])
