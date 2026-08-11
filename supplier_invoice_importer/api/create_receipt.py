from __future__ import annotations

import frappe
from frappe import _
from frappe.utils import flt, nowdate


def _ensure_uom(uom: str) -> None:
    if not frappe.db.exists("UOM", uom):
        frappe.throw(_("Unit of Measure {0} does not exist in ERPNext.").format(uom))


def _resolve_or_create_item(row, item_group: str) -> tuple[str, bool]:
    """Resolve again at execution time to avoid creating a race-condition duplicate."""
    by_code = frappe.db.exists("Item", row.supplier_code)
    by_barcode = (
        frappe.db.get_value("Item Barcode", {"barcode": row.barcode}, "parent")
        if row.barcode else None
    )
    if by_code and by_barcode and by_code != by_barcode:
        frappe.throw(
            _("Row {0}: code and barcode now point to different Items.").format(row.row_no)
        )
    existing = by_code or by_barcode or row.item_code
    if existing:
        return existing, False
    if not row.create_item:
        frappe.throw(
            _("Row {0}: Item {1} is missing and is not marked for creation.").format(
                row.row_no, row.supplier_code
            )
        )

    _ensure_uom(row.uom)
    item = frappe.new_doc("Item")
    item.item_code = row.supplier_code
    item.item_name = row.item_name
    item.item_group = item_group
    item.stock_uom = row.uom
    item.is_stock_item = 1
    if row.barcode:
        item.append("barcodes", {"barcode": row.barcode, "uom": row.uom})
    item.insert()
    return item.name, True


@frappe.whitelist()
def create_draft_purchase_receipt(name: str) -> dict:
    import_doc = frappe.get_doc("Supplier Invoice Import", name)
    import_doc.check_permission("write")

    if import_doc.purchase_receipt:
        frappe.throw(
            _("A Purchase Receipt has already been created: {0}.").format(
                import_doc.purchase_receipt
            )
        )
    if import_doc.import_status != "Ready" or not import_doc.items:
        frappe.throw(_("Analyze the Excel file and resolve all conflicts first."))
    if not import_doc.default_item_group:
        frappe.throw(_("Select the Item Group for new Items."))
    if not frappe.db.exists("Item Group", import_doc.default_item_group):
        frappe.throw(_("The selected Item Group does not exist."))
    if frappe.db.get_value("Item Group", import_doc.default_item_group, "is_group"):
        frappe.throw(_("Select a lowest-level Item Group, not a parent group."))
    warehouse = frappe.db.get_value(
        "Warehouse", import_doc.warehouse, ["company", "is_group"], as_dict=True
    )
    if not warehouse or warehouse.is_group:
        frappe.throw(_("Select a valid non-group Warehouse."))
    if warehouse.company and warehouse.company != import_doc.company:
        frappe.throw(_("The selected Warehouse belongs to another Company."))
    if flt(import_doc.conversion_rate) <= 0:
        frappe.throw(_("Exchange Rate must be greater than zero."))

    receipt = frappe.new_doc("Purchase Receipt")
    receipt.supplier = import_doc.supplier
    receipt.company = import_doc.company
    receipt.posting_date = import_doc.supplier_invoice_date or nowdate()
    receipt.supplier_delivery_note = import_doc.supplier_invoice_no
    receipt.set_warehouse = import_doc.warehouse

    created_items = []
    for row in import_doc.items:
        if row.match_status == "Conflict":
            frappe.throw(_("Resolve the conflict in Excel row {0} first.").format(row.row_no))
        item_code, was_created = _resolve_or_create_item(row, import_doc.default_item_group)
        if was_created:
            created_items.append(item_code)
        receipt.append("items", {
            "item_code": item_code,
            "item_name": row.item_name,
            "qty": row.qty,
            "received_qty": row.qty,
            "uom": row.uom,
            "stock_uom": row.uom,
            "conversion_factor": 1,
            "rate": row.source_rate,
            "amount": row.source_amount,
            "warehouse": import_doc.warehouse,
        })

    # Populate ERPNext-controlled defaults such as supplier details and accounts.
    receipt.set_missing_values()
    # The supplier file is authoritative for document currency, manual rate and prices.
    receipt.currency = import_doc.currency
    receipt.conversion_rate = import_doc.conversion_rate
    receipt.price_list_currency = import_doc.currency
    receipt.plc_conversion_rate = 1
    for receipt_row, source_row in zip(receipt.items, import_doc.items):
        receipt_row.qty = source_row.qty
        receipt_row.received_qty = source_row.qty
        receipt_row.rate = source_row.source_rate
        receipt_row.amount = source_row.source_amount
    receipt.insert()
    import_doc.purchase_receipt = receipt.name
    import_doc.import_status = "Draft Receipt Created"
    for row in import_doc.items:
        if row.supplier_code in created_items:
            row.item_code = row.supplier_code
            row.match_status = "Existing"
    import_doc.save()

    frappe.msgprint(
        _("Draft Purchase Receipt {0} created. New Items: {1}.").format(
            receipt.name, len(created_items)
        ),
        indicator="green",
    )
    return {
        "purchase_receipt": receipt.name,
        "created_items": created_items,
        "created_item_count": len(created_items),
    }
