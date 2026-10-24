# Task catalog: independent approved-image visual audit (24 Oct 2026)

## Source and limits

The uploaded approved ZIP `Impulse_Tasks_Design_and_Detailed_Spec(1).zip` has SHA-256 `fb3862388d672b98dc3b259ddeefcaefdea509452190bded89183e9a81f324ab`. It contains `design/01_tasks_cards_approved.png`, `02_conditions_modal_approved.png`, `03_tasks_list_approved.png`, `04_stages_preview_reference.png`, a 52-task engineering SDD, and an acceptance matrix.

Review comparison is to Linux Playwright screenshots saved from workflow **40112375148** (rendered around commit `c9d3de62`), not to a screenshot created from this audit branch. Source reference raster is **1672×941**; implementation screenshots were captured at **1440×900**. Sizes differ and shell navigation is shared: an unscaled full-image pixel diff is not meaningful. Compare structural density, hierarchy, colors, proportions and responsive states. DO NOT claim mathematically verified 1:1 without a same-viewport/source-data pairing.

## Concrete findings / required changes

| Priority | Approved PNG | Observed implementation | Acceptance action |
|---|---|---|---|
| P1 | `03` ten compact rows; reference first desktop row spans ~60 px (347–407) | Real 2-task mock renders first row approx 150 px tall and second ~115 px, many wrapped labels | Test with 10 synthetic entries; aim at 60–85px average desktop height, hard ceiling 90px. Keep title/company/benefit/explanation legible, not clipped or overflowing |
| P1 | `01` five horizontal planned stages fully visible in bottom detail pane | Existing fixture has just one stage and proves no five-stage layout geometry | Test with exactly five neutral planned/locked stages and 4 potential benefits, no fake completion, never add “Итог” |
| P1 | `02` modal focused in center, approximately 657/1672 = 39% of screenshot width and height approx 716 px | Current implementation sample modal ~780/1440 = 54% viewport width and nearly 860px tall | Reduce padding and section heights where possible, keep version/consent, avoid showing demo data as authentic. Respect legible 14px body and scroll accessibility over pixel imitation |
| P1 | `02` four top facts, two-column content and dual footer actions | Current has four facts and two columns; legal safety text and consent correctly present | Preserve idempotent submit, keyboard Escape/focus trap, consent checkbox, version-drift handling while tightening visual layout |
| P2 | `01` selection glows subtly around dense, logo-led cards | Cards are text-heavy, less compact and share same generic icon | Keep generic icon unless authoritative logo/media exists; reduce typographic wrapping through width/spacing, not fake real brands |
| P2 | `01` ring and benefit rail across distinct columns, skills dominate | Current detail uses a ring, but skill table and benefit panel have limited illustrated content | Verify with test-only 2+ skills and 4 benefits; preserve qualitative forecast when production does not supply numeric calculation |
| P2 | `03` match ring and rationale are visually scannable | Plain text and tall rows are difficult to scan when task names wrap | Keep ring and separate benefit/rationale column without changing matching semantics |
| P2 | `01` four KPI cards in one horizontal row | Implementation has four dynamic KPI widgets with honest denominators | Preserve server-derived numbers and responsive collapse; no fictional `12 / 76% / 8 / 10` |
| P3 | All references include full sidebar and company-specific logos | Existing shell/sidebar intentionally differs; some source sample data are unavailable to production | Treat shell ownership as separate shared task. Do not copy screenshot company logos or display unverifiable mentor credentials |

## Independent automated acceptance proposal

This QA lane adds `frontend/e2e/task-catalog-approved-visual-fixture.ts` and `frontend/e2e/task-catalog-approved-geometry.spec.ts`. The fixture is browser-only, contains ten explicitly synthetic task/customer records and does not change app seed, production API or underlying source of truth.

The geometry spec asserts: desktop four KPIs in one row; detail right of discovery; five preview stages; four conditional benefits; ten list rows with 8+ headers and no overflow; no individual row over 110px at source viewport size; modal four fact tiles, six disclosure sections, consent-gated action and center containment. It is intended as an explicit **pending-fidelity quality gate**, not a substitute for direct visual inspection of the approved PNG.

## Release and coordination

The UI implementation branch `codex/task-catalog-visual-polish-20261024` currently has an active `IN_PROGRESS` claim covering React/SCSS/tests. This independent QA lane MUST NOT modify those files; author or assigned integrator reconciles the findings. Do not rewrite screenshot baselines to suppress visual failures. No main merge, no feature-flag activation and no Railway deployment are authorized by this audit.

## Measured fidelity CI — exact synthetic task volume

One-off GitHub Actions run `40114313661` ran all three new Playwright checks on 1672×941. Cards/detail **PASS** with four KPIs, five planned stages, four conditional benefits and no horizontal overflow; modal **PASS** with four facts, six disclosure sections, two actions and disabled submit before consent. Dense list **FAIL**: all ten measured rows were `111, 111, 111, 111, 111, 111, 111, 111, 111, 110` pixels. Approved PNG #03 is approximately 60px/row at its source canvas. New 90px max per row offers reasonable tolerance for real text but still requires author to compress roughly 20% relative to the current browser rendering (source exact density is more demanding). Do not remove this assertion merely to restore CI.
