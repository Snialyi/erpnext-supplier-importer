from __future__ import annotations

import hashlib
from decimal import Decimal

import frappe
from frappe import _
from frappe.utils import flt, nowdate

from supplier_invoice_importer.parsers.mobitime import InvoiceFormatError, parse_mobitime

MAX_FILE_SIZE = 10 * 1024 * 1024


def _file_bytes(file_url: str) -> bytes:
    if not file_url.lower().endswith(".xlsx"):
        frappe.throw(_("Only .xlsx files are supported."))
    file_name = frappe.db.get_value("File", {"file_url": file_url}, "name")
    if not file_name:
        frappe.throw(_("The attached file could not be found."))
    content = frappe.get_doc("File", file_name).get_content()
    if isinstance(content, str):
        content = content.encode()
    if len(content) > MAX_FILE_SIZE:
        frappe.throw(_("The Excel file must be smaller than 10 MB."))
    return content


def _find_item(code: str, barcode: str | None) -> tuple[str | None, str]:
    by_code = frappe.db.exists("Item", code)
    by_barcode = frappe.db.get_value("Item Barcode", {"barcode": barcode}, "parent") if barcode else None
    if by_code and by_barcode and by_code != by_barcode:
        return None, "Conflict"
    item_code = by_code or by_barcode
    return (item_code, "Existing") if item_code else (None, "New")


def _get_selling_price(item_code: str | None, uom: str, price_list: str | None) -> tuple[float, str | None]:
    """Return the current generic selling price, preferring the row UOM."""
    if not item_code or not price_list:
        return 0.0, None

    values = frappe.db.sql(
        """
        SELECT name, price_list_rate
          FROM `tabItem Price`
         WHERE price_list = %(price_list)s
           AND item_code = %(item_code)s
           AND selling = 1
           AND IFNULL(batch_no, '') = ''
           AND IFNULL(customer, '') = ''
           AND IFNULL(supplier, '') = ''
           AND (IFNULL(uom, '') = '' OR uom = %(uom)s)
           AND (valid_from IS NULL OR valid_from <= %(today)s)
           AND (valid_upto IS NULL OR valid_upto >= %(today)s)
         ORDER BY CASE WHEN uom = %(uom)s THEN 0 ELSE 1 END,
                  valid_from DESC,
                  modified DESC
         LIMIT 1
        """,
        {
            "price_list": price_list,
            "item_code": item_code,
            "uom": uom,
            "today": nowdate(),
        },
        as_dict=True,
    )
    if not values:
        return 0.0, None
    return flt(values[0].price_list_rate), values[0].name


def _get_previous_purchase_rate(
    item_code: str | None,
    supplier: str,
    posting_date: str,
    company: str,
) -> tuple[float, str | None]:
    """Return the latest receipt rate, falling back to a generic buying Item Price."""
    if not item_code:
        return 0.0, None

    values = frappe.db.sql(
        """
        SELECT pri.base_rate, pr.name AS purchase_receipt
          FROM `tabPurchase Receipt Item` pri
          JOIN `tabPurchase Receipt` pr ON pr.name = pri.parent
         WHERE pr.docstatus = 1
           AND pr.supplier = %(supplier)s
           AND pri.item_code = %(item_code)s
           AND pr.posting_date <= %(posting_date)s
         ORDER BY pr.posting_date DESC,
                  pr.posting_time DESC,
                  pr.creation DESC
         LIMIT 1
        """,
        {
            "supplier": supplier,
            "item_code": item_code,
            "posting_date": posting_date,
        },
        as_dict=True,
    )
    if values:
        return flt(values[0].base_rate), values[0].purchase_receipt

    company_currency = frappe.get_cached_value("Company", company, "default_currency")
    buying_prices = frappe.db.sql(
        """
        SELECT name, price_list_rate
          FROM `tabItem Price`
         WHERE item_code = %(item_code)s
           AND buying = 1
           AND currency = %(currency)s
           AND IFNULL(batch_no, '') = ''
           AND IFNULL(customer, '') = ''
           AND IFNULL(supplier, '') = ''
           AND (valid_from IS NULL OR valid_from <= %(posting_date)s)
           AND (valid_upto IS NULL OR valid_upto >= %(posting_date)s)
         ORDER BY modified DESC
         LIMIT 1
        """,
        {
            "item_code": item_code,
            "currency": company_currency,
            "posting_date": posting_date,
        },
        as_dict=True,
    )
    if not buying_prices:
        return 0.0, None
    return flt(buying_prices[0].price_list_rate), None


def _purchase_rate_change(current_rate: float, previous_rate: float, match_status: str) -> tuple[float, str]:
    if match_status == "New":
        return 0.0, "New"
    if previous_rate <= 0:
        return 0.0, "No History"

    change = ((current_rate - previous_rate) / previous_rate) * 100
    if abs(change) < 0.01:
        return 0.0, "Unchanged"
    return change, "Increased" if change > 0 else "Decreased"


@frappe.whitelist()
def analyze_import(name: str) -> dict:
    doc = frappe.get_doc("Supplier Invoice Import", name)
    doc.check_permission("write")
    content = _file_bytes(doc.source_file)
    file_hash = hashlib.sha256(content).hexdigest()
    duplicate = frappe.db.get_value(
        "Supplier Invoice Import",
        {"name": ["!=", doc.name], "supplier": doc.supplier, "file_hash": file_hash},
        "name",
    )
    if duplicate:
        doc.db_set("duplicate_of", duplicate)
        frappe.throw(_("This invoice file was already analyzed in {0}.").format(duplicate))

    try:
        parsed = parse_mobitime(content)
    except InvoiceFormatError as exc:
        doc.db_set("import_status", "Error")
        frappe.throw(str(exc))

    if parsed["document_no"]:
        duplicate_document = frappe.db.get_value(
            "Supplier Invoice Import",
            {
                "name": ["!=", doc.name],
                "supplier": doc.supplier,
                "supplier_invoice_no": parsed["document_no"],
                "supplier_invoice_date": parsed["document_date"],
            },
            "name",
        )
        if duplicate_document:
            doc.db_set("duplicate_of", duplicate_document)
            frappe.throw(
                _("Supplier invoice {0} was already analyzed in {1}.").format(
                    parsed["document_no"], duplicate_document
                )
            )

    rate = Decimal(str(flt(doc.conversion_rate or 1)))
    doc.set("items", [])
    counts = {"Existing": 0, "New": 0, "Conflict": 0}
    for source in parsed["items"]:
        item_code, match_status = _find_item(source["supplier_code"], source["barcode"])
        uom = "Nos" if source["source_uom"].casefold() in {"шт", "шт.", "pcs"} else source["source_uom"]
        selling_price, item_price = _get_selling_price(
            item_code,
            uom,
            doc.selling_price_list,
        )
        base_rate = flt(source["source_rate"] * rate)
        previous_purchase_rate, previous_purchase_receipt = _get_previous_purchase_rate(
            item_code,
            doc.supplier,
            parsed["document_date"] or doc.supplier_invoice_date or nowdate(),
            doc.company,
        )
        purchase_rate_change, purchase_rate_status = _purchase_rate_change(
            base_rate,
            previous_purchase_rate,
            match_status,
        )
        counts[match_status] += 1
        doc.append("items", {
            **source,
            "item_code": item_code,
            "uom": uom,
            "base_rate": base_rate,
            "base_amount": source["source_amount"] * rate,
            "previous_purchase_rate": previous_purchase_rate,
            "previous_purchase_receipt": previous_purchase_receipt,
            "purchase_rate_change": purchase_rate_change,
            "purchase_rate_status": purchase_rate_status,
            "selling_price": selling_price,
            "item_price": item_price,
            "match_status": match_status,
            "create_item": match_status == "New",
            "error_message": _("Code and barcode point to different items.") if match_status == "Conflict" else None,
        })

    doc.file_hash = file_hash
    doc.duplicate_of = None
    doc.supplier_invoice_no = parsed["document_no"] or doc.supplier_invoice_no
    doc.supplier_invoice_date = parsed["document_date"] or doc.supplier_invoice_date
    doc.import_status = "Ready" if not counts["Conflict"] else "Analyzed"
    doc.save()
    frappe.msgprint(
        _("Excel analyzed: {0} lines, {1} existing items, {2} new items.").format(
            len(parsed["items"]), counts["Existing"], counts["New"]
        ), indicator="green" if not counts["Conflict"] else "orange"
    )
    return {"name": doc.name, "status": doc.import_status, "counts": counts}
