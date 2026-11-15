# Offline Markdown / HTML link integrity

Run from a checked-out repository:

    python "Apple UI kit/scripts/audit_reference_links.py"
    python -m unittest discover -s "Apple UI kit/scripts" -p "test_audit_reference_links.py" -v

This Python standard-library audit resolves local Markdown, HTML, SVG and script/style links to files on disk, including relative paths, URL-encoded spaces and query suffixes. Fenced Markdown examples are ignored. External HTTP(S) sources are counted as **not checked**, and references outside the Apple UI kit root are explicitly out of scope.

Connected GitHub structural spot-check (2026-11-15): 144 local links in 13 key pages verified against the repository's actual tree with **zero broken paths**. That is not a claim that this new Python script has already run. No Apple licensed asset, native Liquid Glass rendering, original Figma/Sketch layer, external live URL or browser screenshot is verified by this check.

Pair with SOURCE_QUALITY_GATE.md, PIXEL_PARITY_QA.md and BROWSER_ACCEPTANCE.md.
