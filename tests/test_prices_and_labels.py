import ast
import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
API = ROOT / "supplier_invoice_importer" / "api" / "selling_prices.py"
PRINT_FORMAT = ROOT / "supplier_invoice_importer" / "supplier_invoice_importer" / "print_format" / "imported_item_labels" / "imported_item_labels.json"


class PricesAndLabelsTestCase(unittest.TestCase):
    def test_price_api_is_whitelisted_and_upserts_item_price(self):
        source = API.read_text(encoding="utf-8")
        tree = ast.parse(source)
        method = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == "save_selling_prices")
        self.assertIn("frappe.whitelist()", [ast.unparse(item) for item in method.decorator_list])
        self.assertIn('frappe.new_doc("Item Price")', source)
        self.assertIn('frappe.get_doc("Item Price", existing)', source)

    def test_label_format_is_standard_jinja_with_code128(self):
        print_format = json.loads(PRINT_FORMAT.read_text(encoding="utf-8"))
        self.assertEqual(print_format["doc_type"], "Supplier Invoice Import")
        self.assertEqual(print_format["print_format_type"], "Jinja")
        self.assertEqual(print_format["standard"], "Yes")
        self.assertIn('jsbarcode-format="CODE128"', print_format["html"])
        self.assertIn("range(row.qty|int)", print_format["html"])


if __name__ == "__main__":
    unittest.main()
