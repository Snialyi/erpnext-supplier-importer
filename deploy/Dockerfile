FROM frappe/erpnext:v16.31.0

ARG APP_COMMIT=3fdc4139590fedcc7dba7cab70aa4dced258aaed

USER root
RUN git clone https://github.com/Snialyi/erpnext-supplier-importer.git \
      /home/frappe/frappe-bench/apps/supplier_invoice_importer \
    && cd /home/frappe/frappe-bench/apps/supplier_invoice_importer \
    && git checkout "$APP_COMMIT" \
    && chown -R frappe:frappe /home/frappe/frappe-bench/apps/supplier_invoice_importer \
    && /home/frappe/frappe-bench/env/bin/pip install --no-cache-dir \
      -e /home/frappe/frappe-bench/apps/supplier_invoice_importer

USER frappe
WORKDIR /home/frappe/frappe-bench
RUN bench build --app supplier_invoice_importer
