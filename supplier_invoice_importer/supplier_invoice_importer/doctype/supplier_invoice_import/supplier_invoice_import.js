function paint_purchase_rate_changes(frm) {
  const colors = {
    Increased: "#ffe3e3",
    Decreased: "#e6f7e9",
    New: "#fff6d8",
    "No History": "#fff6d8",
  };
  const grid = frm.fields_dict.items && frm.fields_dict.items.grid;
  if (!grid) return;
  grid.grid_rows.forEach((grid_row) => {
    let color = colors[grid_row.doc.purchase_rate_status] || "";
    if (!color && grid_row.doc.purchase_rate_source === "Valuation Rate") {
      color = "#e7f3ff";
    }
    grid_row.wrapper
      .find(".data-row, .grid-static-col, .grid-row-check")
      .css("background-color", color);
  });
}

function expand_import_form(frm) {
  frm.page.wrapper.addClass("sii-expanded-form");
  const sidebar_wrapper = frm.sidebar && frm.sidebar.sidebar
    ? frm.sidebar.sidebar.parent()
    : frm.page.sidebar;
  if (sidebar_wrapper && sidebar_wrapper.length && sidebar_wrapper.is(":visible")) {
    sidebar_wrapper.hide();
    $(document.body).trigger("toggleSidebar");
  }
  setup_sidebar_arrow(frm, sidebar_wrapper);
}

function setup_sidebar_arrow(frm, sidebar_wrapper) {
  if (!sidebar_wrapper || !sidebar_wrapper.length) return;
  let button = frm.page.wrapper.find(".sii-sidebar-toggle");
  if (!button.length) {
    button = $('<button type="button" class="sii-sidebar-toggle" aria-label="Показати бічну панель"></button>')
      .appendTo(frm.page.wrapper)
      .on("click", () => {
        frm.toolbar.setup_sidebar_toggle(sidebar_wrapper);
        setTimeout(() => update_sidebar_arrow(button, sidebar_wrapper), 50);
      });
  }
  update_sidebar_arrow(button, sidebar_wrapper);
}

function update_sidebar_arrow(button, sidebar_wrapper) {
  const is_open = sidebar_wrapper.is(":visible");
  button
    .html(frappe.utils.icon(is_open ? "right" : "left", "sm"))
    .attr("aria-label", is_open ? "Сховати бічну панель" : "Показати бічну панель")
    .attr("title", is_open ? "Сховати бічну панель" : "Показати бічну панель")
    .toggleClass("sidebar-open", is_open);
}

function show_all_items_in_scroll(frm) {
  const grid = frm.fields_dict.items && frm.fields_dict.items.grid;
  if (!grid || !grid.grid_pagination) return;
  const page_length = Math.max(grid.data.length, 50);
  if (grid.grid_pagination.page_length !== page_length) {
    grid.grid_pagination.page_length = page_length;
    grid.grid_pagination.page_index = 1;
    grid.grid_pagination.total_pages = 1;
    grid.grid_pagination.go_to_page(1, true);
  }
  grid.wrapper.find(".grid-pagination").hide();
}

function localize_item_grid(frm) {
  const grid = frm.fields_dict.items && frm.fields_dict.items.grid;
  if (!grid) return;
  const status_field = grid.get_field("match_status");
  if (status_field) {
    const labels = {
      Existing: "Існуючий",
      New: "Новий",
      Conflict: "Конфлікт",
      Error: "Помилка",
    };
    status_field.formatter = (value) => labels[value] || value;
  }
}

frappe.ui.form.on("Supplier Invoice Import", {
  refresh(frm) {
    expand_import_form(frm);
    localize_item_grid(frm);
    show_all_items_in_scroll(frm);
    paint_purchase_rate_changes(frm);
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
    if (!frm.is_new() && frm.doc.purchase_receipt) {
      frm.add_custom_button(__("Save Selling Prices"), () => {
        frm.save().then(() => frappe.confirm(
          __("Create new Item Prices and update existing prices for all rows where Selling Price is greater than zero?"),
          () => frappe.call({
            method: "supplier_invoice_importer.api.selling_prices.save_selling_prices",
            args: { name: frm.doc.name },
            freeze: true,
            freeze_message: __("Saving selling prices..."),
            callback: () => frm.reload_doc(),
          })
        ));
      }, __("Actions"));
    }
    if (!frm.is_new() && frm.doc.items && frm.doc.items.length) {
      frm.add_custom_button(__("Print Imported Item Labels"), () => {
        const query = new URLSearchParams({
          doctype: "Supplier Invoice Import",
          name: frm.doc.name,
          format: "Imported Item Labels",
          no_letterhead: "1",
        });
        window.open(`/printview?${query.toString()}`, "_blank");
      }, __("Actions"));
    }
  },
  items_on_form_rendered(frm) {
    show_all_items_in_scroll(frm);
    paint_purchase_rate_changes(frm);
  },
  setup(frm) {
    $(frm.wrapper).on("grid-row-render.purchase-rate-colors", (event, grid_row) => {
      if (grid_row.grid.df.fieldname === "items") {
        show_all_items_in_scroll(frm);
        paint_purchase_rate_changes(frm);
      }
    });
  },
});

frappe.ui.form.on("Supplier Invoice Import Item", {
  form_render(frm) {
    paint_purchase_rate_changes(frm);
  },
});
