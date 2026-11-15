# Apple UI kit — offline source structure gate

The repository includes an original validation helper and synthetic unit fixtures, without external calls or Apple downloads.

Run from the repository root:

    python "Apple UI kit/scripts/audit_source_bundle.py"
    python -m unittest discover -s "Apple UI kit/scripts" -p "test_audit_source_bundle.py" -v

The audit validates:
- Presence of the 13 categorized reference packets and their independent SVG descriptions
- Every category JSON source's Apple Developer URL and truthful uninspected-layer status
- Root source manifest and catalog entry count/uniqueness, no fabricated measurements
- HTML DOM IDs used by the standalone JS reference lab
- Absence of committed *.fig, *.sketch, *.ttf, *.otf, *.woff, *.woff2 binaries

These checks are **not** Apple-license legal review, actual source layer measurement, browser screenshots or 1:1 pixel conformity. The code needs to be executed in a checked-out repository before declaring repository validation passed.

Tests are intentionally standalone: they construct a synthetic 13-category fixture and confirm detection of missing IDs, false measurement claims, missing SVG files and restricted font files.
