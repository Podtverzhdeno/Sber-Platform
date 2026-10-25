"""Regression coverage for demo-only role title synchronization."""

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

from impulse.bootstrap.ai_role_catalog import AI_ROLE_PROFILES


def load_role_migration():
    # Alembic versions are scripts, not an importable Python package.
    migration_dir = Path(__file__).resolve().parents[1] / "migrations" / "versions"
    path = migration_dir / "20261025_0028_ai_demo_roles.py"
    spec = spec_from_file_location("ai_demo_role_title_migration", path)
    assert spec is not None and spec.loader is not None
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_ai_role_migration_changes_only_seed_owned_track_titles(monkeypatch) -> None:
    migration = load_role_migration()
    executed = []
    monkeypatch.setattr(migration.op, "execute", executed.append)

    migration.upgrade()

    expected = {slug: profile["title"] for slug, profile in AI_ROLE_PROFILES.items()}
    assert migration.AI_ROLE_TITLES == expected
    assert len(executed) == len(expected) == 7
    assert {statement.compile().params["slug"] for statement in executed} == set(expected)

    for statement in executed:
        compiled = statement.compile()
        assert compiled.params["title"] == expected[compiled.params["slug"]]
        sql = str(statement).lower()
        assert "update tracks set title" in sql
        assert "data_origin = 'demo_seed'" in sql
        assert "title is distinct from" in sql
        assert "delete" not in sql
        assert "track_attempt" not in sql
        assert "roadmap" not in sql


def test_migration_downgrade_does_not_restore_obsolete_career_labels(monkeypatch) -> None:
    migration = load_role_migration()
    executed = []
    monkeypatch.setattr(migration.op, "execute", executed.append)

    migration.downgrade()

    assert executed == []
