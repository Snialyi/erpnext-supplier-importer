from __future__ import annotations

import hashlib
from decimal import Decimal

import frappe
from frappe import _
from frappe.utils import flt

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
        counts[match_status] += 1
        doc.append("items", {
            **source,
            "item_code": item_code,
            "uom": "Nos" if source["source_uom"].casefold() in {"шт", "шт.", "pcs"} else source["source_uom"],
            "base_rate": source["source_rate"] * rate,
            "base_amount": source["source_amount"] * rate,
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
