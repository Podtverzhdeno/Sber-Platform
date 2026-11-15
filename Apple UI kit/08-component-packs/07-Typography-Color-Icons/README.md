# 07 · Typography, color, symbols and iconography

**Official:** [Typography](https://developer.apple.com/design/human-interface-guidelines/typography), [Color](https://developer.apple.com/design/human-interface-guidelines/color), [Icons](https://developer.apple.com/design/human-interface-guidelines/icons), [SF Symbols](https://developer.apple.com/sf-symbols/), [Fonts](https://developer.apple.com/fonts/).

## Extract from official files
- Font size/weight/tracking/line-height/optical baseline at each hierarchy level; long Russian text, numerals and mixed glyphs must remain readable.
- Semantic palette (background, surface, primary/secondary/tertiary text, separators, tint, interactive, success/error/warning), dynamic light/dark and high contrast.
- Semantic symbol names and actual bounding boxes; use explicit fallbacks for browser UI, not unlicensed exported SF Symbols vectors.
- Elevation/shadow/line radius and hairline consistency under device pixel ratio.

## Current Impulse constraints
Existing application theme variables are already defined in `frontend/src/app/apple-web-ui.scss` and related CSS. The `tokens.css` beside this README is demo-only and **must not be globally imported** into production.
No Apple proprietary font binaries, app icons or official SF Symbols vectors are bundled here. Use browser system font stack and licensed icons in app (Lucide already used by Impulse) after checking visual alignment.

## Comparison checklist
Font family available vs requested, title baseline, tabular digit alignment, truncation, 200% text zoom, long-form Russian, contrast in dark/light/reduced transparency, icon-only labels.
