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
  if (sidebar_wrapper && sidebar_wrapper.length) {
    sidebar_wrapper.show().addClass("sii-form-sidebar-compact");
    keep_form_sidebar_available(sidebar_wrapper);
  }
  frm.page.wrapper.find(".sii-sidebar-toggle").remove();
  setup_compact_desk_sidebar();
}

function keep_form_sidebar_available(sidebar_wrapper) {
  if (sidebar_wrapper.data("sii-visibility-observer")) return;
  const observer = new MutationObserver(() => {
    if (!sidebar_wrapper.is(":visible")) {
      sidebar_wrapper.show().addClass("sii-form-sidebar-compact");
    }
  });
  observer.observe(sidebar_wrapper.get(0), { attributes: true, attributeFilter: ["class", "style"] });
  sidebar_wrapper.data("sii-visibility-observer", observer);
}

function setup_compact_desk_sidebar() {
  const desk_sidebar = $(".body-sidebar-container");
  if (!desk_sidebar.length) return;
  desk_sidebar.addClass("sii-auto-compact");
  if (frappe.app && frappe.app.sidebar && frappe.app.sidebar.sidebar_expanded) {
    frappe.app.sidebar.close();
  }
}

function get_saved_grid_widths() {
  try {
    return JSON.parse(localStorage.getItem("sii-item-column-widths") || "{}");
  } catch (error) {
    return {};
  }
}

function apply_grid_column_width(grid, column_index, width) {
  grid.wrapper.find(`.grid-row > .grid-static-col:nth-child(${column_index + 1})`).css({
    width: `${width}px`,
    minWidth: `${width}px`,
    maxWidth: `${width}px`,
    flex: `0 0 ${width}px`,
  });
}

function setup_resizable_item_columns(frm) {
  const grid = frm.fields_dict.items && frm.fields_dict.items.grid;
  if (!grid) return;
  const widths = get_saved_grid_widths();
  Object.entries(widths).forEach(([column_index, width]) => {
    apply_grid_column_width(grid, Number(column_index), width);
  });

  grid.wrapper
    .find(".grid-heading-row .grid-row > .grid-static-col")
    .each((index, element) => {
      const column = $(element);
      if (column.find(".sii-column-resizer").length) return;
      if (index === 0 || column.hasClass("row-index")) return;
      $('<span class="sii-column-resizer" title="Потягніть, щоб змінити ширину"></span>')
        .appendTo(column)
        .on("pointerdown", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const start_x = event.pageX;
          const start_width = column.outerWidth();
          $(document.body).addClass("sii-resizing-column");
          $(document)
            .off("pointermove.sii-column-resize pointerup.sii-column-resize")
            .on("pointermove.sii-column-resize", (move_event) => {
              const width = Math.max(70, Math.min(600, start_width + move_event.pageX - start_x));
              apply_grid_column_width(grid, index, width);
            })
            .on("pointerup.sii-column-resize", () => {
              const saved_widths = get_saved_grid_widths();
              saved_widths[index] = Math.round(column.outerWidth());
              localStorage.setItem("sii-item-column-widths", JSON.stringify(saved_widths));
              $(document.body).removeClass("sii-resizing-column");
              $(document).off("pointermove.sii-column-resize pointerup.sii-column-resize");
            });
        });
    });
}

function show_all_items(frm) {
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

function setup_item_filter(frm) {
  const grid = frm.fields_dict.items && frm.fields_dict.items.grid;
  if (!grid) return;
  let toolbar = grid.wrapper.find(".sii-item-filter-toolbar");
  if (!toolbar.length) {
    toolbar = $(
      '<div class="sii-item-filter-toolbar"><label>Показати товари:</label><select class="form-control input-sm">' +
      '<option value="all">Усі</option><option value="new">Нові</option>' +
      '<option value="existing">Існуючі</option><option value="increased">Закупівельна ціна зросла</option>' +
      '<option value="decreased">Закупівельна ціна знизилась</option><option value="no-history">Без історії ціни</option>' +
      '</select><span class="sii-filter-count"></span></div>'
    ).prependTo(grid.wrapper);
    toolbar.find("select").on("change", () => apply_item_filter(frm));
  }
  apply_item_filter(frm);
}

function apply_item_filter(frm) {
  const grid = frm.fields_dict.items && frm.fields_dict.items.grid;
  if (!grid) return;
  const toolbar = grid.wrapper.find(".sii-item-filter-toolbar");
  const filter = toolbar.find("select").val() || "all";
  let visible = 0;
  grid.grid_rows.forEach((grid_row) => {
    const doc = grid_row.doc;
    const matches = filter === "all"
      || (filter === "new" && doc.match_status === "New")
      || (filter === "existing" && doc.match_status === "Existing")
      || (filter === "increased" && doc.purchase_rate_status === "Increased")
      || (filter === "decreased" && doc.purchase_rate_status === "Decreased")
      || (filter === "no-history" && ["New", "No History"].includes(doc.purchase_rate_status));
    grid_row.wrapper.toggle(matches);
    if (matches) visible += 1;
  });
  toolbar.find(".sii-filter-count").text(`Показано: ${visible} із ${grid.grid_rows.length}`);
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
    show_all_items(frm);
    setup_item_filter(frm);
    setup_resizable_item_columns(frm);
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
    show_all_items(frm);
    setup_item_filter(frm);
    setup_resizable_item_columns(frm);
    paint_purchase_rate_changes(frm);
  },
  setup(frm) {
    $(frm.wrapper).on("grid-row-render.purchase-rate-colors", (event, grid_row) => {
      if (grid_row.grid.df.fieldname === "items") {
        show_all_items(frm);
        setup_item_filter(frm);
        setup_resizable_item_columns(frm);
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
