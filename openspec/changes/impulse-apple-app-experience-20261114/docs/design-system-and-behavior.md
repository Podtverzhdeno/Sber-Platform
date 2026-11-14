# Apple-like Impulse Design System · visual & interaction contract

This is a **web-adapted design system**, not Apple’s proprietary UI kit. Reference HIG: [principles](https://developer.apple.com/design/human-interface-guidelines/design-principles/), [layout](https://developer.apple.com/design/human-interface-guidelines/layout), [materials](https://developer.apple.com/design/human-interface-guidelines/materials), [color](https://developer.apple.com/design/human-interface-guidelines/color), [toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars), [menus](https://developer.apple.com/design/human-interface-guidelines/menus), [split views](https://developer.apple.com/design/human-interface-guidelines/split-views), [lists and tables](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables), [macOS design](https://developer.apple.com/design/human-interface-guidelines/designing-for-macos), [writing](https://developer.apple.com/design/human-interface-guidelines/writing), [accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility). Confirmed observations: white/neutral content layer, distinct functional navigation, progressive disclosure, familiar context menus, context-sensitive inspector; Apple explicitly says simplicity ≠ stripping functions.

## 1. Design thesis

White and calm, tactically "futuristic" through precise typography, generous space and motion restraint — not blue-green gradients, holograms or gratuitous frosted cards. **One accent color and one dominant CTA in each context.** State and provenance take precedence over visual minimalism when decisions could cause harm. Stable layout on loading and error.

- **Page canvas:** borderless white (#FFFFFF) under default light theme; soft grouped surfaces (#F5F5F7) only for tightly related rows/settings, not one giant framing card.
- **Functional overlay:** discrete toolbar/sidebar/menu popover may use translucent material when text contrast can be guaranteed; never blur critical data, tables or card contents. Respect `prefers-reduced-transparency` where detectable.
- **Dividers:** 1px neutral (#E5E5EA) between rows; whitespace separates groups. Selected row subtle blue-tinted background. No large multi-card dashboards where lists work.
- **Text:** primary neutral ink (#1D1D1F), secondary (#5F6268), tertiary only when AA legible. Dark theme uses ink ~#F5F5F7 and calm dark content ~#111316, grouped ~#1F2125; don't invent an untested high-contrast palette.
- **Accent:** suggested #007AFF (web interpretation; not licensed Apple color token), applied to *one* primary CTA, selection, focus-related links. Impulse identity preserved through logo/name and restrained accent rather than Apple branding.
- **Status:** muted neutral for informative; orange/yellow warning for pending/blocked, red for danger, green verified-success **with textual label**, never colored badge on every card.
- **Fonts:** `-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Arial, sans-serif`. Render in Windows Yandex Browser, Mac Safari and Android Chrome; no bundling of SF Pro/SF Symbols or Apple asset fonts.

## 2. Typographic & spatial scale (proposed web CSS tokens, not HIG numeric requirements)

| Role | Web size | Weight / line | Notes |
|---|---:|---|---|
| Page title | 32–36px desktop / 28–32px mobile | 680–720, 1.12 | Only one `h1`, short text, no all-caps label above |
| Main action title | 22–26 / 20–22 | 650, 1.2 | Real object title, wrap if long |
| Section | 18–20 / 18 | 630, 1.25 | Aligned to content rows |
| Row title | 15–16 | 580–650, 1.35 | Readable at 200% zoom |
| Body | 14–16 | 400, 1.45 | Forms and descriptions |
| Secondary | 13–14 | 420, 1.4 | Status, verified/estimated distinction |
| Micro metadata | minimum 12–13 | 500 | Never hide warnings in 10px captions |

Spacing: 4/8/12/16/20/24/32/40/48px; desktop content max text width 1120px, reading columns 680–760px, 32px margins; mobile 16px margins. Cards/rows radius 10–14; transient popover 12–18; primary button ~12. Keep progress 4–6px only when denominator real.

Controls: actionable touch area >=44×44 CSS px for mobile, desktop condensed if still usable; minimum 44px for icon-only targets; `focus-visible` 2–3px outline with adequate contrast. No hover-only features. Selected/hover state should not shift layout or flash; transitions 120–200ms and no nonessential motion when `prefers-reduced-motion`.

## 3. Shell, navigation and tools

**Desktop**: role-authorized sidebar (initial width ~240px, user can collapse) + one toolbar + content; optional inspector at 320–360px. Primary group shows current role and `Главная`; 3–5 named groups (Развитие, Работа, Результаты, Сообщество, Настройки etc.). Active group expanded; other groups collapsed **but discoverable**. No more than two sidebar levels. Unknown authorized label appears in «Другие разделы», preserving original `actor.navigation` index. Switch active role in profile only if assigned, with explicit active indicator. Shortcut Ctrl/Cmd+K invokes authorized search; no private person suggestions before server confirms scope.

**Tablet**: sidebar collapses or overlays without shifting content offscreen, inspector becomes edge sheet and preserves context.

**Mobile**: single content column, menu button with current role, drawer with focus trap and close/back; per-page segmented control only when it changes **within same page**, never duplicates global nav. Back button returns to same list filters/selection.

**Toolbar**: page title/back on left, contextual primary command (if any), search, alerts, avatar/role/More on right; rare actions in `Ещё`. Use labelled menus (<2 levels), disable with explanation; destructive commands remain explicit with confirmation.

## 4. Component contract

| Component | User sees | What is hidden until intent | Accessibility / behavior |
|---|---|---|---|
| AppSidebar | Current role, active group, selected destination | Other groups' authorized child links | `nav`, `aria-current`, expand/collapse, keyboard and fallback |
| PageToolbar | Back/title, search, 0–1 primary and notifications/account | Export/help/copy link and uncommon tools | Escape closes overlays, Ctrl/Cmd+K, labels and focus restore |
| PrimaryAction | Specific verb and real object | Nothing essential | Busy/disabled/error, no double mutation |
| GroupedList | Real objects with state/important metadata | Secondary filters, per-row menu | Buttons/links, arrow keys only if genuine composite widget |
| DetailInspector | Selected object, current status, relevant evidence | Long history, version list, audit/export | No loss on selection, close/back restores focus |
| RequirementsSheet | Actual level + required courses and practice | Rare policy history | Opens within 2 clicks, focus trap and mobile full-screen |
| FormStep | Title, required fields, next/back | Optional advanced settings per step | Dirty guard, validation, error summary, mutation feedback |
| EvidenceRow | Source, verification state, date | Full provenance/version/attachments | Access controlled, revoked clearly stated |
| ActivityCalendar | Small real heatmap/list | Day details and filters | Keyboard day navigation and accessible equivalent text/list |
| AnalyticsMetric | Source-backed number + period | Formula, breakdown, export | No synthetic zero or unverified provenance |
| MessageWorkspace | Dialog list + selected chat + compose | Members, attachments, mute, history filters | Read receipts, retry and preserving draft |
| AIHelper | Optional intent entry, trust disclosure | Prompts/history/why/feedback | No consequential action without explicit human confirmation |
| SettingsGroup | Clear label/current setting | Advanced controls | Save reason/consent, disabled explanation, rollback |

## 5. Primary versus hidden: explicit decisions

Show immediately: current object identity, actions required, status that affects user decision, hard deadline, monetary conditions, acceptance/rejection/blockers, reason for disabled action, security/consent warning. Show on request: alternate sorts, advanced filters, custom display, export formats, activity history, less frequent AI prompts, metadata, archived objects, decorative milestones, legal/policy appendix (but mandatory term consent occurs **before apply**).

`More` is NOT a dumping ground for every function. When 2 or more important actions exist, use one primary, then a brief visible row «Требует внимания» with second action; do not bury urgent work.

## 6. Dialog, sheet and inspector behavior

Desktop: selection retains list; inspector shows details in place. On narrow window: details become sheet/fullscreen route with Back. Dialog for short confirmations only, not long multi-section form. Close via Escape and labelled button; show dirty-form confirm before losing unsaved changes; restore focus to opener; background inert for modal. Do not auto-dismiss critical error or success before it can be perceived. Preserve canonical deep link and URL query for direct reload/back.

## 7. Accessibility, performance and robust state

- WCAG 2.2 AA contrast targets: text >=4.5:1, large text and nontext >=3:1; automated + real browser audit.
- Keyboard: Tab/Shift+Tab, Enter/Space, Escape, Ctrl/Cmd+K, focus-visible, logical h1/h2; touch+pointer+screen-reader.
- 320/360/390/768/1024/1440/1920 widths, 200% zoom, Yandex Browser Windows (primary), Safari desktop/mobile, Chromium; no page horizontal scroll.
- Resize app naturally, avoid hardcoded heights and too many three-column cards; long Russian labels wrap.
- Reduced motion; transparency preference; dark/light/system theme and high-contrast behavior. Use semantic colors not literal "green for all."
- Loading skeleton may reserve geometry but never display guessed numbers; network loss preserves draft without false saved confirmation; retry safe GET only.
- Conditional AI and unavailable API: manual route exists; no invisible switching to a mock-success response.
- Performance target to verify in browser: LCP/content no worse than baseline without arbitrary new dependencies; no eager fetch of hidden details, avoid layout shift and oversized UI assets. Formal budget adopted after profiling, not guessed.

## 8. Interaction anti-patterns (release blockers)

1. Several equally weighted CTA panels, gradients, bright shadows, badges on all headings.
2. Hiding deadline, terms, evidence or error in three levels of menus.
3. Reindexing `/workspace/:index` when grouping nav.
4. Duplicating business mutations in client-only UI or claiming a command works when backend absent.
5. Replacing declined/awaiting verification with "completed" in visually attractive label.
6. Deleting existing filters, search, export, editing, attachments, history and deep link to fit first fold.
7. Leaking other roles' private data via animation, search previews or retained inspector state.
8. Bundling Apple fonts, logos, SF Symbols or screenshots as application assets.
