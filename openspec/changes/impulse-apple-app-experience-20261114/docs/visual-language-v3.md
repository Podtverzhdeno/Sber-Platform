# Impulse visual language v3 — user references × Apple HIG × accessibility

**Design intention:** inspired by macOS/iOS but an original Impulse web interface. This is a complete set of **proposed CSS/design tokens** for design review, not Apple official values and not a shipped implementation. Verified user originals U01–U04: `owner-true-originals-analysis-20261114.md`. Previous assistant mockup's 1440/390 geometry is an optional *concept*, not owner-image evidence.

## I. Visual character

**White theme:** clean white paper-like canvas with restrained blue action, nearly neutral grayscale side navigation, readable black, one soft focus surface, subtle shadow only on floating or truly interactive controls. The user-provided U02 is the primary evidence for content hierarchy, while U01 informs a few button/switch microdetails.

**Dark theme:** intentional charcoal/graphite, not `filter:invert`. User-provided U03 supports a dense low-glare layer for inboxes, chats and filters. Preserve high text contrast and separate selected/hovered states without glowing neon. U04's muted blue glass is an *optional* transient panel mood, not a blue page-wide surface.

**Material and hierarchy:** Apple HIG Materials (https://developer.apple.com/design/human-interface-guidelines/materials) recommends transparent/glass-like material as the functional control/navigation layer, not persistent data content. Flat lists and opaque evidence remain primary. Use at most one visible elevation style per screen when necessary.

## II. Design tokens, proposed baseline

| Semantic token | White | Dark | Intended use |
|---|---|---|---|
| `--surface-canvas` | `#FFFFFF` | `#111214` | All main page content |
| `--surface-sidebar` | `#F7F7F9` | `#191A1E` | Navigation, always quieter than work |
| `--surface-group` | `#F5F5F7` | `#232428` | One focus area, settings group or item selection |
| `--surface-hover` | `#F0F1F3` | `#303137` | Row hover, never all cards |
| `--surface-selected` | `#EBF3FF` | `#203249` | Role and selected navigation |
| `--text-primary` | `#1D1D1F` | `#F5F5F7` | H1, object title, body |
| `--text-secondary` | `#5F6268` | `#B5B6BE` | Additional context |
| `--border-subtle` | `#E5E5EA` | `#36373B` | Group lines: visual structure only |
| `--action-fill` | `#0066D6` | `#75B1FF` | Actual filled primary action |
| `--action-text` | `#FFFFFF` | `#0B1524` | Filled primary CTA text |
| `--action-link` | `#0066D6` | `#8ABFFF` | Links, selected controls |
| `--focus-outline` | `#005FCC` | `#B2D5FF` | Keyboard focus, 2–3px |
| `--state-success` | `#176F4D` | `#82DDA8` | Only real confirmed state |
| `--state-warning` | `#805200` | `#F3C572` | Due soon, blocked/pending with text |
| `--state-error` | `#AD2839` | `#FF929B` | Failed, rejected, irreversible |

**Actual contrast calculations** (WCAG relative luminance, compare values with final CSS):
- Primary `#1D1D1F` on white ~**16.83:1**.
- Secondary `#5F6268` on white ~**6.12:1**.
- Proposed filled button `#0066D6` with white text ~**5.42:1**. **Important:** inspiration blue `#007AFF` with white text is only ~**4.02:1**, which does NOT meet 4.5:1 for normal sized button text. Therefore keep `#007AFF` for nontext decoration/large type or darken primary button to `#0066D6` until browser contrast audit.
- Primary `#F5F5F7` on dark canvas ~**17.21:1**.
- Secondary `#B5B6BE` on dark canvas ~**9.28:1**.
- Dark CTA `#75B1FF` with `#0B1524` text ~**8.27:1**.
- Subtle border `#E5E5EA` on white only ~**1.26:1** and MUST NOT be the only way a required control is recognizable; use text/position/background/focus and 3:1 meaningful control edge when necessary.

**Never blindly copy dark gray chips U03 or muted blue U04 whose screenshot has insufficient contrast at small sizes.**

## III. Typographic hierarchy and line lengths

- System stack `-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Arial, sans-serif` for existing installed typefaces only. Do not redistribute proprietary SF Pro font or SF Symbols assets.
- H1 ≈34px desktop/30px mobile, weight 680–720, line 1.12, letter-spacing only gently negative for large display.
- Selected object heading ≈22–25px, semibold 650; section heading ≈17–18px; row heading ≈14–16px and 1.4 line height.
- Secondary ≈13–14px at AA contrast, true metadata minimum ≈12px and never for risk/consent/deadline.
- Single reading column maximum ~760px for long lessons/forms; tables/analytics can use a wider 1120px canvas; no 100-character body line on 4K monitor.
- Rows aligned to same 4/8px grid. Use no all-caps editorial `МОЁ ПРОСТРАНСТВО` or three competing typographic scales in one element.
- Long Russian proper nouns, task titles and field labels wrap naturally; no critical ellipsis without an accessible full value.

## IV. Spacing, shape, soft depth

4px rhythm: **4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48**. Default desktop toolbar 56–68px proposed, sidebar 224–252px with scalable collapsed mode; do not hardcode screenshot's assistant-generated 245px as user-measured truth.

| Element | Proposed sizing | Shape/elevation |
|---|---|---|
| Main first-fold task surface | Content-driven, usually ~180–230px at desktop | 14–18px radius; flat `--surface-group`, no dark heavy shadow |
| App row | 52–64px min height | no card border; subtle separator, 8px hover rounding |
| Settings switch/action | >=44px touch target | conventional toggle with accessible label; U01 soft inset only where contrast survives |
| Primary button | min 44–48px tall | 10–12px radius; **one** saturated blue CTA |
| Secondary text action | 44px target, not necessarily filled | plain link/button with modest hover |
| Sheet/popover | fit content, 12–16px corners | one low neutral shadow / functional translucency only |
| Dialog | focused one decision, descriptive action | opaque content; modal backdrop and focus trap |
| Input | 42–48px controls, readable placeholder + visible label | subtle stroke, visible focus; not U01 inset pill for every field |
| Progress | 4–6px track with real denominator; if unknown plain text | subtle inset possible, no false percent |
| Segmented view chooser | 2–4 local modes | selected fill, same route unchanged; no global tabs disguised as local |
| Heatmap/table | fit actual data and keyboard | no decorative blue bars representing unknown data |

Avoid applying neumorphic double-shadow to every row: it creates "button or not?" ambiguity and hurts dense information displays. Use it sparingly for a single actual button/switch when warranted.

## V. All shared components & behavior contract

| Component | L0 visible | L1 / on demand | Keyboard, mobile, error |
|---|---|---|---|
| Sidebar | role+active destination, 3–5 meaningful category labels | expand current group, unknown allowed label fallback, optional collapse | 2 levels max, original index, drawer focus trap |
| Global toolbar | back, contextual title, search, notification, account, theme switch | rare help/export/profile settings in account menu | Ctrl/Cmd+K search, Escape, no duplicated top nav |
| Search | current query/scope, result label/type | filters only if relevant | keyboard active result, auth-first, empty/error |
| Home action surface | named actual object, status and 1 action | why recommended, related tasks, advanced tools | no fake CTA on pending/restricted, full width at 390px |
| Grouped list | title, important state/date and selection | filters, sort, pagination | no row click mutation, selected persisted |
| Inspector | selected record, evidence and allowed action | history, documents, metadata, audit | focus return, Back, modal sheet on compact |
| Form | step name, required fields, next/save | optional fields by step | dirty guard, errors adjacent, idempotency |
| Upload | chosen actual files, progress, validation | version/source metadata | unsafe files rejected, final server ack |
| Messages | dialogs/thread/composer | files/members/thread history | drafts preserved, send/delivered distinct |
| Chart/calendar | data source, real point/time | day detail, metric filter | accessible table equivalent, no fake zeros |
| Alerts | risk and consequence text | link to evidence/undo where allowed | severity-appropriate interrupt, not green decoration |
| Theme | `Светлая / Тёмная / Как в системе` | no second competing preference | existing `impulse-theme` persistence and system subscription |

## VI. Motion and sensory discipline

- Transitions typically 120–200ms: chevron, row hover, selected surface. Hover isn't the only sign of an action.
- `prefers-reduced-motion`: no decorative movement, preserve semantic focus feedback.
- No infinite pulsing, giant shimmering cards, autoplay carousel, moving gradients, bouncy metric counters.
- Toggle/checkbox/slider U01/U04 softness is functional, not decorative. Switches must have explicit "on/off" programmatic state, not color only.
- Disable false optimistic business states. "Отправлено" only after backend response; long uploads report progress and integrity.

## VII. Light/dark functionality and acceptance

- Both themes must preserve all 49 route sections and 42 action families; no hidden text, white-on-white, dark-on-dark, broken thumbnail/content.
- User chooses light/dark/system, persists through existing `app/theme.ts`. Live system changes apply in auto mode; app should respect user preference even if original style reference was white.
- 1440×900 / 390×895 visual screenshot review + 320px, 200% zoom, Yandex Browser on Windows, Safari on macOS and touch input as available. The user U01–U04 are stylistic inputs, *not* pixel-exact template screens for desktop web geometry.
- Distinct visually-reviewed dark screenshots are required before "dark approved"; not an inverted image.
- Video/social-rich imagery should be used only if real product content benefits (events/proof), never to fill empty whitespace.

## VIII. Release blocker

A migration is not accepted because the CSS matches a palette. First ensure the actual content question and action are correct; then review screenshot; then verify functional parity, consent, source and keyboard; only then deploy an exact signed-off revision. Existing production remains unchanged while this SDD is refined.
