# React reference components for Impulse (independent study)

Status: **REFERENCE IMPLEMENTATION, NOT PRODUCTION INTEGRATION OR APPLE KIT EXPORT**.

The source is original TypeScript/React 19 and CSS, aligned with the **intent** of Apple HIG and with existing Impulse's technology. The files are designed to be imported explicitly from another feature task only after review. This folder intentionally does **not** import from or overwrite \`frontend/src/\` in the live app. No Apple font, SF Symbols, Figma/Sketch binary or image is included.

## Files

- \`components.tsx\`: typed primitives (GlassControl, ContentSurface, ControlButton, SegmentedControl, SearchField, FloatingToolbar, StatusNotice, ActionDialog, NavigationDrawer).
- \`styles.css\`: fully scoped \`.aui-kit\` opt-in tokens and accessible web presentation; no global CSS reset.
- \`demo.tsx\`: independently mounted synthetic sample; no API calls or demo leaks to Impulse.
- \`contracts.json\`: states, behavior and known gaps for integration/reviewer.

## Usage

For a permitted, exclusive integration task, copy/import files into a dedicated frontend feature folder, mount within a root \`<div className="aui-kit" data-theme="dark">…</div>\`, and import \`styles.css\`. Example:

\`\`\`tsx
import { ControlButton, SegmentedControl } from "./components";
<ControlButton tone="primary" onClick={openActualCourse}>Продолжить курс</ControlButton>
<SegmentedControl label="Тип просмотра" value={mode} onChange={setMode}
  options={[{ label: "Список", value: "list" }, { label: "Карточки", value: "cards" }]} />
\`\`\`

React 19 and TypeScript are already in \`frontend/package.json\`. If mounting an overlay through a portal outside \`.aui-kit\`, scope/theme and dialog selectors must be adapted to cover that portal root. Modal/drawer use native \`<dialog>\` for focus trapping; Safari/Chromium require browser regression. In actual Impulse, the role-aware navigation and RBAC must stay authoritative.

## Why this is not Apple 1:1

Apple's Liquid Glass is a native dynamic compositor; CSS \`backdrop-filter\` **cannot** reproduce its refraction, morphing and system behavior pixel by pixel. The colors, radii and timing in this CSS are **proposed Impulse web values**, not measured from a 27 Figma/Sketch layer. Source: https://developer.apple.com/design/human-interface-guidelines/materials . The official editable kit and exact frame/state must still be measured and compared using \`../PIXEL_PARITY_QA.md\`.

## Accessibility contract

- Button minimum 44px tap target, visible keyboard focus, disabled and loading semantics.
- Segmented choices use an accessible **group of toggle buttons** (not tabs, because there are no tab panels); Arrow, Home, End and pointer choose a valid enabled option.
- Search has an explicit label and clear button.
- Dialog/drawer use \`showModal\`, native focus containment and Escape via \`cancel\`; focus is restored when closed.
- Empty/error/loading/restricted states have semantic alert/status modes; **do not** fabricate user data.
- Light/dark, forced colors, reduced motion, reduced transparency, browser without blur: designed fallback, still requires real browser QA.

## Acceptance and testing

This directory is isolated reference source. It is **not** in the frontend's current TypeScript compilation/test scope. Before product integration: run the project's \`npm run typecheck\`, \`npm run lint\`, \`npm test\` and responsive Playwright E2E for the **actual imported copies**, including 320/390/1024/1422/1440 widths. Use official licensed Apple UI Kit frame, record source coordinate measurements and screenshot diffs. Never merge or deploy solely because this demonstration compiles.

Native <dialog> requires a browser with showModal support. This example does not include production focus-trap polyfills or UI regression tests and does not change the existing Impulse overlay.
