# 06 · Content, lists & dense data

**References:** [HIG Materials](https://developer.apple.com/design/human-interface-guidelines/materials), [HIG Disclosure controls](https://developer.apple.com/design/human-interface-guidelines/disclosure-controls), [HIG Progress indicators](https://developer.apple.com/design/human-interface-guidelines/progress-indicators), [HIG Layout](https://developer.apple.com/design/human-interface-guidelines/layout).

## UI cases for Impulse
- Grouped settings-like rows; disclosure groups; compact metadata and descriptions.
- Task/project/course cards & compact lists; hover, selected, disabled, skeleton and error.
- Tables (many columns, sortable, paginated, row action and keyboard focus).
- Rich information: text, code, documents, PDFs, evidence, progress indicators.
- Charts: source-backed data and readable axes, no glossy visual treatment over plotted data.
- Empty/filtered/locked/archived states; correct backend status separate from visual decoration.
- Inspector on desktop and responsive content detail on mobile.

## Key Apple material guideline
**Standard materials for reading and content.** Liquid Glass for floating navigation and relevant interactive controls. See the official Materials page. Applying refractive blur to every table and paragraph is not correct adaptation.

## Measurement ledger
For each screenshot: source platform/UI kit version, frame ID, container width, row height, content density, heading text style, separator position, list backgrounds, scrollbars, and responsive rules. Values must be obtained from the source kit.

## Integration
Preserve list sorting/filtering, URLs and requests, authorisation, AI-versus-human verification, event/audit semantics. Refer to [mapping](../impulse-mapping.md).

Demo: [content gallery](../gallery.html#content).
