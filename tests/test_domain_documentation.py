"""Domain documentation must remain synchronized with SQLAlchemy metadata."""

import re
from pathlib import Path

from impulse.infrastructure.models import metadata


def test_documented_tables_equal_metadata() -> None:
    document = (Path(__file__).parents[1] / "docs" / "domain-model.md").read_text(encoding="utf-8")
    block = document.split("<!-- tables:start -->", 1)[1].split("<!-- tables:end -->", 1)[0]
    documented = set(re.findall(r"^- `([a-z0-9_]+)`$", block, flags=re.MULTILINE))

    assert documented == set(metadata.tables)
