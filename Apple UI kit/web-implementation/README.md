# Apple-style web controls laboratory for Impulse

Self-contained original HTML/CSS/JS prototype: navigation control layer, **standard (non-glass) content**, focus-managed drawer/dialog, a search filter, tabs, light/dark theme, clear/regular glass controls, example form states.

Start a local HTTP server from repo root with:

    python -m http.server 8088

Open http://localhost:8088/Apple%20UI%20kit/web-implementation/

This is a **source-backed approximation**, not Apple UI Kit code, a screenshot reproduction, or a route in the running Impulse app. Apple 27 kit layers were not measured. Do not copy example data or nonfunctional local controls into production. The only authoritative visual source is the actual Apple Figma/Sketch kit and an approved Impulse screenshot.

Reference: https://developer.apple.com/design/human-interface-guidelines/materials and https://developer.apple.com/design/human-interface-guidelines/color . Apple distinguishes controls/navigation Liquid Glass from content-layer standard materials. Clear glass is appropriate over visually rich backgrounds with adequate contrast. The browser's backdrop-filter cannot recreate native glass refraction.

For review: see QA_CHECKLIST.md. For exact frame capture: ../PIXEL_PARITY_QA.md. For licensing: ../PROVENANCE_AND_LICENSE.md.
