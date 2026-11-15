# 46-component capture and measurement registry

This follow-up to [Apple UI kit/](../README.md) covers **all 46 component targets** from the parent `COMPONENT_ATLAS.md` with unique case folders, source URLs, state checklists and functional acceptance criteria. It complements the existing 13 topic galleries and other independently drafted visual-case PRs; it does not replace or modify them.

## Contents

- `cases/APP-CAP-001-*/README.md` through `APP-CAP-046-*/README.md`: per-component source capture and QA contracts.
- `manifest.json`: 46 unique stable IDs, associated HIG resource, Impulse use case, target states and explicit unmeasured fields.
- `measurement-ledger.csv`: 46 empty measurement rows. **Do not fabricate numbers or copy native Apple source assets.**
- `gallery.html`: filterable offline HTML directory of this capture registry, no JS framework or external runtime.
- `verify.py`: Python 3 standard-library consistency check.

Run on a checkout: `python "Apple UI kit/14-precision-capture-46/verify.py"`.

## Accuracy boundary

Current Apple 27 editable kit layers, exact Figma/Sketch component node IDs, state variants and pixel values have **not** been inspected. All fields default to `MEASUREMENT_PENDING` and `NOT_CLAIMED`; neither this index nor the existing original SVG studies establishes Apple 1:1 pixel parity.

Source truth: [Apple Design Resources](https://developer.apple.com/design/resources/) and [Apple HIG materials](https://developer.apple.com/design/human-interface-guidelines/materials). Apple's Liquid Glass is for controls and navigation over content; ordinary content is not generally a refractive glass layer. Web CSS is an approximation, not a native rendering engine.

## How to finish a case

1. Access the licensed official Figma/Sketch source directly; record exact version and node.
2. Measure each source state, retain legally permitted local image provenance and SHA-256.
3. Fill the matching ledger row with measured values, never guesses.
4. Implement a semantic, accessible React analogue tied to real Impulse API and role permissions.
5. Run same-device light/dark screenshot overlay and interactive QA. Document native differences.
6. Obtain independent reviewer signoff at the exact commit before claiming success.

This folder contains no proprietary Apple fonts, UI-kit bundles, SF Symbol vectors or copied Apple screenshots. No existing Impulse product routes, tests or business logic are modified.
