import ast
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
API = ROOT / "supplier_invoice_importer" / "api" / "create_receipt.py"


class ReceiptStructureTestCase(unittest.TestCase):
    def test_creation_api_is_syntactically_valid_and_whitelisted(self):
        source = API.read_text(encoding="utf-8")
        tree = ast.parse(source)
        functions = {node.name: node for node in tree.body if isinstance(node, ast.FunctionDef)}
        method = functions["create_draft_purchase_receipt"]
        decorators = [ast.unparse(item) for item in method.decorator_list]
        self.assertIn("frappe.whitelist()", decorators)

    def test_receipt_is_inserted_but_never_submitted(self):
        source = API.read_text(encoding="utf-8")
        self.assertIn('frappe.new_doc("Purchase Receipt")', source)
        self.assertIn("receipt.set_missing_values()", source)
        self.assertIn("receipt.insert()", source)
        self.assertNotIn("receipt.submit()", source)

    def test_item_creation_rechecks_code_and_barcode(self):
        source = API.read_text(encoding="utf-8")
        self.assertIn('frappe.db.exists("Item", row.supplier_code)', source)
        self.assertIn('frappe.db.get_value("Item Barcode"', source)


if __name__ == "__main__":
    unittest.main()
