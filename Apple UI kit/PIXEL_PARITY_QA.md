# Apple source → Impulse pixel/behavior acceptance protocol

**Current kit status:** official source links catalogued, **Apple 27 editable Figma/Sketch individual layers not inspected or extracted**, no 1:1 visual parity proven. Treat all values in `design-tokens.json` and prototype CSS as proposed.

## Stage A — exact source frame capture

For each selected Apple UI component record:
- Platform, OS version, `Apple Design Resources` download/kit version and design tool.
- Exact source URL/document/version, frame/component ID, variant/property values and screenshot-export date.
- Expected size in points, actual export dimensions in pixels and export scale; typography/font license and availability.
- Light/dark/clear/regular/high-contrast and pressed/focus/disabled/error states where supported.
- Bounds `x,y,w,h`, radius, spacing, border, tint/opacity, elevation/shadow, type metrics, icon sizes and layer hierarchy.
- Link export rather than checking in restricted Apple design assets. Keep rights/provenance clear.

## Stage B — controlled local reference render

Use one stable environment: browser+version, operating system, available local fonts, CSS pixel viewport, `deviceScaleFactor`, theme, reduced-motion/transparency, default zoom, locale and deterministic permitted fixtures. Avoid async data races and use stable API test fixtures when comparing; do not falsify backend state.

Target dimensions:
- 1422×803: owner reference shell.
- 1440×900: standard desktop.
- 1024×768: tablet.
- 390×844: phone.
- 320px viewport: extreme narrow layout.

## Stage C — measurable comparison

1. Render the source design and Impulse component at same apparent scale, clip and position.
2. Calculate an alpha overlay (50% opacity), perceptual pixel-diff and bounding box delta.
3. Check shell ±8px and major regions ±16px **only when that particular owner's acceptance specifically permits those tolerances**. A true “1:1” request requires a pixel-diff reference agreement, not an arbitrary geometry threshold.
4. Explain anti-aliasing/fontrendering discrepancies instead of adjusting unrelated business components.
5. Explicitly log every NATIVE_ONLY gap (compositor refraction, native glass morphing, system bars, native haptics).
6. Record screenshot path, exact commit SHA, browser/environment versions and reviewer.

## Stage D — functionality, rights and accessibility

| Gate | Acceptance |
|---|---|
| Source | Real official editable frame ID and export provenance |
| Licensing | No unlicensed bundled Apple fonts/symbols/Sketch/Figma binary assets |
| Layout | No clipped controls at 320/390/1024/1422/1440px |
| Role safety | All 6 roles and existing authorization/route boundaries unchanged |
| Data integrity | Real values from API; no 0/0 mock or fake verified statuses |
| Forms | Validation, errors, disabled/loading controls and undo semantics preserved |
| Keyboard | Visible focus; toolbar/sidebar/popover/sheet tabbable and escapable |
| Assistive tech | Buttons/menus/sheets labelled and focus-restoring |
| Contrast | Text and states visually legible on bright/dark complex backgrounds |
| Preferences | Light/dark, reduced motion, high contrast, unsupported blur fallback |
| Regression | Existing component tests, typecheck, lint, production build, route E2E |
| Acceptance | Independent reviewer and exact revision screenshot evidence |

## Template for any measured Apple component

```yaml
reference_id: APP-<PLATFORM>-<COMPONENT>-<VARIANT>
source:
  publisher: Apple
  kit_version: "27"
  url: ""
  frame_id: ""
  license_reviewed: false
capture:
  tool: ""
  exported_at: ""
  viewport_css_px: [0, 0]
  device_scale_factor: 1
measurements:
  x: null
  y: null
  width: null
  height: null
  radius: null
  border: null
  blur: null
  font: null
  gaps: []
impulse:
  component: ""
  route: ""
  commit_sha: ""
  light_diff: ""
  dark_diff: ""
  functionality_evidence: ""
  accessibility_evidence: ""
status: MEASUREMENT_PENDING
notes: "Do not claim pixel parity before independent comparison."
```

## Limit

Pixel similarity is not UIKit, macOS native AppKit or SwiftUI behavior. Native Liquid Glass physics cannot be guaranteed via a pure browser implementation. Verify the **web analogue** against the selected Apple state and record divergences; never label a proposal “official Apple CSS” or “1:1” without actual measurements and review.
