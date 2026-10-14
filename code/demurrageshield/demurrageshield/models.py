from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Any, Optional


class Direction(str, Enum):
    IMPORT = "IMPORT"
    EXPORT = "EXPORT"


class BillingPartyKind(str, Enum):
    VOCC = "VOCC"      # vessel-operating common carrier
    NVOCC = "NVOCC"    # non-vessel-operating common carrier
    MTO = "MTO"        # marine terminal operator


class EventType(str, Enum):
    VESSEL_ARRIVED = "VESSEL_ARRIVED"
    DISCHARGED = "DISCHARGED"
    AVAILABLE = "AVAILABLE"
    HOLD_PLACED = "HOLD_PLACED"
    HOLD_RELEASED = "HOLD_RELEASED"
    GATE_OUT_FULL = "GATE_OUT_FULL"
    DELIVERED = "DELIVERED"
    GATE_IN_EMPTY = "GATE_IN_EMPTY"
    EMPTY_DISPATCHED = "EMPTY_DISPATCHED"   # export: empty picked up
    GATE_IN_FULL = "GATE_IN_FULL"           # export: full returned to terminal
    LOADED = "LOADED"
    VESSEL_DEPARTED = "VESSEL_DEPARTED"
    UNKNOWN = "UNKNOWN"


@dataclass(frozen=True)
class ContainerEvent:
    container_no: str
    type: EventType
    occurred_at: datetime              # timezone-aware, port-local
    source: str                        # "EDI_315", "EDI_322", "TERMINAL_PORTAL", ...
    raw_code: str = ""
    location: str = ""                 # UN/LOCODE or facility code
    bl_numbers: tuple[str, ...] = ()
    hold_type: Optional[str] = None    # CUSTOMS, FREIGHT, LINE, TERMINAL, USDA, ...
    transmitted_at: Optional[datetime] = None
    source_ref: str = ""               # interchange control no. + segment index
    confidence: float = 0.9


@dataclass
class InvoiceField:
    present: bool
    value: Any = None
    page: Optional[int] = None
    confidence: float = 1.0
    via_url: bool = False              # element provided only on a linked page


@dataclass
class InvoiceLine:
    container_no: str
    charge_type: str                   # DEMURRAGE | DETENTION | COMBINED | PER_DIEM
    charged_dates: list[date]
    rate_by_date: dict[date, Decimal]
    amount: Decimal


@dataclass
class Invoice:
    invoice_no: str
    billing_party_name: str
    billing_party_kind: BillingPartyKind
    billing_party_scac: Optional[str]
    billed_party_name: str
    direction: Direction
    fields: dict[str, InvoiceField]
    lines: list[InvoiceLine]
    first_received_at: Optional[datetime] = None   # when it actually reached the billed party
    upstream_invoice_date: Optional[date] = None   # NVOCC pass-through, 541.7(b)
    paid_amount: Decimal = Decimal("0")
    paid_on: Optional[date] = None

    def f(self, key: str) -> InvoiceField:
        return self.fields.get(key, InvoiceField(present=False))

    @property
    def total(self) -> Decimal:
        return sum((l.amount for l in self.lines), Decimal("0"))


@dataclass
class Finding:
    rule_id: str
    category: str          # CONTENT | TIMING | WINDOW | MATH | TIMELINE | LOCKOUT
    severity: str          # VOIDS_INVOICE | VOIDS_LINE | REDUCES | REVIEW | INFO
    citation: str
    message: str
    amount_at_issue: Decimal = Decimal("0")
    container_no: Optional[str] = None
    evidence: list[str] = field(default_factory=list)
    confidence: float = 1.0
    needs_human: bool = False
