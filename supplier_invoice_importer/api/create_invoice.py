from __future__ import annotations

import frappe
from frappe import _
from frappe.utils import getdate


@frappe.whitelist()
def create_draft_purchase_invoice(name: str) -> dict:
    import_doc = frappe.get_doc("Supplier Invoice Import", name)
    import_doc.check_permission("write")

    if import_doc.purchase_invoice:
        frappe.throw(
            _("A Purchase Invoice has already been created: {0}.").format(
                import_doc.purchase_invoice
            )
        )
    if not import_doc.purchase_receipt:
        frappe.throw(_("Create the Purchase Receipt first."))
    if not import_doc.payment_due_date:
        frappe.throw(_("Enter the supplier payment due date first."))
    if not import_doc.supplier_invoice_no:
        frappe.throw(_("Supplier Invoice No is required."))

    receipt = frappe.get_doc("Purchase Receipt", import_doc.purchase_receipt)
    if receipt.docstatus != 1:
        frappe.throw(
            _("Review and submit Purchase Receipt {0} before creating its invoice.").format(
                receipt.name
            )
        )
    if getdate(import_doc.payment_due_date) < getdate(receipt.posting_date):
        frappe.throw(_("Payment Due Date cannot be earlier than the receipt date."))

    duplicate = frappe.db.get_value(
        "Purchase Invoice",
        {
            "supplier": import_doc.supplier,
            "bill_no": import_doc.supplier_invoice_no,
            "docstatus": ["<", 2],
        },
        "name",
    )
    if duplicate:
        frappe.throw(
            _("Supplier invoice {0} already exists as Purchase Invoice {1}.").format(
                import_doc.supplier_invoice_no, duplicate
            )
        )

    from erpnext.stock.doctype.purchase_receipt.purchase_receipt import make_purchase_invoice

    invoice = make_purchase_invoice(receipt.name)
    invoice.bill_no = import_doc.supplier_invoice_no
    invoice.bill_date = import_doc.supplier_invoice_date or receipt.posting_date
    invoice.posting_date = import_doc.supplier_invoice_date or receipt.posting_date
    invoice.due_date = import_doc.payment_due_date
    invoice.payment_terms_template = None
    invoice.set("payment_schedule", [])
    invoice.append("payment_schedule", {
        "due_date": import_doc.payment_due_date,
        "invoice_portion": 100,
        "payment_amount": invoice.grand_total,
        "base_payment_amount": invoice.base_grand_total,
        "outstanding": invoice.grand_total,
        "base_outstanding": invoice.base_grand_total,
    })
    invoice.insert()

    import_doc.purchase_invoice = invoice.name
    import_doc.import_status = "Draft Invoice Created"
    import_doc.save()
    frappe.msgprint(
        _("Draft Purchase Invoice {0} created with due date {1}.").format(
            invoice.name, import_doc.payment_due_date
        ),
        indicator="green",
    )
    return {"purchase_invoice": invoice.name, "due_date": import_doc.payment_due_date}
