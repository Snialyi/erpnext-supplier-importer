import frappe
from frappe.model.document import Document
from frappe.utils import flt


class SupplierInvoiceImport(Document):
    def validate(self):
        if self.currency != "UAH" and flt(self.conversion_rate) <= 0:
            frappe.throw("Для валютної накладної вкажіть курс більше нуля.")
        if self.currency == "UAH":
            self.conversion_rate = 1

        self.total_lines = len(self.items)
        self.total_qty = sum(flt(row.qty) for row in self.items)
        self.total_amount = sum(flt(row.source_amount) for row in self.items)
        self.base_total_amount = sum(flt(row.base_amount) for row in self.items)
