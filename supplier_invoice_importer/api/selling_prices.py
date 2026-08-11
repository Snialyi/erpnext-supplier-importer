from __future__ import annotations

import frappe
from frappe import _
from frappe.utils import flt, nowdate


@frappe.whitelist()
def save_selling_prices(name: str) -> dict:
    import_doc = frappe.get_doc("Supplier Invoice Import", name)
    import_doc.check_permission("write")
    if not import_doc.selling_price_list:
        frappe.throw(_("Select a Selling Price List first."))

    price_list = frappe.get_doc("Price List", import_doc.selling_price_list)
    if not price_list.selling:
        frappe.throw(_("The selected Price List is not a selling price list."))
    if not price_list.currency:
        frappe.throw(_("The selected Price List has no currency."))

    created = 0
    updated = 0
    skipped = 0
    for row in import_doc.items:
        if flt(row.selling_price) <= 0:
            skipped += 1
            continue
        if not row.item_code or not frappe.db.exists("Item", row.item_code):
            frappe.throw(
                _("Row {0}: create or match the Item before setting its selling price.").format(
                    row.row_no
                )
            )

        existing = frappe.db.get_value(
            "Item Price",
            {
                "price_list": price_list.name,
                "item_code": row.item_code,
                "uom": row.uom,
                "batch_no": ["is", "not set"],
            },
            "name",
        )
        if not existing:
            existing = frappe.db.get_value(
                "Item Price",
                {
                    "price_list": price_list.name,
                    "item_code": row.item_code,
                    "uom": ["is", "not set"],
                    "batch_no": ["is", "not set"],
                },
                "name",
            )
        if existing:
            item_price = frappe.get_doc("Item Price", existing)
            item_price.check_permission("write")
            item_price.price_list_rate = row.selling_price
            item_price.currency = price_list.currency
            item_price.save()
            updated += 1
        else:
            item_price = frappe.new_doc("Item Price")
            item_price.price_list = price_list.name
            item_price.selling = 1
            item_price.currency = price_list.currency
            item_price.item_code = row.item_code
            item_price.uom = row.uom
            item_price.price_list_rate = row.selling_price
            item_price.valid_from = nowdate()
            item_price.insert()
            created += 1
        row.item_price = item_price.name

    import_doc.save()
    frappe.msgprint(
        _("Selling prices saved. Created: {0}, updated: {1}, skipped: {2}.").format(
            created, updated, skipped
        ),
        indicator="green",
    )
    return {"created": created, "updated": updated, "skipped": skipped}
