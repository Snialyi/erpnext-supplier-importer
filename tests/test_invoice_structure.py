import ast
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
API = ROOT / "supplier_invoice_importer" / "api" / "create_invoice.py"


class InvoiceStructureTestCase(unittest.TestCase):
    def test_invoice_api_is_whitelisted(self):
        tree = ast.parse(API.read_text(encoding="utf-8"))
        functions = {node.name: node for node in tree.body if isinstance(node, ast.FunctionDef)}
        method = functions["create_draft_purchase_invoice"]
        self.assertIn("frappe.whitelist()", [ast.unparse(item) for item in method.decorator_list])

    def test_uses_official_receipt_mapper_and_never_submits(self):
        source = API.read_text(encoding="utf-8")
        self.assertIn("make_purchase_invoice(receipt.name)", source)
        self.assertIn("invoice.insert()", source)
        self.assertNotIn("invoice.submit()", source)

    def test_requires_submitted_receipt_and_sets_due_date(self):
        source = API.read_text(encoding="utf-8")
        self.assertIn("receipt.docstatus != 1", source)
        self.assertIn("invoice.due_date = import_doc.payment_due_date", source)
        self.assertIn('invoice.set("payment_schedule", [])', source)


if __name__ == "__main__":
    unittest.main()
