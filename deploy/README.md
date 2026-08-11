# Docker deployment

The production image is built from the same ERPNext version as the target stack.
Pin `APP_COMMIT` to a reviewed commit so deployments are reproducible:

```bash
docker build \
  --build-arg APP_COMMIT=<reviewed-commit-sha> \
  -f deploy/Dockerfile \
  -t erpnext-supplier-importer:16.31.0 .
```

Configure the Frappe application services (`backend`, `frontend`, `queue-long`,
`queue-short`, `scheduler`, `websocket`, and one-shot `configurator`) to use the
custom image with `pull_policy: never`. Keep MariaDB and Redis unchanged.

Before installation, create a site backup. Then add `supplier_invoice_importer`
to `sites/apps.txt`, install it on the site, migrate, and clear the site cache.

The deployment on `erp.local` was first verified against commit
`3fdc4139590fedcc7dba7cab70aa4dced258aaed`.
