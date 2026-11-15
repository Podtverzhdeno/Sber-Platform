# Apple Sketch → Impulse: shared surfaces and live messaging

## Change status
**Implemented on feature branch, review pending.** This integration changes the appearance of the real Impulse UI, not navigation, routes, APIs, server authorization, form state or messages. It is **not** a claim that all 49 pages are pixel-perfect replicas of native iOS/macOS 27.

## Sources and actual measurements

The owner supplied original `Messages(1).sketch` and `TipKit(1).sketch`; the earlier connected iOS 16 community Figma was also inspected with `get_design_context`.

| Source file and symbol | Source measurements | Impulse implementation |
|---|---|---|
| `Messages(1).sketch` — `Chat List / Light` / `Chat List / Dark` | 402×79 px source artboard, 79px row height | `.msg-dialog-list__row` and its row item have 79px minimum height |
| `Messages(1).sketch` — `Chat / Light / Message Bubble / Text - Friend` | 97×40 px example bubble; source fill `#E9E9EA` | incoming message background `#E9E9EA`, 40px min-height |
| `Messages(1).sketch` — `Chat / Dark / Message Bubble / Text - Friend` | 97×40 px; source fill `#262629` | dark incoming message background `#262629` |
| `Messages(1).sketch` — `Chat / Light / Toolbar / Keyboard Collapsed` | 402×70 px example | composer at least 70px |
| `Messages(1).sketch` — `Chat / Light / Toolbar / Keyboard Expanded` | 402×60 px example | composer at least 60px while focused; can grow to fit real content |
| `Messages(1).sketch` — `Chat / Light / Toolbar / Keyboard Expanded` | `Search Field` 314×43 px; focus caret `#0091FF` | text input shell min-height 43px; matching focus ring color |
| `Messages(1).sketch` — toolbar `Button` | 44×44 px | composer send action at least 44×44 px |
| Figma iOS16 nodes `839:9700`, `839:9728` | Filled button accent `#007AFF` (light), `#0A84FF` (dark), 50px height, 14px radius | matching web accent tokens; outgoing chat uses accents as an **intentional cross-file adaptation**, not a claimed exact Messages bubble measurement |

Only colors and dimensions listed as measured above can be called **source-verified**. Web cards/tables/overlays and outgoing message bubble spacing are stylistic **adaptations**, pending actual macOS/iOS 27 Figma node extraction. No proprietary fonts, images, SF Symbols or Sketch source files are bundled.

## Wired into product code

1. `frontend/src/components/ui.tsx` imports `apple-sketch-core.scss` so the real shared `Badge`, `Card`, `DataTable`, `Modal`, `Drawer`, `Tooltip`, `StatePanel` adopt consistent palettes and surfaces wherever rendered under `.page-shell`.
2. `frontend/src/features/collaboration.tsx` imports `messenger/apple-sketch-messages.scss` **after** the existing `reference.scss`. All three render states (loading, error, normal) carry `apple-messages-2026` alongside all existing class names and accessibility data attributes.
3. `MessagingWorkspace` is used by multiple roles, so this updates all role-specific chat entrypoints while preserving the original React actions (send, reply, search, pin, mute, contact selection, upload refs, context switching and mobile panes).
4. Light/dark modes inherit the single `data-theme` switch on the root. No new theme store introduced.

## Safety and release acceptance

- No change to `App.tsx`, backend, `main.tsx`, API client, routes, local state, permissions, snapshots, seeded data or protected worker areas (Bootcamp and trajectory).
- Protect baseline: ESLint, TS typecheck, Vitest and production Vite build, then existing Playwright role/messaging scenarios and light/dark 390/1024/1440 screenshot comparison.
- Source-inspired CSS does not grant the web app any native iOS keyboard capabilities or fake attachment picker.
- Do not auto-update screenshot goldens to conceal changed geometry; ensure functional regressions are fixed first.
- Hold PR for independent review before main and Railway. Keep the existing production release intact if baseline CI is red.
