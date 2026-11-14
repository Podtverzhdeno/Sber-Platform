# Figma iOS 16 — source-exact component migration

## Why
The product owner requires **1:1 UI Kit parity**, not an Apple-inspired stylesheet. Impulse currently contains an Apple-inspired global visual layer; it is not the source component implementation.

## Source of truth
Figma community file: https://www.figma.com/design/51dkjSuhgFyyeGV2cWLxex/iOS-16-UI-Kit-for-Figma--Community-?node-id=1002-6668

File pages verified through connected Figma MCP: `1002:6667` Colors & Typography, `5:54` Components, `1002:6666` Templates. Source variant nodes verified:
- Button light Filled `839:9700`; Tinted `839:9707`; dark Filled `839:9728`.
- TextField light Default `211:5737`; Active `211:5752`.
- Further variant inventory observed: Gray, Plain, dark Tinted/Gray/Plain; TextField typing/typed/dark; SegmentedPicker, Toggle, AlertModal, TableView, TabBar and other families.

## Scope of this slice
Implement **new real React controls** in `frontend/src/features/figma-ios16-kit/` for the measured buttons and text field, with scoped SCSS and behavior tests; leave existing shared controls and all business functions undisturbed until route-by-route migration and independent visual review.

## Explicit limitations
- The Figma Starter plan reached its MCP tool-call limit after initial extraction. Unretrieved variants are **not certified pixel-exact**.
- The Figma default field includes an optional close-button SVG and the button can include an SF Symbol; these assets were not downloaded. The initial components implement the asset-free variants, accepting a caller-provided icon.
- The UI Kit is an iOS design kit; browser semantics need native interactive HTML, while dimensions/colors match measured values.
- Do not bundle restricted Apple SF Pro font files. Native platform fallback is used and exact Windows glyph metrics cannot be claimed.
- No assertion that all 49 routes have been replaced; no global CSS override, production deploy, or automatic merge without acceptance.

## Acceptance
Native interactions pass; the retrieved light variants match their Figma node geometry. A separate integration lane maps all remaining screen/component classes, preserves routes/ACL/data, and runs screen screenshots against corresponding node renders before full rollout.
