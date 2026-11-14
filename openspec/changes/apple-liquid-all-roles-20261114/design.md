# Quiet Liquid UX — design and implementation map

## Design hierarchy
1. **Navigation and chrome:** preserve hidden-at-rest 18px edge rail and explicit Menu on mobile; translucent topbar and floating sidebar only; main content does not shift.
2. **One next action:** the existing screen's real action remains prominent in blue. No invented recommendation data or fake KPIs.
3. **Readable workspace:** solid white/dark-blue panels, gentle 20px corners and one hairline border. Avoid "glass behind every letter"; glossy gradients only in chrome/optional hero.
4. **Context on demand:** secondary filters/inspector/analytics remain accessible in their current routes and controls; do not hide proof or edit widgets purely to make a screenshot look empty.
5. **Accessible states:** preserve disabled, pending, selected and warning semantics; honor `prefers-reduced-motion`, `prefers-reduced-transparency`, `forced-colors` and keyboard focus.

## Visual tokens
| Design dimension | Light | Dark |
|---|---|---|
| Canvas | #f7f9ff | #0e1525 |
| Primary solid panel | #ffffff | #192235 |
| Secondary surface | #f5f7fc | #222e44 |
| Text | #19243c | #f1f5ff |
| Muted labels | #66728b | #a9b6ce |
| Accent | #0878f9 | #338bff |
| Selected panel | #eaf3ff | #19375f |
| Liquid chrome | rgba(255,255,255,.77) | rgba(24,32,50,.80) |

Tokens are design decisions for the **web product**, not claimed one-to-one transcriptions of an unavailable Apple Figma source. All background and text colors must retain readable contrast for ordinary controls; testing must confirm effective computed properties.

## Component map
| Product surface | Existing React source | New visual policy |
|---|---|---|
| Global workspace and topbar | `App.tsx`, `topbar`, `CalmSidebar` | Full-width ambient canvas; translucent chrome; preserve hover navigation and keyboard focus |
| Participant home | `participant-home-v2`, `calm-home` | Preserve already approved sparse hero; never add welcome banner |
| Trajectory | `trajectory-v2` | Light selected role pills, calm stage path, strong current state and more room in row |
| Bootcamp and learning | `bootcamp/route-v2`, `bc-approved` | Shared surface and CTA tokens; avoid overwriting immersive course internals |
| Practice and task catalog | `task-catalog-v2` | Solid cards, quiet inspector, readable multi-criteria lists and status |
| Projects | `my-projects` | More space and clear selected tile / team / evidence grouping |
| Analytics and activity | `analytics-v3`, `customer-activity-v3` | Opaque chart panels; keep heatmap/donut colors sourced from data |
| Rating / achievements | `rating-v2`, `achievements-v2` | Calm metrics, readable leaderboard, subdued nonessential illustration |
| Portfolio and events | `portfolio-v2`, `participant-events` | Compact event lists, obvious details, verified evidence surfaced |
| AI Buddy / messages | `buddy-chat-v2`, `collaboration` | Softer AI hero and panels; preserve chat composer and message provenance |
| Customer | `customer-premium`, `customer-create-task`, `customer-candidates`, `customer-analytics` | Workflow forms remain complete; reduce decoration around draft/acceptance/candidate lists |
| Mentor | `mentor` | Prioritize next review, project evidence, individual progress and cohort analytics |
| Manager | `manager` | One priority item, comparable team metrics, accessible drilldowns |
| HR | `hr` | Search/filter, results and hiring funnel remain task-oriented and scannable |
| Operator | `operator` | Preserve dense operations, status and disputes; do not hide critical rows |

## Source code
- `liquid-shell.scss`: role-independent canvas/tokens/chrome, fully scoped under `page-shell--apple-overlay`.
- `liquid-sections.scss`: selectors traced to existing React UI classes across role sections, cards, panels, control groups and breakpoints.
- `components/ui.tsx`: imports only; unchanged native buttons, React state, data table, overlays and event handlers.

## Verification
Run TypeScript, lint, Vitest, Vite build, Playwright on every role with desktop light, manager dark and participant mobile. Then independently review visual screenshots and every route; visual polish is not acceptance of business regression risk.
