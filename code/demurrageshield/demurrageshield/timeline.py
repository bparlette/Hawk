"""Container timeline builder and state-machine timestamp auditor.

The auditor replays every event for a container through an allowed-transition graph
and flags anything a carrier could use to inflate chargeable days, or that would make
our own math wrong: out-of-order events, impossible transitions, backdated
transmissions, duplicates, conflicting sources, and future-dated events.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional

from .models import ContainerEvent, Direction, EventType as E, Finding

# Source precedence: higher wins when two sources report the same event type.
SOURCE_RANK = {"EIR": 9, "TERMINAL_PORTAL": 8, "EDI_322": 7, "DCSA_API": 6, "EDI_315": 5,
               "GPS_GEOFENCE": 4, "CARRIER_PORTAL": 3, "INVOICE_STATED": 2, "USER": 1}

# Lifecycle states (holds are an overlay, not a state)
IMPORT_ORDER = [E.VESSEL_ARRIVED, E.DISCHARGED, E.AVAILABLE, E.GATE_OUT_FULL, E.DELIVERED, E.GATE_IN_EMPTY]
EXPORT_ORDER = [E.EMPTY_DISPATCHED, E.GATE_IN_FULL, E.LOADED, E.VESSEL_DEPARTED]

IMPORT_NEXT = {
    None: {E.VESSEL_ARRIVED, E.DISCHARGED},
    E.VESSEL_ARRIVED: {E.DISCHARGED},
    E.DISCHARGED: {E.AVAILABLE, E.GATE_OUT_FULL},   # some terminals skip AV
    E.AVAILABLE: {E.GATE_OUT_FULL},
    E.GATE_OUT_FULL: {E.DELIVERED, E.GATE_IN_EMPTY},
    E.DELIVERED: {E.GATE_IN_EMPTY},
    E.GATE_IN_EMPTY: set(),
}
EXPORT_NEXT = {
    None: {E.EMPTY_DISPATCHED, E.GATE_IN_FULL},
    E.EMPTY_DISPATCHED: {E.GATE_IN_FULL},
    E.GATE_IN_FULL: {E.LOADED},
    E.LOADED: {E.VESSEL_DEPARTED},
    E.VESSEL_DEPARTED: set(),
}
OVERLAY = {E.HOLD_PLACED, E.HOLD_RELEASED, E.UNKNOWN}

CONFLICT_TOLERANCE = timedelta(hours=4)
BACKDATE_TOLERANCE = timedelta(hours=72)


@dataclass
class Interval:
    start: datetime
    end: Optional[datetime]
    kind: str
    ref: str


@dataclass
class Timeline:
    container_no: str
    direction: Direction
    milestones: dict[E, ContainerEvent] = field(default_factory=dict)
    holds: list[Interval] = field(default_factory=list)
    all_events: list[ContainerEvent] = field(default_factory=list)
    findings: list[Finding] = field(default_factory=list)

    def at(self, t: E) -> Optional[datetime]:
        ev = self.milestones.get(t)
        return ev.occurred_at if ev else None


def build_timeline(container_no: str, direction: Direction, events: list[ContainerEvent],
                   now: Optional[datetime] = None) -> Timeline:
    tl = Timeline(container_no, direction)
    evs = sorted((e for e in events if e.container_no == container_no),
                 key=lambda e: (e.occurred_at, -SOURCE_RANK.get(e.source, 0)))
    tl.all_events = evs
    order = IMPORT_ORDER if direction == Direction.IMPORT else EXPORT_ORDER
    graph = IMPORT_NEXT if direction == Direction.IMPORT else EXPORT_NEXT

    # ---- 1. resolve each milestone across sources, flag conflicts and duplicates
    by_type: dict[E, list[ContainerEvent]] = {}
    for e in evs:
        by_type.setdefault(e.type, []).append(e)
    for t, group in by_type.items():
        if t in OVERLAY:
            continue
        best = max(group, key=lambda e: (SOURCE_RANK.get(e.source, 0), e.confidence))
        tl.milestones[t] = best
        for other in group:
            if other is best:
                continue
            delta = abs(other.occurred_at - best.occurred_at)
            if other.source == best.source and delta == timedelta(0):
                tl.findings.append(_f("T_DUPLICATE", "INFO", f"Duplicate {t.value} from {other.source}",
                                      container_no, [other.source_ref]))
            elif delta > CONFLICT_TOLERANCE:
                tl.findings.append(_f("T_SOURCE_CONFLICT", "REVIEW",
                    f"{t.value}: {best.source} says {best.occurred_at.isoformat()}, "
                    f"{other.source} says {other.occurred_at.isoformat()} ({delta} apart)",
                    container_no, [best.source_ref, other.source_ref], needs_human=True))

    # ---- 2. replay milestones through the state machine
    state = None
    seq = sorted((tl.milestones[t] for t in order if t in tl.milestones), key=lambda e: e.occurred_at)
    for e in seq:
        allowed = graph.get(state, set())
        if e.type not in allowed:
            expected = order.index(e.type) if e.type in order else -1
            prior = order.index(state) if state in order else -1
            if expected < prior:
                tl.findings.append(_f("T_OUT_OF_ORDER", "REVIEW",
                    f"{e.type.value} at {e.occurred_at.isoformat()} precedes {state.value if state else 'start'} "
                    f"in time but must follow it", container_no, [e.source_ref], needs_human=True))
            else:
                skipped = [s.value for s in order[prior + 1:expected]]
                if skipped and not (state == E.DISCHARGED and e.type == E.GATE_OUT_FULL):
                    tl.findings.append(_f("T_MISSING_MILESTONE", "REVIEW",
                        f"Jumped from {state.value if state else 'start'} to {e.type.value}; missing {skipped}",
                        container_no, [e.source_ref], needs_human=True))
        state = e.type

    # Monotonic check on the canonical order (catches out-of-order even if sorted)
    for a, b in zip(order, order[1:]):
        ta, tb = tl.at(a), tl.at(b)
        if ta and tb and tb < ta:
            tl.findings.append(_f("T_NEGATIVE_INTERVAL", "REVIEW",
                f"{b.value} ({tb.isoformat()}) is earlier than {a.value} ({ta.isoformat()})",
                container_no, [tl.milestones[a].source_ref, tl.milestones[b].source_ref], needs_human=True))

    # ---- 3. timestamp integrity
    for e in evs:
        if now and e.occurred_at > now + timedelta(hours=1):
            tl.findings.append(_f("T_FUTURE_EVENT", "REVIEW", f"{e.type.value} dated in the future",
                                  container_no, [e.source_ref], needs_human=True))
        if e.transmitted_at and e.transmitted_at - e.occurred_at > BACKDATE_TOLERANCE:
            tl.findings.append(_f("T_LATE_REPORTED", "INFO",
                f"{e.type.value} reported {(e.transmitted_at - e.occurred_at).days} days after it occurred; "
                f"verify against terminal records", container_no, [e.source_ref]))
        if e.type == E.UNKNOWN:
            tl.findings.append(_f("T_UNMAPPED_CODE", "INFO", f"Unmapped status code '{e.raw_code}'",
                                  container_no, [e.source_ref]))

    # ---- 4. hold intervals (placed .. released), by hold type
    open_holds: dict[str, ContainerEvent] = {}
    for e in evs:
        key = e.hold_type or "UNSPECIFIED"
        if e.type == E.HOLD_PLACED:
            open_holds.setdefault(key, e)
        elif e.type == E.HOLD_RELEASED and key in open_holds:
            p = open_holds.pop(key)
            tl.holds.append(Interval(p.occurred_at, e.occurred_at, key, p.source_ref))
    for key, p in open_holds.items():
        tl.holds.append(Interval(p.occurred_at, None, key, p.source_ref))
    return tl


def _f(rule, sev, msg, cno, ev, needs_human=False) -> Finding:
    return Finding(rule_id=rule, category="TIMELINE", severity=sev, citation="Data integrity",
                   message=msg, container_no=cno, evidence=ev, needs_human=needs_human)
