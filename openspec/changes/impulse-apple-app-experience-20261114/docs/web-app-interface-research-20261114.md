# Real web-app interface references — structure, minimalism and source-backed choices

> **SOURCE CLARIFICATION:** Previous references to “the user's four screenshots from `owner-screenshot-pixel-contract-20261114.md`” were inaccurate: that document measured an assistant-generated Impulse preview. The user's **actual** four screenshots are U01–U04 in `owner-true-originals-analysis-20261114.md`. The old A1/A2 layout measurements are optional assistant proposals, not user-original pixel targets. This research remains about external official patterns, not the provenance of the original photos.

**Research date:** 2026-11-14. **Purpose:** collect primary product references to supplement *user-supplied* four screenshots from `owner-screenshot-pixel-contract-20261114.md`. The user's screenshots remain the visual authority; these sites illustrate how mature web applications sustain information density and functional parity without clutter.

## 1. Source comparison

| Product and primary source | Observed structural pattern | What to bring to Impulse | What NOT to copy |
|---|---|---|---|
| **Apple iCloud Notes** — https://support.apple.com/guide/icloud/create-notes-mmc0cd6edf/icloud | Three-pane web layout: sidebar/folders → searchable note list → opaque detail/editor; restrained chrome | `Мои проекты`/proof review/messaging: list + selected detail, metadata in inspector, explicit save | Apple's branded app icons/OS chrome or system fonts |
| **Linear (2026)** — https://linear.app/now/behind-the-latest-design-refresh and https://linear.app/changelog/2026-03-12-ui-refresh | Sidebar less dominant than content, compact view tabs, smaller quiet icons, fewer/divider subtler borders, consistent toolbar placement across issues/projects/reviews/documents | Shared six-role shell, unified "list + inspector" templates, layout rhythm in **both themes**, status-first rows | Their logo, icon artwork, specific user content, pixel copy of trademark design |
| **Linear (design deep dive)** — https://linear.app/now/how-we-redesigned-the-linear-ui | Designers explored the inverted-L app chrome; tested list/board/split/fullscreen under light/dark, derived palettes from base/accent/contrast and refined UI without changing business model | Use same token grammar for all 49 destinations; actual mixed-density stress tests *before* rollout; review overlays by surface family | Assuming a CSS theme switch alone makes all screens equivalent |
| **Notion** — https://www.notion.com/help/navigate-with-the-sidebar and https://www.notion.com/help/intro-to-workspaces | Sidebar is expandable and customizable; content/editor occupies most screen; local tabs and nested content are separated from top-level navigation | Role-aware `Развитие / Работа / Результаты / Сообщество`; uncommon features only one disclosure away | Infinite navigation nesting (Impulse has only two-level nav by SDD); ambiguous mixed top-level menu |
| **Vercel (Geist)** — https://vercel.com/geist/introduction, https://vercel.com/geist/colors and https://vercel.com/geist/typography | Explicit semantic surface/border/text tiers, minimal functional iconography, a small consistent typography scale for dense dashboards | White/dark variable system, inline status, accurate table density and distinct hover/active/disabled state | Vercel branding or font redistribution; excessive dashboard tile copying |
| **Vercel (project list)** — https://vercel.com/changelog/view-projects-grouped-by-git-repository-with-list-view | Projects as grouped rows rather than mandatory card grid; list/table views for high-density data | `Задачи`, `Рейтинг`, `Инициативы`, `Операционная очередь`: rows with selected details; local view toggle if existing | Artificially forcing all information to single-card carousel |
| **GitHub Projects** — https://docs.github.com/en/issues/planning-and-tracking-with-projects/customizing-views-in-your-project/changing-the-layout-of-a-view | Same underlying tasks presented as table, board, timeline; view-specific filters and configurable fields | Participant projects/customer tasks/HR funnel: preserve all existing list/board/date/filter functions but avoid showing all simultaneously | Introducing unsaved views or hidden query params with no original action |
| **Airtable (record detail)** — https://support.airtable.com/docs/airtable-interface-layout-record-detail | Selected-record detail screen has clear title and stable key-value fields, with actions tied to record context | `Приёмка`, `Проверки`, `Споры`, `Кандидаты`: evidence-first detail and human action without competing metrics | Decorative tags where verified/consent status must be textual and auditable |

## 2. Recommendations in rank order (product fidelity rather than visual trend)

| Rank | Transferable pattern | Utility (1–5) | Functional risk (1–5, lower safer) | Pixel / interaction acceptance |
|---|---|---|---|---|
| 1 | **A1/A2 main geometry** + one primary contextual action (user screenshots) | 5 | 1 | Exact 1440/390 grid and CTA; true next item from API |
| 2 | Linear 2026 light/dark chrome, subdued sidebar | 5 | 2 | Same token grammar in 49 routes, controls readable and one visible theme selector |
| 3 | iCloud Notes split list/detail for evidence, messages | 5 | 2 | 2-pane/tablet/3-pane desktop and fullscreen mobile detail |
| 4 | Geist semantic backgrounds/text/border and typography scales | 5 | 1 | Reusable tokens with contrast AA and deterministic screenshot diff |
| 5 | Vercel grouped row lists | 4 | 1 | Task/status/source rows instead of 3–6 equally weighted cards |
| 6 | Notion group disclosure without removing links | 4 | 2 | Every authorized route one click after expanding group; original `/workspace/:index` |
| 7 | GitHub Projects alternate list/board/timeline only if present | 4 | 3 | Correct filters, selected object and query preserved |
| 8 | Airtable record inspector with source metadata | 4 | 2 | Human decision separated from navigation, disabled/blocked reason visible |

**Not recommended:** full-page Liquid Glass/frosted content, neon green/purple gradients, glowing charts, colored KPI cards, 6 equal-weight buttons, giant overline hero, icon-only navigation without tooltip, hiding essential approval/privacy deadlines under `Ещё`.

## 3. Apple HIG cross-check (2026)

- https://developer.apple.com/design/human-interface-guidelines/layout — leading edges, visual alignment, grouping and progressive disclosure.
- https://developer.apple.com/design/human-interface-guidelines/sidebars — sidebar uses concise two-level hierarchy, can collapse/expand, should not bury critical navigation or info at bottom.
- https://developer.apple.com/design/human-interface-guidelines/materials — Liquid Glass belongs to *functional controls/navigation*, **not** opaque content tables or cards.
- Human-approval decisions, role permissions, private projects and verified achievements are Impulse's own rules; HIG aesthetic does not replace business semantics.

## 4. Screen-to-reference adoption rules

- `Главная` all six roles: **A1/A2 only** for dominant geometry, CTA/facts/disclosures; no dashboard tile wall.
- `Моя траектория`/`Bootcamp`: Apple Notes list/detail + Linear topic/inspector; exact role/curriculum preserved.
- `Задачи`/`Мои проекты`/`Инициативы`/`Очередь`: Vercel grouped list and GitHub alternate views; no mutation on selecting row.
- `Портфолио`/`Достижения`/`Рейтинг`: Vercel neutral data rows and Airtable details with provenance/visibility.
- `Аналитика`: Geist tokens, one main meaningful chart/source, advanced filters via local toolbar and drill-down; never invent zeros.
- `Сообщения`: iCloud Notes/Mail-like list/detail/inspector; preserve attachments and read/delivery states.
- `Кандидаты`/`Приёмка`/`Проверки`/`Споры`: Airtable record detail with critical status and explicit human actions; UI never auto-decides.
- `Настройки`: Apple Settings-style grouping, title/current value/chevron, local deep view.
- `AI Buddy`: small contextual opt-in assistant panel, no unsolicited recommendations over task content or automatic approval.
- Theme switcher: one visible `Светлая / Тёмная / Системная` selector; shared app/theme.ts storage remains source of truth.

## 5. Important methodological boundary

References demonstrate interaction and layout strategies, **not** a license to copy screenshots/assets as application code. Pixel-fidelity means measuring the owner's *supplied Impulse mockups* and maintaining those component alignments, while treating original third-party products as research inputs. Do not claim screenshots from the researched sites are the user's designs.
