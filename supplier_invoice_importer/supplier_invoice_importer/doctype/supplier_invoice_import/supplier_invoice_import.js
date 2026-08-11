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
  if (sidebar_wrapper && sidebar_wrapper.length && sidebar_wrapper.is(":visible")) {
    sidebar_wrapper.hide();
    $(document.body).trigger("toggleSidebar");
  }
  setup_sidebar_arrow(frm, sidebar_wrapper);
  setup_sidebar_actions(frm, sidebar_wrapper);
}

function setup_sidebar_arrow(frm, sidebar_wrapper) {
  if (!sidebar_wrapper || !sidebar_wrapper.length) return;
  let button = frm.page.wrapper.find(".sii-sidebar-toggle");
  if (!button.length) {
    button = $('<button type="button" class="sii-sidebar-toggle"></button>')
      .appendTo(frm.page.wrapper)
      .on("click", () => {
        frm.toolbar.setup_sidebar_toggle(sidebar_wrapper);
        setTimeout(() => update_sidebar_arrow(frm, button, sidebar_wrapper), 50);
      });
  }
  update_sidebar_arrow(frm, button, sidebar_wrapper);
}

function update_sidebar_arrow(frm, button, sidebar_wrapper) {
  const is_open = sidebar_wrapper.is(":visible");
  frm.page.wrapper.toggleClass("sii-right-sidebar-open", is_open);
  button
    .html(frappe.utils.icon(is_open ? "right" : "left", "sm"))
    .attr("aria-label", is_open ? "Сховати праву панель" : "Показати праву панель")
    .attr("title", is_open ? "Сховати праву панель" : "Показати праву панель")
    .toggleClass("sidebar-open", is_open);
  const actions = $(document.body).find(".sii-sidebar-actions");
  actions.toggleClass("sidebar-open", is_open);
  actions.toggle(!is_open);
}

function setup_sidebar_actions(frm, sidebar_wrapper) {
  let actions = $(document.body).find(".sii-sidebar-actions");
  if (!actions.length) {
    actions = $('<div class="sii-sidebar-actions" aria-label="Швидкі дії правої панелі"></div>')
      .appendTo(document.body)
      .css({
        position: "fixed",
        top: "calc(50% - 92px)",
        right: "6px",
        zIndex: 1039,
        width: "44px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "6px",
        padding: "7px 3px",
        border: "1px solid var(--border-color)",
        borderRadius: "10px",
        background: "var(--fg-color)",
        boxShadow: "var(--shadow-sm)",
      });
    [
      [sidebar_action_icon("users"), "Призначити", ".add-assignment-label"],
      [sidebar_action_icon("paperclip"), "Додати вкладення", ".add-attachment-btn"],
      [sidebar_action_icon("tag"), "Додати тег", ".form-tags .form-sidebar-label"],
      [sidebar_action_icon("share"), "Поділитися", ".share-label"],
    ].forEach(([icon_markup, title, selector]) => {
      $('<button type="button" class="sii-sidebar-action"></button>')
        .html(icon_markup)
        .css({
          width: "36px",
          height: "36px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          border: "1px solid transparent",
          borderRadius: "8px",
          background: "var(--control-bg)",
          color: "var(--text-muted)",
          cursor: "pointer",
        })
        .attr("aria-label", title)
        .attr("title", title)
        .appendTo(actions)
        .find("svg")
        .css({
          width: "19px",
          height: "19px",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 1.8,
          strokeLinecap: "round",
          strokeLinejoin: "round",
          pointerEvents: "none",
        })
        .end()
        .on("click", () => open_sidebar_action(frm, sidebar_wrapper, selector));
    });
  }
  const is_open = sidebar_wrapper.is(":visible");
  actions.toggleClass("sidebar-open", is_open);
  actions.toggle(!is_open);
}

function sidebar_action_icon(name) {
  const icons = {
    users: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"></circle><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5"></path><path d="M15 5.5a3 3 0 0 1 0 5.5M16 14c2.6.3 4.5 2.1 4.5 5"></path></svg>',
    paperclip: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 12 6.4-6.4a3.5 3.5 0 0 1 5 5L11 20a5 5 0 0 1-7-7l9-9"></path></svg>',
    tag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 13 12 21 3 12V3h9l8 8a1.4 1.4 0 0 1 0 2Z"></path><circle cx="8" cy="8" r="1.5"></circle></svg>',
    share: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5"></circle><circle cx="6" cy="12" r="2.5"></circle><circle cx="18" cy="19" r="2.5"></circle><path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5"></path></svg>',
  };
  return icons[name];
}

function open_sidebar_action(frm, sidebar_wrapper, selector) {
  if (!sidebar_wrapper.is(":visible")) {
    frm.toolbar.setup_sidebar_toggle(sidebar_wrapper);
  }
  const arrow = frm.page.wrapper.find(".sii-sidebar-toggle");
  setTimeout(() => {
    update_sidebar_arrow(frm, arrow, sidebar_wrapper);
    sidebar_wrapper.find(selector).first().trigger("click");
  }, 80);
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
