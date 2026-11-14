# Home 3 — quality gate and executable acceptance matrix

**Status:** Design acceptance plan, NOT a passed test report. Current CI/production status must be inspected separately per exact commit. These tests apply to participant's main page only and cannot be used to declare other roles/sections finished.

## Stage gates

| Gate | Deliverable | Pass condition | Who can close |
|---|---|---|---|
| H0 — Reference review | HIG research, critique, documented information hierarchy and design tokens | Every design choice tied to a user job or Apple HIG pattern; no copied branded assets | Independent design reviewer |
| H1 — First fold | New home component displays one dominant action, role and compact progress | Functional component tests + screenshots at 1440 and 390; no business mutations | Independent reviewer + user visual feedback |
| H2 — Secondary flow | Task/week details, level/requirements, shortcuts as one-click grouped detail | Real destinations and role/context exact; critical states covered | Independent functionality reviewer |
| H3 — Accessibility | Keyboard, semantics, reduced motion, contrast, enlarged text, error recovery | Accessibility and responsive gates pass | Independent reviewer |
| H4 — Full review | Browser screenshots + integration tests + regression matrix on one exact SHA | No new home P0/P1, no broken legacy path; compare with reference | Integration reviewer |
| H5 — Owner-approved deployment | Pin reviewed source SHA in `determined-spirit / production` | Railway SUCCESS, startup, live authenticated browser smoke, rollback prepared | Authorized deployment lane with owner approval |

Never mark H4 or H5 green from isolated Vitest, a successful container build alone or a static HTML mock.

## A. Visual and interaction acceptance

| ID | Preconditions | Action / inspection | Required result |
|---|---|---|---|
| H-V01 | 1440×900, light appearance, participant | Open `/workspace/0` | One clearly dominant primary CTA; first fold shows "Главная", current track, one next step and short progress |
| H-V02 | same | Inspect content | No decorative hero art, logo, orbital diagram, three large equal metrics cards, all-caps marketing eyebrow, whole-page card border or gradients |
| H-V03 | same | Compare with first-party Apple reference principles | Text alignment, grouped rows, content separation and typography feel closer to Reminders/Settings than SaaS dashboard; human review required |
| H-V04 | 1024×768 | Open home | Primary CTA visible without horizontal scroll, groups reflow cleanly |
| H-V05 | 768px narrow tablet | Open home | Controls remain usable, sidebar does not overlap content; no clipped task name |
| H-V06 | 390px and 320px compact | Open home | Primary CTA full-width/usable, content stacks; no horizontal scrolling or offscreen actions |
| H-V07 | light and dark theme | Inspect controls | Legible color/contrast; semantics preserved. No forced light overriding dark accessibility preference |
| H-V08 | 200% text zoom | View home and disclosures | No clipped text or overlapping CTA; readable navigation; scrolling vertically is acceptable |
| H-V09 | reduce-motion preference | Expand/collapse and navigate | No gratuitous animation, function unchanged |
| H-V10 | keyboard-only | Tab/Shift+Tab/Enter/Space | Primary CTA and all disclosure rows reachable, focus visible, logical order |
| H-V11 | level detail sheet open | Press Escape / close | Details close; focus returns to opener; background not interactive while modal |
| H-V12 | screen reader | Read heading, action, progress, task status, disclosure | Semantic names and state announced; no color-only status |
| H-V13 | pointer + touch | Hover/click | Touch targets >=44px; hidden commands are discoverable without hover |
| H-V14 | screenshot session | Inspect all states | No extraneous emojis, mismatched illustration assets or Apple brand/logo/font material copied into app |

## B. Functional and data-provenance acceptance

| ID | Scenario | Acceptance |
|---|---|---|
| H-D01 | Actionable assigned task `start` | Shows source task; CTA routes to exact task ID and does **not** start/submit it automatically |
| H-D02 | Assigned task `send_work` | CTA leads to task detail; status explicitly says submission is needed |
| H-D03 | Assigned task `revise` | CTA leads to revision detail with no false success |
| H-D04 | Assigned task `await_review` | No submit CTA for that task; appears in work details with "Ожидает проверки" |
| H-D05 | Assigned task `dispute_pending` | Do not treat as a normal actionable submit; show read-only dispute status |
| H-D06 | No actionable task, next course | CTA routes to Bootcamp, original authorized `trajectory_key` preserved in query |
| H-D07 | No task/course/role | Offers trajectory or role selection, not invented task/course |
| H-D08 | Two active roles | Visible role context matches role level and deep-link track, never cross-mixes metrics |
| H-D09 | API role level 404/500 | UI shows "—" / "Данные недоступны"; no fake L0 |
| H-D10 | Role level `curriculum_state=unpublished` | No bogus "0/0" percent or executable course button |
| H-D11 | Published required courses | Shows canonical names/progress after disclosure; no fetch before disclosure unless reused cache |
| H-D12 | Course data slow/fails | Stable loading/error state with retry or destination, no fabricated "Курс · opaque_key" as a usable course name |
| H-D13 | `advance_ready=true` | Can discover readiness, but actual advancement only via explicit authorized workflow in trajectory |
| H-D14 | Passport contains unconfirmed skills | Counts ONLY evidence-backed confirmed skills, not every record |
| H-D15 | Passport API fails | "—" not "0"; portfolio still accessible |
| H-D16 | Weekly focus date changes on refetch | Selected date falls back to actual server date; no stale selection, no mutation |
| H-D17 | Weekly day selected | Shows factual status, does not mark done by clicking |
| H-D18 | No permission for AI Buddy | No shortcut or misleading "AI Buddy" mention in controls |
| H-D19 | Portfolio has Skill Passport tab | Shortcut opens the actual tab (not unrelated fallback) |
| H-D20 | Overview returns 500 / network outage | Existing readable error/retry; no phantom progress, no extraneous API POSTs |
| H-D21 | User logs out or role switches | Proper guard; participant-only data not leaked across persona |
| H-D22 | Unknown destination / missing enrollment | Fail closed or route to legitimate visible fallback, not silent generic navigation |

## C. Regression and rollout acceptance

| ID | Test | Acceptance |
|---|---|---|
| H-R01 | `/workspace/0` | New Calm home is default for participant only |
| H-R02 | `/workspace/0?home=legacy` | Old detailed `ParticipantHomeV2Body` still renders |
| H-R03 | `/workspace/0?v2=0` | Original older home fallback still renders |
| H-R04 | User other than participant | Other role home unchanged |
| H-R05 | Existing `App.tsx` navbar, Bootcamp, Tasks, Portfolio routes | No unintended sidebar/theme changes; navigation works |
| H-R06 | Frontend CI same exact SHA | Strict TypeScript, ESLint, units, new E2E, production Vite build PASS |
| H-R07 | Legacy geometry tests | Run on their authorized legacy route; do not delete baseline assertions to silence failures |
| H-R08 | Backend, security, secret scans | Track failures separately; do not misrepresent known unrelated issues as fixed |
| H-R09 | Independent diff/review | Review of code + spec + outcomes by another lane, before DONE/merge |
| H-R10 | Production deploy | User-approved exact SHA to target service, health+authenticated browser check; a build alone is not complete |

## D. Test implementation mapping

- `frontend/src/features/participant-home-v2/calm-home/CalmParticipantHome.test.tsx`: task/track mapping, no fabrication, skill evidence, disclosures, level requirements.
- `frontend/e2e/calm-home-preview.spec.ts`: primary action, keyboard/mobile, detail navigation, legacy rollback. Extend only in isolated owned file.
- Legacy `frontend/e2e/home-reference-geometry.spec.ts` and `frontend/e2e/home-grade-courses.spec.ts`: still expect old UI — their owner must scope them explicitly to `?home=legacy`. Until reconciled, they remain independent open E2E blockers. **Do not silently change those claimed shared files.**
- For real browser review, capture screenshots with deterministic demo fixture AND authenticated deployed demo user. They serve different purposes; do not claim deterministic fixture screenshot proves actual Railway UX.

## E. Explicit go/no-go

- **GO** only if first fold receives user design acceptance, the exact revision passes frontend quality and targeted browser tests, legacy path still works, and the independent reviewer signs off.
- **NO-GO** if tasks/courses deep-link to wrong role, unverified evidence is presented as confirmed, level appears as a made-up number, a 320px screen clips CTA, or browser screenshot was never inspected but claimed done.
- Keep `determined-spirit` pinned to its currently confirmed SUCCESS revision until the later deployment gate. A new branch commit is not itself a release.
- A rollback must remain available without database action: `?home=legacy` within the same revision; external Railway rollbacks require explicit release owner action.
