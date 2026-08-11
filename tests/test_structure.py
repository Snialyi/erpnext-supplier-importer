import ast
import unittest
from pathlib import Path

try:
    import tomllib
except ModuleNotFoundError:  # Python 3.10 compatibility
    import tomli as tomllib


ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / "supplier_invoice_importer"


def _hook_values() -> dict[str, str]:
    tree = ast.parse((PACKAGE / "hooks.py").read_text(encoding="utf-8"))
    values = {}
    for node in tree.body:
        if (
            isinstance(node, ast.Assign)
            and len(node.targets) == 1
            and isinstance(node.targets[0], ast.Name)
            and isinstance(node.value, ast.Constant)
            and isinstance(node.value.value, str)
        ):
            values[node.targets[0].id] = node.value.value
    return values


class ScaffoldTestCase(unittest.TestCase):
    def test_required_scaffold_paths_exist(self):
        required_paths = [
            ROOT / "pyproject.toml",
            ROOT / "README.md",
            ROOT / "license.txt",
            ROOT / "MANIFEST.in",
            ROOT / ".gitignore",
            PACKAGE / "__init__.py",
            PACKAGE / "hooks.py",
            PACKAGE / "modules.txt",
            PACKAGE / "patches.txt",
            PACKAGE / "public",
            PACKAGE / "templates",
        ]

        self.assertTrue(all(path.exists() for path in required_paths))

    def test_project_metadata_matches_frappe_app(self):
        project = tomllib.loads(
            (ROOT / "pyproject.toml").read_text(encoding="utf-8")
        )

        self.assertEqual(project["project"]["name"], "supplier_invoice_importer")
        self.assertEqual(project["project"]["license"]["file"], "license.txt")
        self.assertEqual(
            project["build-system"]["build-backend"], "flit_core.buildapi"
        )
        self.assertEqual(
            project["tool"]["bench"]["frappe-dependencies"],
            {
                "frappe": ">=16.30.0,<17.0.0",
                "erpnext": ">=16.31.0,<17.0.0",
            },
        )

    def test_hooks_metadata(self):
        hooks = _hook_values()

        self.assertEqual(hooks["app_name"], "supplier_invoice_importer")
        self.assertEqual(hooks["app_title"], "Supplier Invoice Importer")
        self.assertEqual(hooks["app_publisher"], "Andrii Snialyi")
        self.assertEqual(hooks["app_email"], "andrey.welcome.ua@gmail.com")
        self.assertEqual(hooks["app_license"], "MIT")

    def test_module_and_patch_files_are_valid(self):
        self.assertEqual(
            (PACKAGE / "modules.txt").read_text(encoding="utf-8").strip(),
            "Supplier Invoice Importer",
        )
        patches = (PACKAGE / "patches.txt").read_text(encoding="utf-8")
        self.assertIn("[pre_model_sync]", patches)
        self.assertIn("[post_model_sync]", patches)


if __name__ == "__main__":
    unittest.main()
