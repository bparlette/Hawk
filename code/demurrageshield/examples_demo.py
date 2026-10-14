"""Run: python examples_demo.py  -> writes examples/sample_packet/"""
from datetime import date
from decimal import Decimal
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).parent))
from tests.test_engine import make_invoice, full_fields, lockout_inputs
from demurrageshield.models import InvoiceField
from demurrageshield.rules import RuleContext, run_all, dispute_deadline
from demurrageshield.lockout import compute
from demurrageshield.packet import ClaimInput, Party, build_packet

inv, issued = make_invoice(full_fields(availability_date=InvoiceField(False, confidence=0.98)))
inv.paid_amount, inv.paid_on = Decimal("1500"), date(2026, 8, 25)
ctx = RuleContext(issued, date(2026, 7, 6), date(2026, 8, 20))
out = Path("examples/sample_packet"); out.mkdir(parents=True, exist_ok=True)
ex = Path("examples/invoice_DD-7754120.pdf"); ex.write_bytes(b"%PDF-1.4 placeholder")
c = ClaimInput("DWC-2026-000418", inv, issued, ["MAEU244118812"], "USBAL (Seagirt Marine Terminal)",
               Party("Acme Imports LLC", "100 Pier Rd, Baltimore, MD 21224", "Jane Doe",
                     "dnd@acme.example", "+1-410-555-0100"),
               "usdisputes@carrier.example", run_all(inv, ctx), [compute(lockout_inputs())],
               dispute_deadline(inv, ctx), exhibits=[("Carrier invoice DD-7754120", ex)], paid=True,
               carrier_request_date=date(2026, 8, 20))
print(build_packet(c, out))
