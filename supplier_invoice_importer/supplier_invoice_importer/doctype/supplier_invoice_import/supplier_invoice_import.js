function paint_purchase_rate_changes(frm) {
  const classes = {
    Increased: "sii-rate-increased",
    Decreased: "sii-rate-decreased",
    New: "sii-rate-new",
    "No History": "sii-rate-new",
  };
  const grid = frm.fields_dict.items && frm.fields_dict.items.grid;
  if (!grid) return;
  grid.grid_rows.forEach((grid_row) => {
    let row_class = classes[grid_row.doc.purchase_rate_status] || "";
    if (!row_class && grid_row.doc.purchase_rate_source === "Valuation Rate") {
      row_class = "sii-rate-valuation";
    }
    const cells = grid_row.wrapper.find(".data-row, .grid-static-col, .grid-row-check, .row-check");
    cells.removeClass("sii-rate-increased sii-rate-decreased sii-rate-new sii-rate-valuation");
    if (row_class) cells.addClass(row_class);
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
    setup_form_sidebar_hover(sidebar_wrapper);
  }
  frm.page.wrapper.find(".sii-sidebar-toggle").remove();
  setup_compact_desk_sidebar();
}

function setup_form_sidebar_hover(sidebar_wrapper) {
  const sidebar = sidebar_wrapper.children(".form-sidebar");
  sidebar_wrapper.removeClass("sii-form-sidebar-open");
  sidebar.off("mouseenter.sii-sidebar mouseleave.sii-sidebar");
  $(document).off("click.sii-sidebar-collapse mousemove.sii-sidebar-state");
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

function apply_grid_column_width(grid, fieldname, width) {
  grid.wrapper.find(`.grid-static-col[data-fieldname="${fieldname}"]`).each((index, element) => {
    element.style.setProperty("width", `${width}px`, "important");
    element.style.setProperty("min-width", `${width}px`, "important");
    element.style.setProperty("max-width", `${width}px`, "important");
    element.style.setProperty("flex", `0 0 ${width}px`, "important");
  });
}

function setup_resizable_item_columns(frm) {
  const grid = frm.fields_dict.items && frm.fields_dict.items.grid;
  if (!grid) return;
  const widths = get_saved_grid_widths();
  Object.entries(widths).forEach(([fieldname, width]) => {
    apply_grid_column_width(grid, fieldname, width);
  });

  grid.wrapper
    .find(".grid-heading-row .grid-row:not(.filter-row) > .grid-static-col[data-fieldname]")
    .each((index, element) => {
      const column = $(element);
      if (column.find(".sii-column-resizer").length) return;
      const fieldname = column.attr("data-fieldname");
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
              apply_grid_column_width(grid, fieldname, width);
            })
            .on("pointerup.sii-column-resize", () => {
              const saved_widths = get_saved_grid_widths();
              saved_widths[fieldname] = Math.round(column.outerWidth());
              localStorage.setItem("sii-item-column-widths", JSON.stringify(saved_widths));
              $(document.body).removeClass("sii-resizing-column");
              $(document).off("pointermove.sii-column-resize pointerup.sii-column-resize");
            });
        });
    });
}

function use_page_scroll_for_item_grid(frm) {
  const grid = frm.fields_dict.items && frm.fields_dict.items.grid;
  if (!grid) return;

  grid.wrapper
    .find(".form-grid, .form-grid-container, .grid-body, .rows")
    .each((index, element) => {
      element.style.setProperty("height", "auto", "important");
      element.style.setProperty("max-height", "none", "important");
      element.style.setProperty("overflow-y", "visible", "important");
    });
}

function schedule_item_grid_enhancements(frm) {
  [0, 250, 800].forEach((delay) => {
    setTimeout(() => {
      use_page_scroll_for_item_grid(frm);
      setup_resizable_item_columns(frm);
      apply_item_filter(frm);
      paint_purchase_rate_changes(frm);
    }, delay);
  });
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
    setup_item_filter(frm);
    schedule_item_grid_enhancements(frm);
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
    setup_item_filter(frm);
    schedule_item_grid_enhancements(frm);
  },
  setup(frm) {
    $(frm.wrapper).on("grid-row-render.purchase-rate-colors", (event, grid_row) => {
      if (grid_row.grid.df.fieldname === "items") {
        setup_item_filter(frm);
        schedule_item_grid_enhancements(frm);
      }
    });
  },
});

frappe.ui.form.on("Supplier Invoice Import Item", {
  form_render(frm) {
    paint_purchase_rate_changes(frm);
  },
});
