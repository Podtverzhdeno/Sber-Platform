# Apple-grade visual system — home-only design contract (v3)

## Authority and status

This is an **authored design proposal**, not an official Apple token table or a licensed copy of macOS materials. Use Apple HIG for interaction semantics; choose approximate web-safe colors, spacing and fonts to recreate the experience within Impulse. Inspect actual rendering in Yandex Browser on Windows as well as Safari/macOS-like viewport emulation before deciding visual fidelity.

## 1. Visual direction: measured, white, quiet

- The **content canvas** is white or very subtle neutral gray. No outer 26px bordered container around the entire page, no marketing gradient, no image/emoji graphics, no orbital illustrations, no gratuitous shadows.
- Main task, requirements, activity and profile data are opaque surfaces. The decorative Liquid Glass technique is **not** used on persistent data cards, consistent with [Apple HIG Materials](https://developer.apple.com/design/human-interface-guidelines/materials).
- Contrast and hierarchy come from typography, spacing, and selective separators. Use one colored accent primarily for the primary CTA and selected/active controls; the rest is monochrome.
- Avoid overline/eyebrow labels in all caps, glowing rings, "future AI" decoration, multi-panel BI styling and multiple colored badges.
- Use original Impulse wording, brand and authorized destinations; *not* Apple's wordmarks, proprietary font files, SF Symbols binaries or copyrighted screenshots in bundle.

## 2. Suggested semantic CSS tokens (not official Apple system values)

| Token | Light proposed value | Dark proposed value | Role |
|---|---|---|---|
| `--home-canvas` | `#FFFFFF` | `#121416` | Unbordered page background |
| `--home-group` | `#F5F5F7` | `#1C1D20` | Subtle grouped list background |
| `--home-hover` | `#EDEEF1` | `#292A2E` | Hover/focus support for text rows |
| `--home-text` | `#1D1D1F` | `#F5F5F7` | Titles / content |
| `--home-secondary` | `#5C5C62` | `#B7B7BD` | Status / supporting info; must pass AA |
| `--home-divider` | `#E5E5EA` | `#3A3B40` | Low-emphasis row divider |
| `--home-action` | `#007AFF` | `#68A9FF` | One primary action, selected state; adaptation needed for contrast |
| `--home-action-text` | `#FFFFFF` | `#101319` | Contrasting on filled button |
| `--home-focus-ring` | `#005FCC` | `#A7CFFF` | Visible keyboard focus |
| `--home-status-warning` | `#805200` | `#FFD78A` | Only when business state actually warns |
| `--home-status-ok` | `#177B52` | `#78D6A5` | Only for verified completion |

**Color caveat:** treat the table as input to contrast audits, not as guaranteed accessible pairs. Verify AA contrast with actual rendered sizes and backgrounds; adjust exact values if contrast fails. A user-selected dark theme takes priority over the light default — the design's white direction is its normal appearance, not a forced override of accessibility preferences.

## 3. Typography

Platform stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Arial, sans-serif`. On Apple devices this normally selects an SF-family system font; **on Windows this is not SF Pro**, and visual comparison must account for different glyph widths and rasterization. Do not bundle Apple's restricted system fonts. A licensed alternate (e.g., Inter) can be considered separately if approved; no dependency change in this task.

| Role | Desktop range | Compact range | Weight | Notes |
|---|---|---|---|---|
| Page title "Главная" | 34–36px, 1.13 line height | 30–32px | 680/700 | Single primary H1, negative letter-spacing only if natural |
| Main action title | 22–26px, 1.22 | 20–23px | 650/700 | Up to three lines; no arbitrary truncation of task identity |
| Group heading | 16–18px | 16–17px | 620/650 | Not uppercase |
| Main text | 15–16px | 15–16px | 400/450 | Comfortable reading without enlarging all labels |
| Muted status | 13–14px | 13–14px | 400/500 | Preserve sufficient contrast |
| Context/count labels | 12–13px | 12–13px | 500 | No 9px decorative captions |
| Button | 14–15px | 15–16px | 600 | Straightforward verb + object |

Typography must survive 200% text zoom, longer localized names and full keyboard focus without clipping. Do not hardcode a giant fixed-height hero.

## 4. Spacing and geometry

Use a 4px-based rhythm. Practical candidates: `4, 8, 12, 16, 20, 24, 32, 40, 48` px; avoid arbitrary 17/19/23 for all new layout containers.

- Large desktop main workspace max-width: **1024px**; no stretched sentence-length across a 4K monitor. Maintain left alignment with the shell's content edge. Horizontal page padding **32–40px** only if viewport permits.
- On 1024px and below, horizontal padding **20–24px**; on 390/320px **16px**.
- Headline/context separation **6–8px**, heading-to-primary **32–40px**, within primary focus **10–16px**, major sections **24–32px**. Avoid a giant 70px unused area at the top or an empty 270px promo tile.
- One first-fold focus surface, if a surface is necessary, with a **12–16px radius**; in a plain white workspace it may just be a divider and text with **no border at all**.
- Grouped work rows 48–64px minimum height, 10–12px radius for hovered/selected row; light 1px divider only within row group.
- Primary button **>=44px** hit area on all touch targets, one filled accent only. Secondary actions are text/neutral buttons with same hit target, not mini blue cards.
- Progress strip: inline numeric facts, small 4–6px progress line **only when source-derived denominator is valid**. No decorative ring, sparkline or invented percentage.
- No fixed width / `min-width` that creates overflow at 320px; text and controls wrap/stack based on measured content width.
- At normal 1440×900, the next actionable step and main button should appear without scrolling even with the existing navbar. Do not promise all expanded details above the fold.

## 5. Controls inventory

| Control | Behavior | Default appearance | Open/active behavior |
|---|---|---|---|
| Primary CTA | Navigate to *authorized canonical destination* only | One solid blue/brand accent button; concise label | Visible focus/pressed state; no mutation on home |
| Contextual status | Read-only business state | Plain text next to task title; if important one small icon | Not interactive unless explicit detail link exists |
| Progress summary | Explain present level and exact next requirements | Thin inline group; text values, not three cards | "Требования уровня" opens detail |
| Disclosure row | Expand tasks/week or tool list | Full-width row with right chevron and clear title | Arrow rotates, rows below visible; `aria-expanded` reflected |
| Course row | Navigate only if accessible/available | Name, real status, one trailing action | Deep link includes role key; completed has non-click fake action |
| Small status popover | Explanation for tiny context | No floating decorative glass everywhere | Escape/outside click when no essential information |
| Level details sheet | Show many courses/practice details | Closed; visible "Требования уровня" opener | Desktop sheet/inspector, compact fullscreen/inline region, focus restoration |
| Day selector | Read-only select a server day | Seven short day labels, selected highlight | Click/keyboard changes **detail text**, never marks day complete |
| More menu | Occasional authorized destinations only | Neutral ellipsis/label, never primary | One menu level; dismiss on Escape/outside click |
| Error/retry | Recover a failed safe GET | Neutral clear error row | Retry GET; never auto-retry mutating actions |

## 6. Motion and tactile detail

- Meaningful short transitions only: ~150–220ms for hover/disclosure/opacity on capable devices. No spring bouncing, large-scale zoom, infinite pulsing, moving gradients or autoscrolling.
- Respect `prefers-reduced-motion: reduce`: remove nonessential transitions while retaining focus/selection feedback.
- Never indicate a network mutation as complete before the server confirms it.
- Hover is additive only; every action must remain discoverable and keyboard accessible without hover.
- Loading should preserve stable layout to minimize shifts; do not use a skeleton that looks like an actual verified number.

## 7. Interaction/accessibility contract

- Semantics: one `h1` ("Главная"), section headings in order, group lists as `ul/li`, `button` for actions, `a` for true hyperlinks when routing supports them.
- 44px hit targets for touch, visible focus outline, no icon-only action without accessible label.
- Screen reader reads title, real state, and action in that order. Do not signal verification solely by color.
- Native `details/summary` is acceptable in phase H1, but complex level requirements should graduate to a real dialog/inspector with focus trap, Escape and return-focus.
- Background should be inert when a modal sheet is open; avoid focus escaping behind it.
- Dark/light mode and at least WCAG 2.2 AA contrast are necessary; test more than color values.
- Content should respond to `prefers-reduced-motion`, 200% zoom and narrow windows without overlapping the shell.

## 8. Layering and rollout

**First stage:** home content only; respect existing sidebar/toolbar even if not Apple-like. **Second separately approved stage:** coordinate shared shell to match the new white visual language without altering other role navigation or permissions. Do not sneak shell changes into the home CSS with broad selectors.

**Exit criterion:** user can compare screenshot of first fold and expanded details on their actual 1440px desktop and 390px phone, then accept/correct. Perfect cross-platform pixel identity with native Apple apps is not promised — this is a browser product and uses its own legal assets.
