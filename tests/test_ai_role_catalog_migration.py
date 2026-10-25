"""Regression coverage for demo-only role title synchronization."""

from importlib import import_module

from impulse.bootstrap.ai_role_catalog import AI_ROLE_PROFILES


def test_ai_role_migration_changes_only_seed_owned_track_titles(monkeypatch) -> None:
    migration = import_module("migrations.versions.20261025_0028_ai_demo_roles")
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
    migration = import_module("migrations.versions.20261025_0028_ai_demo_roles")
    executed = []
    monkeypatch.setattr(migration.op, "execute", executed.append)

    migration.downgrade()

    assert executed == []
