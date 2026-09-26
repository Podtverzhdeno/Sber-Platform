"""Generate or verify the committed OpenAPI contract."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from impulse.bootstrap.app import create_app

ROOT = Path(__file__).parents[3]
CONTRACT = ROOT / "openapi.json"


def rendered_contract() -> str:
    schema = create_app().openapi()
    return json.dumps(schema, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    rendered = rendered_contract()

    if args.check:
        if not CONTRACT.exists() or CONTRACT.read_text(encoding="utf-8") != rendered:
            raise SystemExit("openapi.json is stale; run the OpenAPI generation command")
        print("OpenAPI contract is current")
        return

    CONTRACT.write_text(rendered, encoding="utf-8", newline="\n")
    print(f"Wrote {CONTRACT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
