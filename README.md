# Supplier Invoice Importer

Supplier Invoice Importer is a Frappe app targeting Frappe `version-16` (16.30.0 or newer) and ERPNext `version-16` (16.31.0 or newer).

## Planned features

- Import supplier invoice data from Excel workbooks.
- Create missing Item records when requested.
- Create Purchase Receipts and Purchase Invoices.
- Support document currencies and manually supplied exchange rates.
- Update selling prices from imported data.
- Generate barcode labels.
- Protect against duplicate imports and duplicate documents.

## Installation

From a bench configured for Frappe/ERPNext version 16:

```bash
bench get-app https://github.com/Snialyi/erpnext-supplier-importer.git --branch main
bench --site your-site.local install-app supplier_invoice_importer
```

This repository currently contains the installable application scaffold only. Business features will be added in later versions.

## License

MIT

