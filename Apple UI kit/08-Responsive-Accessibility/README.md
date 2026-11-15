# 08 · Adaptive layout, keyboard & accessibility

**Official sources:** [Layout](https://developer.apple.com/design/human-interface-guidelines/layout), [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility), [Motion](https://developer.apple.com/design/human-interface-guidelines/motion).

## Matrix
| Mode | Visual case | Must pass |
|---|---|---|
| Desktop 1422×803 | approved Impulse frame baseline | compare geometry with owner image |
| Wide desktop 1920×1080 | expanded workspace | no overflow or stretched text |
| Tablet 820×1180 | collapsing detail pane | focus and keyboard pointer parity |
| Mobile 390×844 | single pane + overlay nav | no clipped fixed controls |
| Narrow mobile 320px | minimum usable width | no hidden P0 actions |
| Zoom 200% | reflow | no horizontal loss or label overlap |
| Reduced motion | disable ornamental transitions | functionality intact |
| Reduced transparency | opaque legible overlay | no transparency-dependent meaning |
| Forced colors | high contrast borders/focus | all controls distinguishable |
| Screen reader | semantics/live feedback | item/state names reliable |

## Source-to-code 1:1
Platform-sensitive constraints are part of the source; do not flatten iOS toolbar dimensions into macOS without inspecting platform layers. Use platform-appropriate breakpoints *derived from Impulse content*, not arbitrary Apple device dimensions.
For each screenshot record width, height, DPR, zoom, OS/font availability, scroll position, mode and data fixtures. Check by direct overlay using [compare.html](../compare.html).

No numerical claims of exact Apple component geometry until measured from Figma/Sketch.
