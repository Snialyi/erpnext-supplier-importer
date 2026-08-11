frappe.ui.form.on("Supplier Invoice Import", {
  refresh(frm) {
    if (!frm.is_new() && frm.doc.source_file) {
      frm.add_custom_button(__("Analyze Excel"), () => {
        frappe.call({
          method: "supplier_invoice_importer.api.import_preview.analyze_import",
          args: { name: frm.doc.name },
          freeze: true,
          freeze_message: __("Analyzing supplier invoice..."),
          callback: () => frm.reload_doc(),
        });
      });
    }
    if (!frm.is_new() && frm.doc.import_status === "Ready" && !frm.doc.purchase_receipt) {
      frm.add_custom_button(__("Create Draft Purchase Receipt"), () => {
        frappe.confirm(
          __("Create missing Items and a draft Purchase Receipt? Stock will not change until you review and submit the receipt."),
          () => frappe.call({
            method: "supplier_invoice_importer.api.create_receipt.create_draft_purchase_receipt",
            args: { name: frm.doc.name },
            freeze: true,
            freeze_message: __("Creating Items and draft Purchase Receipt..."),
            callback: (response) => {
              frm.reload_doc();
              if (response.message && response.message.purchase_receipt) {
                frappe.set_route("Form", "Purchase Receipt", response.message.purchase_receipt);
              }
            },
          })
        );
      }, __("Actions"));
    }
    if (!frm.is_new() && frm.doc.purchase_receipt && !frm.doc.purchase_invoice) {
      frm.add_custom_button(__("Create Draft Purchase Invoice"), () => {
        frappe.confirm(
          __("Create a draft Purchase Invoice with the entered payment due date? The Purchase Receipt must already be submitted."),
          () => frappe.call({
            method: "supplier_invoice_importer.api.create_invoice.create_draft_purchase_invoice",
            args: { name: frm.doc.name },
            freeze: true,
            freeze_message: __("Creating draft Purchase Invoice..."),
            callback: (response) => {
              frm.reload_doc();
              if (response.message && response.message.purchase_invoice) {
                frappe.set_route("Form", "Purchase Invoice", response.message.purchase_invoice);
              }
            },
          })
        );
      }, __("Actions"));
    }
  },
});
