# Apple UI kit — Impulse visual reference library

**Purpose:** practical, source-traceable Apple interface reference collection for the **Impulse** React/TypeScript app. Updated **2026-11-15**. This is **not** an Apple-official kit or a claim of native UIKit implementation.

## Start here

1. Open [Official resources](./sources.md) and obtain Apple's downloadable Figma/Sketch libraries from Apple Design Resources (subject to their terms).
2. Open [gallery.html](./gallery.html) locally in a browser: editable standalone **Impulse-authored approximations** for components, gestures and light/dark modes. **No Apple licensed asset is mirrored here**.
3. Use [tokens.css](./tokens.css) as a **starting point**; verify values against official Apple Figma/Sketch source components. These design tokens are estimates, not Apple's exact token exports.
4. Map to existing Impulse screens using [impulse-mapping.md](./impulse-mapping.md) and validate with [acceptance.md](./acceptance.md).
5. Review [assets-and-licenses.md](./assets-and-licenses.md) before adding imagery, symbols, fonts or screenshots.

## Extended curated reference structure

| Folder | Focus |
|---|---|
| [01-Liquid-Glass](./01-Liquid-Glass/README.md) | Regular/clear material, floating layers, reduced transparency, refraction limits |
| [02-Navigation](./02-Navigation/README.md) | macOS/iPadOS sidebar, split view, search, toolbars, tab bars |
| [03-Controls](./03-Controls/README.md) | Buttons, switches, sliders, pickers, state matrices |
| [04-Forms-Search](./04-Forms-Search/README.md) | Search fields, validation, keyboard, consent |
| [05-Overlays-Feedback](./05-Overlays-Feedback/README.md) | Alert, sheet, popover, menu, state/feedback |
| [06-Content-Data](./06-Content-Data/README.md) | Cards, grouped rows, tables, disclosure, progress |
| [07-Typography-Color-Icons](./07-Typography-Color-Icons/README.md) | Colors, semantic fonts, symbols, icon licenses |
| [08-Responsive-Accessibility](./08-Responsive-Accessibility/README.md) | Layout, large text, high contrast, reduced motion |
| [09-Applications-Patterns](./09-Applications-Patterns/README.md) | Apple Mail, Messages, Settings, Notes, Reminders concepts |

### Visual workbench

- [Open the interactive web gallery](./gallery.html): original HTML/CSS/JS examples, dark/light and interaction states.
- [Open the local pixel comparator](./compare.html): upload your authorized reference image + Impulse screenshot; overlay, split and differential, JSON report.
- [Official Apple visual references (remote preview links)](./visual-references.md): images loaded directly from Apple's site; no image binaries bundled.
- [Source manifest, 32 linked Apple references](./reference-manifest.json): machine-readable official Figma/Sketch, HIG and newsroom sources.
- [Apple WWDC study and 2026/2027 release links](./WWDC-official-study.md): carefully versioned verified sources.
- [Measurement ledger CSV](./measurement-ledger.csv) and [usage guide](./measurements-guide.md): fill real component measurements from Apple's source files before claiming 1:1 parity.
- [Offline structural QA script](./verify.mjs): run `node "Apple UI kit/verify.mjs"` after cloning this branch (not yet executed in a checked-out copy).

## What is included

| Family | Relevant states / behavior | Reference in gallery |
|---|---|---|
| Liquid Glass | navigation glass vs standard content, contrast, light/dark, no-blur fallback | toolbar, sidebar, menu, inspector |
| Navigation | sidebar, toolbar, search, tabs, breadcrumbs, split-view, sheets, popovers | shell, toolbar, segment, dialog |
| Controls | primary/secondary/destructive buttons, toggles, checkbox, radio, select, slider, steppers | interactive gallery |
| Data entry | search, form fields, validation, focus, disabled, helper text | inputs |
| Content | cards, grouped rows, disclosure, progress, badges, list/table, empty state | showcase |
| Feedback | notifications, status, confirmation dialog, busy/progress | status/dialog |
| Visual systems | semantic color, type, spacing, radii, elevation, borders, dark/light | tokens |
| Adaptation | responsive panes, accessibility, motion, reduced transparency, keyboard | acceptance matrix |

**Not included:** Apple's proprietary Sketch/Figma binaries, screenshots, trademarks, SF font files or a claim of full native shader/refraction parity. Source downloads stay on Apple's official distribution channels. For strict 1:1 fidelity, open exact platform kit/version in Figma/Sketch, match each component's measured dimensions and states, then run same-viewport image overlays with tolerances.

## Existing Impulse implementation (do not overwrite)

- `frontend/src/features/apple-surface/AppleSurface.tsx` and `apple-surface.scss`
- `frontend/src/app/apple-web-ui.scss`, `impulse-next.scss`, `overlay-navigation.scss`
- `frontend/src/features/calm-navigation/` and `frontend/src/features/pixel-reference/`
- `docs/design/impulse-reference-fidelity-audit-20261115.md`
- `openspec/changes/impulse-apple-app-experience-20261114/docs/`

No imports from the gallery into the production app are wired. Any adoption should occur in separately claimed integration scopes with maintained routes, permissions, API state and tests.

## Suggested acceptance order

First replicate the **existing approved Impulse screenshot** at a fixed viewport, then align Apple-inspired navigation and controls, preserving Impulse's branding. Do not replace all content cards with refractive glass. Check six roles and existing routes. The attached gallery is a design-development reference, not a replacement for the owner's baseline.
