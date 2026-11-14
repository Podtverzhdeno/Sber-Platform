# Apple UI reference audit — Impulse / Главная участника

**Research date:** 2026-11-14 · **Scope:** macOS-like desktop and compact iPhone-like mobile patterns for a **web** application.  
**Status:** design research, not an approved screenshot or copied Apple resource.

## Evidence hierarchy

Use first-party Apple Human Interface Guidelines (HIG) and Apple Support screenshots as reference. Third-party visual interpretations do not establish Apple's design rules.

| First-party reference | Observed principle | Proposed Impulse decision | What NOT to copy |
|---|---|---|---|
| [HIG: Design principles](https://developer.apple.com/design/human-interface-guidelines/design-principles/) | Simplicity is focused usefulness, *not* removing features; purpose, agency, familiarity, craft, feedback | One next action, clear navigation, quick access to supporting tools after intent; recoverable UI | Blank page with no discoverable work |
| [HIG: Layout](https://developer.apple.com/design/human-interface-guidelines/layout) | Hierarchy through spacing and content alignment, progressive disclosure, adaptability; controls distinct from content | One content column; minimal separators; details on request; responsive reorganizes rather than deletes capability | Nested multi-column card dashboard by default |
| [HIG: Sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars) | Sidebar for primary destinations, group nested links, hide when cramped | Keep existing authorized navigation now; future **separately claimed** shell iteration may make it quieter/collapsible | Unreviewed changes to global `App.tsx` or sidebar of other roles |
| [HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials) | Liquid Glass is for floating functional/navigation layer; opaque/standard material for main content | Glass-like translucency only for optional floating controls/toolbar when implemented; main task, metrics and curriculum remain solid white | Glass cards, blur and shadows applied to every data row |
| [HIG: Color](https://developer.apple.com/design/human-interface-guidelines/color) | System semantic surfaces; color should carry interaction/status meaning; single emphasized primary control | Neutral whites, grays, black text; small branded accent only on **one** action and interactive selection; real status with text | Multiple saturated cards, gradients, decorative green glow |
| [HIG: Lists and tables](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables) | Rows and grouping are efficient for primarily textual productivity information | Tasks, courses, skills as aligned, selectable rows separated subtly; detail panels rather than extra cards | Every line of text placed in its own bordered card |
| [HIG: Menus](https://developer.apple.com/design/human-interface-guidelines/menus) | Reveal secondary commands on demand; group by purpose; avoid deep nesting | Compact overflow/More for occasional tools, direct primary CTA always visible; at most one menu level | Hiding an essential task behind two or three nested menus |
| [HIG: Popovers](https://developer.apple.com/design/human-interface-guidelines/popovers) | Small and temporary; avoid large complex content and important warnings | Popover only for tiny context/status; level requirements with many courses use sheet/inline detailed region | Complex course requirements in tiny floating tooltip |
| [HIG: Designing for macOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-macos) | Keyboard/pointer first, short and prolonged sessions, adjustable density | Hover hints as enhancement; discoverable keyboard, one-column readable content on desktop; compact touch when narrow | Assuming every user is on Apple hardware |
| [Apple UI Design Dos and Don'ts](https://developer.apple.com/design/tips/) | 44pt touch hit targets, legible text, contrast, content must fit without horizontal scrolling | >=44px meaningful interactive targets, responsive 320–1440px, visible focus | Tiny icon-only tap controls |
| [Apple Support: Reminders on Mac](https://support.apple.com/guide/reminders/get-started-remne4b02adc/mac) | Named smart lists and brief task rows, secondary info in details | A contextual next task with list/disclosure for work, not a large decorative hero | Apple branding, logos, task copy, copyrighted icons |
| [Apple Support: System Settings on Mac](https://support.apple.com/guide/mac-help/mh15217/mac) | Clear category navigation and grouped settings rows | "Мой уровень" opens purposeful details with grouped courses + practice + source/status | Reproducing screenshot pixels, platform-specific title bar and native system chrome |

**Critical interpretation:** an Apple-like app is not "white dashboard with rounded cards." Its quality comes from restraint, alignment, one clear next action, task-level information architecture, adaptive presentation and predictable recovery.

## Fit-to-purpose audit of the current Calm home (as implemented before Apple-grade refinement)

| Current decision | Issue | Replacement for next design iteration |
|---|---|---|
| Entire `.calm-home` is one large bordered radius-26 container inside the existing shell | A "card inside the page" makes the page look like a website module, not a macOS workspace | Outer page canvas should be nearly borderless; local sections are distinguished by gap or hairline |
| A 270px focus hero with eyebrow, kicker, subhead and fixed decoration concept | Large marketing-card framing delays actual work | Compact, typographic "Продолжить..." row with one button; no art or slogan |
| Three individually framed metrics in one large box | Data competes with action and looks like BI/dashboard | One lightweight inline progress/status strip; click reveals exact criteria |
| Mandatory uppercase "МОЁ ПРОСТРАНСТВО / В ФОКУСЕ / РИТМ РАЗВИТИЯ" | Adds scanning noise and feels editorial/marketing | Short labels "Главная", "Продолжить", "Прогресс"; no decorative overlines |
| Primary green CTA + multiple green/rounded surfaces | Several visual accents compete, resembles SaaS more than Apple | Only one emphasized tint/CTA; defaults are neutral |
| Native `details` sections expose many dense mini-cards on expansion | Correct disclosure principle, but revealed content remains overly dashboard-like | An Apple Reminders/Settings-style list with clear row hit areas and grouped details |
| Current shell remains colored, fixed global sidebar | Home alone cannot produce a literally identical Apple-window appearance | **Separate later shell lane only after owner decision**; do not break other roles now |
| "Практические навыки" previously counted all skill records | Risks misrepresenting verified accomplishments | Use `confirmedPassportSkills` and label explicitly as evidence-backed |
| Bootcamp route must include track from `next_outcome` | Can open correct course in wrong role context | Ensure course link always passes authorized trajectory key |
| Legacy-home snapshots measure old screenshot geometry | Not acceptance criteria for the new home | Keep them on `?home=legacy`, add dedicated pixel/interaction acceptance for new home |

## Apple-like web fidelity: practical limits

1. **Not a native macOS app.** `backdrop-filter`, native font rasterization and system window controls render differently on Windows/Yandex Browser, macOS and mobile. Visually close is possible; pixel-identical system chrome is not a meaningful web acceptance criterion.
2. **Do not bundle Apple's fonts, SF Symbols assets or Apple-branded logos.** Use installed system font stack and existing licensed web icons. If desired, evaluate licensed Inter on Windows; do not distribute proprietary Apple font files.
3. **No derivative UI screenshot assets in the product bundle.** Apple Support screenshots are linked only as design-analysis references; Impulse retains its own name, routes, content and visual identity.
4. **User stays in control.** No fake metrics, invented certificates/levels, automatic status changes, or hidden irreversible action.
5. **Avoid design dogma.** For a training/workflow platform, requirements and course access must be reachable within two intentional interactions; never sacrifice usability to white space.

## High-level choice

**Selected pattern:** `macOS Reminders + System Settings` working surface, with a touch of modern quiet translucent *navigation* (not glass-heavy data tiles). Finder supplies the principles of sidebar navigation and uncluttered toolbar; it is not a literal template for task content.

**First-fold target:** one page title, the relevant trajectory context, one real next step and its primary action, one compact progress summary. Everything else is **available** (not vanished) through one clearly labeled detail row or button.

**Rollout gate:** user reviews the first-fold prototype + mobile states before any further global-theme/sidebar redesign. The current production is pinned to an earlier commit; this document alone makes no runtime changes.
