# Impulse Analytics — canonical visual/structural references (2026-10-24)

## Source of truth
Original user-supplied ZIP: \`Impulse_Analytics_3_варианта_макетов(1).zip\`.
It contains **one HTML and one PNG per variant**:
- \`01_Вариант_1.html\`, \`01_Вариант_1.png\` — «Ваш Skill Passport»
- \`02_Вариант_2.html\`, \`02_Вариант_2.png\` — «Маршрут к вашей следующей цели»
- \`03_Вариант_3.html\`, \`03_Вариант_3.png\` — «Результаты, которым можно доверять»

HTML mockups are designed as 1600px-wide desktop composition with sidebar 205px and content ~1395px. This feature retains the existing Impulse shell and implements the mockup **content regions**. The reference bytes remain in the uploaded user ZIP; they are not authored as new screenshots in this repository.

## Three views and URL contract

All belong to participant route \`/workspace/9\`, with selectable view:
- Default or \`?view=passport\` → Variant 1: four KPI cards, matrix/chart + Skill Passport right, three bottom blocks (next action / evidence / trend).
- \`?view=path\` → Variant 2: progress hero with donut, four journey steps, 2-column targeted gaps and matrix, evidence and matched practice.
- \`?view=evidence\` → Variant 3: four KPI cards, radar vs evidence in 2 columns, three bottom blocks (proof trend / project evidence / next growth point).

The old aggregate view is available exclusively behind \`?legacy=1\` to retain regression coverage of document verification, monthly goals and existing product contracts. It is *not* stacked below these new compositions.

## Design constants from original HTML
- Background #04101c, surface #071a2a, edge #133347, accent cyan #03dfeb and teal #2ce3b8, warning #ffab31.
- Reference content padding 20–22px, gap 12–14px, panels rounded 15–16px, KPI 100px high.
- Default view: matrix/passport ratio roughly 1.92:1, bottom ratio 1 : 1.13 : 1.12.
- Path view: targeted gaps and matrix 1 : 1.25, bottom 1.04:1.
- Evidence view: top equal columns, bottom 1 : 1.1 : .8.
- 3 chart modes: radar, histogram, trend; role selector: developer / analyst / QA.
- Mobile composition stacks cards rather than compressing long Russian labels to 1-word columns.

## Authoritative data / no fabricated evidence
- Read-only Agentic profile API per role \`GET /api/v1/me/agentic-coding/profile?role_key=...\`.
- Growth snapshot \`GET /api/v1/me/growth/snapshot\`, Journey \`GET /api/v1/me/analytics/journey\`.
- Source-map role targets are **methodology previews**, not verified current levels.
- Current competency values are shown only if \`data_state=verified\` from matching \`impulse_learning\` profile and scale \`agentic_coding_1_4\`. Otherwise show \`—\` and explanation.
- No official corporate L1 badge, no invented 81% readiness, no invented 3/6 success, no fake evidence events.
- Trend is based on observed events from the snapshot; without them, shows a meaningful state with no fictional line/bars.
- Next practice links to real Tasks route, not a phantom issue or checkout.
- Certification conditions describe published scope and authority; user cannot self-award certification.

## Differences intentionally bounded by real data / integration
1. 81%/3:6 etc from reference PNG are demo: render "—" where source is absent, not copy figures.
2. Real Sber certification issuer remains disconnected; do not present target completion as credential.
3. The canonical HTML has decorative sidebar/topbar; this component uses existing shared Impulse shell to avoid duplicating navigation.
4. Current project evidence and growth trajectories are not identical to corporate Agentic skill traces; do not combine as if equivalent.
5. Period filter applies to history chart. Agentic competency assessment does not artificially change with period without a period-aware API.

## Visual acceptance
- E2E captures three variants on desktop 1600×1080 and mobile 390×844 with deterministic unknown-evidence profile; saves PNG artifacts.
- Unit tests verify view/role/chart switching and L1 no-fabrication.
- To claim literally 1:1, compare actual screenshots to source PNG using same shell, font, viewport and controlled data. Never accept by CI pass alone.
- Main scope in reference: UI structure, hierarchy, gradients, bars/line visualization, cards and text. Source labels are retained where semantically safe.

## Remaining improvement opportunities
- Use authoritative historical competency snapshots for actual multi-month growth (current trajectory history is only event counts).
- Integrate issued Skill Passport documents at dedicated actionable destination, not invented certificate.
- Corporate issuing remains a separate, deliberately disconnected workflow.
