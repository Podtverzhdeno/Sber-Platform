# Impulse · Figma UI Kit source map (2026-11-14)

> **Status:** verified source inventory + partial iOS 16 node extraction, **not** 1:1 pixel acceptance of the new iOS/macOS 26/27 kits. Companion machine-readable source: [`figma-apple-kit-source-manifest-20261114.json`](figma-apple-kit-source-manifest-20261114.json).

## 1. The reference baseline

Impulse is primarily a **desktop web application** with mobile entry points, not an iPhone-only application. Therefore use **one coherent Apple generation** rather than patching in 2015–2027 components indiscriminately:

- **Desktop, default candidate:** [Apple macOS 27 UI Kit](https://www.figma.com/community/file/1651309434229735362/macos-27): window, toolbar/titlebar, sidebar, tables, forms, popovers and dialogs.
- **Mobile/tablet, matched generation:** [Apple iOS/iPadOS 27 UI Kit](https://www.figma.com/community/file/1651309003795292092/ios-and-ipados-27): adaptive navigation, buttons, grouped lists, text fields, pickers, alerts, sheets.
- **Exact prior-generation reference:** [iOS/iPadOS 26](https://www.figma.com/community/file/1527721578857867021/ios-and-ipados-26) and [macOS 26](https://www.figma.com/community/file/1543337041090580818/apple-design-resources-macos-26). Do not mix component metrics with 27 without a measured deliberate deviation.
- **Earlier functional precedents:** [official iOS/iPadOS 18](https://www.figma.com/community/file/1385659531316001292/ios-18-and-ipados-18), the third-party [iOS 16 UI Kit](https://www.figma.com/community/file/1121065701252736567/ios-16-ui-kit-for-figma), and the other older/community kits below. Keep them out of the primary 27 visual baseline.

Official version source: [Apple Design Resources](https://developer.apple.com/design/resources/). Apple made iOS/iPadOS/macOS 27 UI Kits available in June 2026; current public resource page links directly to these Figma community files. This is more recent than the owner's iOS 26 example. The choice of **27 as a reference target is a design recommendation**, not proof that any 27 layer has been extracted.

**Functional override:** The owner requested a hidden-at-rest floating role menu on all sizes. Apple HIG may use a persistent desktop sidebar; in Impulse the existing reversible overlay remains, with the visual treatment chosen from the coherent macOS 27 kit. The server continues to authorize navigation and define indexes.

## 2. Available references and their evidence levels

| Source | Origin / role | Evidence as of 2026-11-14 |
|---|---|---|
| [iOS/iPadOS 27](https://www.figma.com/community/file/1651309003795292092/ios-and-ipados-27) | Apple; primary mobile/tablet | **LIBRARY INDEXED** by connected Figma MCP; Apple official site confirms link; source nodes **not extracted** |
| [macOS 27](https://www.figma.com/community/file/1651309434229735362/macos-27) | Apple; primary desktop | **LIBRARY INDEXED**; source nodes **not extracted** |
| [iOS/iPadOS 26](https://www.figma.com/community/file/1527721578857867021/ios-and-ipados-26) | Apple; earlier mobile | **LIBRARY INDEXED**; source nodes **not extracted** |
| [macOS 26](https://www.figma.com/community/file/1543337041090580818/apple-design-resources-macos-26) | Apple; earlier desktop | **LIBRARY INDEXED**; source nodes **not extracted** |
| [iOS/iPadOS 18](https://www.figma.com/community/file/1385659531316001292/ios-18-and-ipados-18) | Apple; interaction fallback | **PUBLIC CONFIRMED**, not indexed/read in user's connected source |
| [iOS 16 UI Kit](https://www.figma.com/community/file/1121065701252736567/ios-16-ui-kit-for-figma) | Third-party community reference | **SOURCE NODES VERIFIED** through user's Figma [design file](https://www.figma.com/design/51dkjSuhgFyyeGV2cWLxex/iOS-16-UI-Kit-for-Figma--Community-?node-id=1002-6668): first five high-fidelity button/field variants, four metadata-only examples |
| [iOS 15 UI Kit](https://www.figma.com/community/file/984106517828363349/ios-15-ui-kit-for-figma) | Third-party/older | **LINK ONLY** |
| [Itty Bitty iOS 16](https://www.figma.com/community/file/1172051389106515682/ios-16-ui-kit-by-itty-bitty-apps) | Third-party/older | **LINK ONLY** |
| [iOS 26 Liquid Glass](https://www.figma.com/community/file/1514237154489556536/ios-26-liquid-glass) | Community visual supplement | **LINK ONLY**, not the authoritative Apple resource |
| [iOS 27 Widgets](https://www.figma.com/community/file/1253436284170910973/ios-27-widgets) | Widgets reference | **LINK ONLY**, optional in compact dashboard only |
| [Android & iOS Keyboards Kit](https://www.figma.com/community/file/946157263507080040/android-ios-keyboards-kit) | Virtual keyboard examples | **LINK ONLY**; do not render fake keyboards in the product |
| [Bootstrap 5 Design System](https://www.figma.com/community/file/1044316192441037087/bootstrap-5-design-system-ui-kit) | Generic web system | **LINK ONLY**; not a 1:1 Apple design source |
| [Dynamic Layer FREE](https://www.figma.com/community/file/1226993304994576514/dynamic-layer-free-mobile-app-ui-kit-and-design-system-v5-1) | Generic community patterns | **LINK ONLY**; not an Apple design source |

**MCP library proof:** `get_libraries` on connected file `51dkjSuhgFyyeGV2cWLxex` returned `iOS and iPadOS 26`, `macOS 26`, `iOS and iPadOS 27`, `macOS 27` in `libraries_added_to_file`. That establishes library association, **not** detailed geometry/variables/code. Querying those libraries' component sets via `search_design_system` was attempted and returned **Figma Starter MCP rate-limit**. Do not equate indexed with downloaded or accepted.

## 3. Source-verified iOS 16 elements (first wave, before quota block)

| Control | Exact Figma node | Extracted values | Evidence |
|---|---|---|---|
| Filled button, light | `839:9700` | 50 px control; radius 14; horizontal padding 20; vertical padding 14; `#007AFF`; 17/22 px semibold, tracking −0.408 | `get_design_context` + screenshot |
| Tinted button, light | `839:9707` | same geometry; translucent `rgba(0,122,255,.15)`; label `#007AFF` | `get_design_context` + screenshot |
| Filled button, dark | `839:9728` | 50 px; `#0A84FF`; white text | `get_design_context` + screenshot |
| Text field, light default | `211:5737` | 390 × 44 px; leading inset 16; 0.5 px bottom separator; 17/22 text | `get_design_context` + screenshot |
| Text field, light active | `211:5752` | 390 × 46 px canvas including cursor; 17/22 text | `get_design_context` + screenshot |
| Toggle, light active | `10:2583` | 51 × 31 px **size only** | `get_metadata` — styling unverified |
| Segmented picker, 2 options | `6:823` | 343 × 32 px **size only** | `get_metadata` — styling unverified |
| Table view, light | `151:5289` | 358 × 224 px **example size only** | `get_metadata` — styling unverified |
| Alert modal, light | `10:2291` | 337 × 200 px **example size only** | `get_metadata` — styling unverified |

Extracted first-wave controls are implemented **on draft PR [#170](https://github.com/Podtverzhdeno/Sber-Platform/pull/170)** under `frontend/src/features/figma-ios16-kit/`. These do **not** yet replace all controls in Impulse. Other variants are still unverified, and native-browser font fallback will differ from SF Pro on Windows.

## 4. Product-wide component crosswalk

For **each** family below, the **exact 27 node / screenshot / variables are still required**; family names are the *extraction checklist*, not a claim of verified node access.

| Impulse UI / behavior | macOS 27 (desktop) | iOS/iPadOS 27 (mobile) | Special functional contract |
|---|---|---|---|
| Workspace shell, role-specific topbar | Window, titlebar, toolbar | Navigation bar | Same existing role, controls, deep links |
| Collapsible role navigation | Sidebar/list and contextual menu appearance | Sheet/list or responsive navigation | Owner's overlay hidden at rest; backend navigation remains source of truth |
| Primary, secondary, destructive actions | Push/toolbar buttons | Filled/tinted/plain buttons | Existing handlers, loading, disabled, focus, destructive semantics |
| Search and text editing | Text/search fields, combo boxes | Text/search fields | Query/validation/source data unchanged |
| Catalogs, users, courses, tasks | Dense table/list/detail views | Grouped/list cells | Sort/filter/pagination remain; accessible overflow |
| Filters and settings | Segmented, checkboxes, pop-ups, radio buttons | Segmented, toggles, menus | URL filters and preference persistence |
| Project/task creation and acceptance | Form layout, selects, date controls | Form inputs, pickers and sheets | Required values, deadlines, attachments and approval flow retained |
| Review and dispute dialogs | Alerts, popovers, dialogs | Alerts, sheets, action sheets | Focus trap, Escape, separate confirmation of critical actions |
| Course/practice progress | Progress indicator and list | Progress indicator/list | Never invent progress denominators |
| Calendar and schedule | Calendar/date/time controls | Date/time picker | Dates/timezones and event assignments unchanged |
| AI assistant and messaging | Split view/message composer | Messaging/text input | Actual sending/files/read permissions, not a static mock |
| Rating and analytics | Native surface/title/filters with **custom data chart** | Responsive chart/summary | UIKit kits are **not** a verified source for product-specific plots |
| Document uploads | Browser native file control within kit-styled form | Browser OS picker | Do not imitate a native OS picker or lose upload semantics |

### Role routes / required families

- **Participant:** Главная, путь/траектория, Bootcamp, задачи, проекты, события, рейтинг, портфолио, достижения, аналитика, сообщения, AI-Buddy, настройки → shell + lists + course progress + forms + filters + charts + messaging.
- **Mentor:** Главная, проверка вкладов/ревью, проекты, участники, сообщения, аналитика, AI, план недели → data tables + evidence review + dialogs + assignments.
- **Customer:** Главная, свои задачи, создание задачи, заявки/кандидаты, приёмка, аналитика, сообщения, база участников, AI, настройки → wizard/forms + tables + attachments + confirmation.
- **Manager:** Главная, инициативы, команда, аналитика, результаты, календарь, база участников, настройки → split-view + table + summary/chart + calendar.
- **HR:** Главная, кандидаты, воронка, аналитика, сообщения → search/filter + table + profile + pipeline + messaging.
- **Operator:** Главная, очередь, проверки, задачи/проекты, выплаты, споры, пользователи, события/трофеи, аналитика → dense tables + status + alerts/dialogs + decision evidence.

The precise **server-returned authorized labels and route indexes are dynamic**. Do not use this catalog as an alternate ACL or generate fake routes from these names. The current grouping source is `frontend/src/features/calm-navigation/model.ts`; keep unknown but server-allowed labels accessible.

## 5. Implementation and source extraction gate

1. Resolve a **real `/design/<fileKey>?node-id=...`** URL (a public numeric `/community/file/<id>` is **not** itself a Figma design file key) for each desired Apple component family, or search its connected library directly.
2. For every component variant, read `get_design_context` **with screenshot**, then relevant `get_variable_defs` and component properties; save node IDs and measured light/dark states in the JSON manifest.
3. Verify Figma usage rights. Figma's official Apple UI Kit requires agreeing to Apple Design Resources EULA when inserting assets. Do **not** redistribute SF Pro fonts or embed short-lived Figma asset URLs in the web application.
4. Implement a reusable **real React component**, never a static SVG/PNG replacement for a working form. Bind existing handlers, loading, focus, keyboard, permissions, URL/state.
5. Replace callsites by capability/role group, testing `1440×900`, `1024×768`, `390×844`, light/dark, and browser visual diff against the matching reference node. Treat unverified pixel offsets as unknown.
6. Independent code/design review and exact-SHA CI are prerequisites for calling a group finished or merging into `main`; Railway deploy requires its separate approved gate.

**Current blockers:** Figma MCP connected and authenticated, but Starter tool-call allowance is exhausted; Browser Use and TinyFish public-browser runs have insufficient credits. This catalog is a real source discovery deliverable, **not** a claim of full extraction for all kits. Do not retry the same blocked providers without a changed entitlement.

## Source notes

- [Apple Design Resources](https://developer.apple.com/design/resources/) — latest Apple-maintained native design kits (iOS/iPadOS 27, macOS 27).
- [Apple design-kit release announcement](https://developer.apple.com/news/?id=e2lxw9l1) — June 23, 2026.
- [Figma's official Apple UI Kit guidance](https://help.figma.com/hc/en-us/articles/24037833895831-Get-started-with-Apple-s-UI-kit) — licensing and SF Pro considerations.
- [Figma's UI Kit library guidance](https://help.figma.com/hc/en-us/articles/24037724065943-Start-designing-with-UI-kits) — library components and available plans.
