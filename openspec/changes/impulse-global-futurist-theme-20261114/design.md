# Design — global futurist minimalism

## Decisions

**Existing SDD:** `openspec/changes/impulse-apple-app-experience-20261114/design.md` and its 49-route/42-action ledgers remain the contract. This change implements wave S1 (shared shell) and cross-role visual pass; L0/L1/L2 deeper reconstructions remain follow-up implementation per screen.

### Theme

- Use existing `storedThemeChoice / applyTheme / subscribeSystemTheme` and `impulse-theme` localStorage key; no new storage scheme and no backend calls.
- Theme switch visible in header as accessible `<select aria-label="Тема оформления">`: `Светлая`, `Тёмная`, `Системная`. On change set choice → effect updates root `data-theme`. Follow OS changes only if system chosen; default system remains default.
- Semantic tokens replace all global brand backgrounds, white/dark consistent. Light: white canvas, #f5f5f7 subtle grouped background, ink #1d1d1f, graphite secondary, #006fe6 interactive accent. Dark: #111214 canvas, #1b1d21 cards, #f5f5f7 ink, #80b9ff accent. No glass over critical content. System font stack; no proprietary Apple fonts.
- One scoped `futurist-theme.scss` loaded after legacy CSS to bridge old module classes. CSS changes **presentation only**; no hiding of meaningful controls or destructive status labels.
- For API-loaded modules use semantic variable remapping; for old hardcoded gradient cards use background/box-shadow/border reset on known rendered content container classes. Avoid global `*:not(...)` and styling all buttons as primary.

### Navigation and role parity

- Replace legacy rendered sidebar with the already tested `CalmSidebar`, passing `role`, `navigation`, `activeIndex`, `assignedRoles`, `onSwitchRole`. Do **not** reindex routes: `buildCalmNavigation` carries exact array index.
- Customer demo `customerSections` preserved conditionally. Login and authorized workspaces keep current rendering. `CalmSidebar` collapses secondary groups but makes links one click away, all labels including unknown permitted labels under last fallback group. Distinguish `Главная` primary nav.
- CalmSidebar owns mobile drawer and Escape focus trap; old `navigationOpen` / duplicated `mobile-menu` removed. CSS fixed/sidebar shell placement adapted for desktop (244px), tablet/mobile drawer.
- Keep current `workspace-title` focus and screen headings. Inaccessible feature remains restricted; UI visibility never bypasses RBAC.

### Layering / precedence

`styles.scss` → `components/topbar-theme.scss` → `app/futurist-theme.scss`. Brand logo uses Impulse, not Apple assets. Light/dark semantic CSS selectors are explicit, with contrast. Existing scoped CalmHome and AppleSurface use own variables and can be brought into common theme via parent tokens.

### QA and rollbacks

1. Theme choice persists and switches root data-theme; keyboard selects all values, no duplicate search/nav.
2. Six roles: each permitted link appears once with original `/workspace/:index` and no extra permission. Unknown label route in fallback.
3. Login, toolbar, search, notifications, course/task/project/moderation screens retained from existing renderer without mutation.
4. 320, 390, 768, 1024, 1440/1920 and 200% zoom. Sidebar drawer cannot cover permanent user action when closed.
5. Real browser/light-dark screenshot review + CI; if blocked report not run, rather than marking done.
6. Roll back Railway to previous pinned `277a163f` if new rollout fails.
