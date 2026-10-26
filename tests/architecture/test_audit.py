"""Focused tests for the read-only dependency and migration inventory."""

from __future__ import annotations

import importlib.util
import tempfile
import unittest
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location(
    "architecture_audit", ROOT / "scripts/architecture/audit.py"
)
assert spec and spec.loader
audit_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit_module)


class ArchitectureAuditTests(unittest.TestCase):
    def test_prohibited_dependencies(self) -> None:
        self.assertTrue(audit_module.prohibited("application", "impulse.api.errors"))
        self.assertTrue(audit_module.prohibited("infrastructure", "impulse.api.errors"))
        self.assertTrue(audit_module.prohibited("domain", "impulse.application.work"))
        self.assertFalse(audit_module.prohibited("application", "impulse.domain.reward"))
        self.assertFalse(audit_module.prohibited("bootstrap", "impulse.infrastructure.database"))

    def test_cycle_detection(self) -> None:
        graph: dict[str, set[str]] = {"a.py": {"b.py"}, "b.py": {"a.py"}, "c.py": set()}
        self.assertEqual(audit_module.strongly_connected(graph), [["a.py", "b.py"]])

    def test_relative_typescript_import(self) -> None:
        known = {"frontend/src/features/bootcamp/card.tsx", "frontend/src/features/rating/page.tsx"}
        self.assertEqual(
            audit_module.ts_file(
                "frontend/src/features/rating/page.tsx", "../bootcamp/card", known
            ),
            "frontend/src/features/bootcamp/card.tsx",
        )

    def test_frontend_feature_owner_groups_sibling_tests_and_styles(self) -> None:
        self.assertEqual(
            audit_module.frontend_feature_owner("frontend/src/features/activity-panel.test.tsx"),
            "activity-panel",
        )
        self.assertEqual(
            audit_module.frontend_feature_owner("frontend/src/features/activity-panel.scss"),
            "activity-panel",
        )
        self.assertEqual(
            audit_module.frontend_feature_owner("frontend/src/features/bootcamp/card.tsx"),
            "bootcamp",
        )
        self.assertNotEqual(
            audit_module.frontend_feature_owner("frontend/src/features/analytics.tsx"),
            audit_module.frontend_feature_owner("frontend/src/features/bootcamp/catalog.tsx"),
        )

    def test_migration_head_and_missing_parent(self) -> None:
        data = {
            "migrations/versions/001_a.py": 'revision = "a"\ndown_revision = None',
            "migrations/versions/002_b.py": 'revision: str = "b"\ndown_revision = ("a",)',
        }
        m = audit_module.migrations(data)
        self.assertEqual(m["heads"], ["b"])
        self.assertEqual(m["orphan_parents"], [])
        self.assertEqual(m["missing_revision"], [])

    def test_migration_duplicate_and_disconnected_cycle(self) -> None:
        data = {
            "migrations/versions/001_a.py": 'revision = "a"\ndown_revision = None',
            "migrations/versions/002_b.py": 'revision = "b"\ndown_revision = "a"',
            "migrations/versions/002_b_duplicate.py": 'revision = "b"\ndown_revision = "a"',
            "migrations/versions/003_c.py": 'revision = "c"\ndown_revision = "d"',
            "migrations/versions/004_d.py": 'revision = "d"\ndown_revision = "c"',
        }
        result = audit_module.migrations(data)
        self.assertEqual(result["heads"], ["b"])
        self.assertIn("b", result["duplicate_revision"])
        self.assertEqual(result["cyclic_revisions"], ["c"])
        self.assertEqual(result["unreachable_from_heads"], ["c", "d"])

    def test_full_fixture_audit(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            examples = {
                "src/impulse/domain/model.py": "from impulse.api.errors import ApiError\n",
                "src/impulse/api/errors.py": "class ApiError(Exception): pass\n",
                "src/impulse/application/work.py": "from impulse.domain.model import Example\n",
                "frontend/src/features/a/view.tsx": 'import { X } from "../b/view";\n',
                "frontend/src/features/b/view.tsx": 'import { Y } from "../a/view";\n',
                "migrations/versions/001_first.py": 'revision = "first"\ndown_revision = None\n',
                "frontend/src/styles.scss": ".legacy { margin: 0 !important; }\n",
            }
            for relative, text in examples.items():
                path = root / relative
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(text, encoding="utf-8")
            report = audit_module.analyze(root)
            self.assertEqual(report["tracked"], len(examples))
            self.assertEqual(len(report["forbidden_imports"]), 1)
            self.assertEqual(report["migration_graph"]["heads"], ["first"])
            self.assertEqual(len(report["cycles"]), 1)
            self.assertEqual(len(report["cross_feature_imports"]), 2)
            self.assertEqual(report["css_risks"][0]["important_count"], 1)

    def test_ratchet_blocks_new_debt_and_expired_allowlist(self) -> None:
        report = {
            "forbidden_imports": [
                {"path": "src/impulse/application/work.py", "module": "impulse.api.errors"}
            ],
            "cycles": [["a.py", "b.py"]],
        }
        baseline: dict[str, Any] = {"exceptions": [], "allowed_cycles": []}
        self.assertEqual(len(audit_module.baseline_regressions(report, baseline)), 2)
        baseline["exceptions"] = [
            {
                "path": "src/impulse/application/work.py",
                "module": "impulse.api.errors",
                "owner": "team",
                "expires": "2099-01-01",
            }
        ]
        baseline["allowed_cycles"] = [["b.py", "a.py"]]
        self.assertEqual(audit_module.baseline_regressions(report, baseline), [])
        baseline["exceptions"][0]["expires"] = "2020-01-01"
        self.assertEqual(len(audit_module.baseline_regressions(report, baseline)), 1)

    def test_type_only_edges_do_not_create_runtime_cycles(self) -> None:
        self.assertTrue(
            audit_module.type_only_ts_import(
                'import type { Foo } from "./bar";', len("import type { Foo } ")
            )
        )
        self.assertFalse(
            audit_module.type_only_ts_import('import { Foo } from "./bar";', len("import { Foo } "))
        )
        import ast

        tree = ast.parse(
            "from typing import TYPE_CHECKING\n"
            "if TYPE_CHECKING:\n"
            "    from app.a import A\n"
            "from app.b import B\n"
        )
        modules = [
            n.module for n in audit_module.runtime_ast_nodes(tree) if isinstance(n, ast.ImportFrom)
        ]
        self.assertEqual(modules, ["typing", "app.b"])


if __name__ == "__main__":
    unittest.main()
