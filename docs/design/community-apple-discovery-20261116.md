# Impulse · Сообщество — Apple HIG-inspired discoverability (2026-11-16)

## Bounded change, true source of navigation
Real participant pages in production: `События` and `Сообщения`. `CommunityNavigation` obtains authorized server labels from `/api/v1/me`; `communityDestinations(actor.navigation)` resolves indices dynamically. Do not create shadow copies, reorder the role's routes, or fake message links. Existing filter/search, event registration and evidence, chat transport, unread states, attachments and permissions remain unchanged.

The problem: at 320–390px the **four event categories** (`Для вас`, `От Сбера`, `Популярные`, `Скоро дедлайн`) are rendered as `overflow-x:auto; flex-wrap:nowrap`, so discovery is unexpectedly hidden off-screen. Two core Community destinations have no icons and desktop link targets are 40px. The user's requirement is Apple-like minimalism with *everything accessible*.

## Design sources and boundaries
Official Apple:
- [iOS/iPadOS 27 design resources, Figma/Sketch](https://developer.apple.com/design/resources/) — official editable component source **linked only**, not copied or claimed as inspected pixel geometry
- [HIG Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars) — navigation vs actions; retain section labels; avoid hidden overflow tabs
- [HIG Layout](https://developer.apple.com/design/human-interface-guidelines/layout) — familiar adaptive organization when resized
- [HIG Search fields](https://developer.apple.com/design/human-interface-guidelines/search-fields) — distinguish search scope and preserve results semantics
- [HIG Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons) — clear secondary and primary actions
Local self-authored guidance: `Apple UI kit/HIG_BEHAVIOR_RULES.md`, `Apple UI kit/06-cases/03-messaging`, `04-inputs-and-controls`, `07-mobile-adaptive`, `08-accessibility`.

This is a **web interpretation**. Native Apple components, SF Symbols, proprietary layers, actual iOS 27 blur/glass or 1:1 pixel accuracy are **not claimed**.

## Interaction and information architecture
- Section chrome `События | Сообщения`: **two visible links**, icon+label, 44px+ target, selected state conveyed with `aria-current=page` and solid surface; keyboard focus, reduced motion, light/blue/midnight themes.
- Desktop Events has a concise `Сообщество` heading; Messenger stays **compact** so it does not obscure the conversation or consume an extra tall hero.
- Category choice is a same-screen filter, **button + aria-pressed**, not route navigation. On <=650px use a **2×2 grid**: all four categories immediately visible, min 46px touch targets, no sideways scrolling. On wider displays allow standard inline strip.
- Search and `Фильтры` remain separate actions below categories on phone, both >=44px; popup is bounded within viewport, Escape closes it, document scroll remains vertical. Sort remains discoverable; category choice and search are live client state.
- Event cards remain opaque and source-backed, never invent counts or hide stale/error states. Event detail, registration and evidence untouched. In Messaging, never move the chat composer or alter delivery.

## Acceptance / failure cases
- 320,390,560,820,1440 px × light,blue,midnight: no document or category-strip horizontal overflow; 4 categories visible; both authorized destination links on screen; main actions >=44px.
- Category buttons change selected `aria-pressed`; search produces real no-results state and recovers after clearing; filter popover opens and Escape closes; no clipping at 320px.
- `События → Сообщения → События → Back` preserves actual server-authorized indices and compact Messages navigation; deny missing Messages.
- Unit checks labels+icons and existing permission-gating; axe scoped to navigation.
- Existing event detail, registration, Messenger reference E2E unchanged and run as a regression gate.
- Scoped TypeScript, ESLint, Vite, Chromium and architecture review required before main → Railway. Full CI can contain independent legacy failures; no claim of whole-site acceptance.

## Source-level scope
`frontend/src/features/participant-community-hub/CommunityNavigation.tsx`, `community-navigation.scss`, `events-apple.scss`, `CommunityNavigation.test.tsx`; one new E2E, independent workflow, spec, isolated coordination claim.
No edits to `App.tsx`, `collaboration.tsx`, `participant-events.tsx`, API/backend, global theme or shell, event filters/registration contracts.
