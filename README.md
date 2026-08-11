# Supplier Invoice Importer

Supplier Invoice Importer is a Frappe app targeting Frappe `version-16` (16.30.0 or newer) and ERPNext `version-16` (16.31.0 or newer).

## Current MVP

- `Supplier Invoice Import` document with supplier, company, warehouse, currency,
  manual exchange rate and payment due date.
- MobiTime `.xlsx` parser for document number, date and item rows.
- Exact matching by ERPNext Item Code, then by Item Barcode.
- New-item and conflict markers before any stock transaction is created.
- SHA-256 duplicate-file protection per supplier.
- UAH and foreign-currency preview totals.
- Confirmed creation of missing stock Items and a draft Purchase Receipt.
- Draft Purchase Invoice mapped from a submitted receipt with a manual due date.
- Confirmed Item Price creation/update in a selected selling price list.
- A4 label print format with one CODE128 barcode label per received unit.

The app never submits stock or accounting documents automatically. Missing Items
and a draft Purchase Receipt are created only after the user confirms the preview.
After the receipt is reviewed and submitted, the app can create its linked draft
Purchase Invoice. Once that invoice is submitted, ERPNext's standard Accounts
Payable reports track the due date, outstanding balance and supplier debt.

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

## License

MIT
