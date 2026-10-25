"""Focused tests for the read-only dependency and migration inventory."""
from __future__ import annotations

import importlib.util
from pathlib import Path
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("architecture_audit", ROOT / "scripts/architecture/audit.py")
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
        graph = {"a.py": {"b.py"}, "b.py": {"a.py"}, "c.py": set()}
        self.assertEqual(audit_module.strongly_connected(graph), [["a.py", "b.py"]])

    def test_relative_typescript_import(self) -> None:
        known = {"frontend/src/features/bootcamp/card.tsx", "frontend/src/features/rating/page.tsx"}
        self.assertEqual(
            audit_module.ts_file("frontend/src/features/rating/page.tsx", "../bootcamp/card", known),
            "frontend/src/features/bootcamp/card.tsx",
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


if __name__ == "__main__":
    unittest.main()
