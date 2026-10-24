# TRJ: source-first atomic DOM/CSS extraction → React adapter

## Exact artifact provenance
- User ZIP: `Impulse_Trajectory_Interactive_Code_and_Tasks(2).zip`
- SHA-256: `ba49623e43cc8e255bd2b06bd794207f7e4d259869de554b29273eb0931bd825`
- Source: `index.html` (shell and SVG sprite), `styles.css` (316 parsed rules), `app.js` (30 named top-level render/event functions), `tasks.md`, and two **different** image families
- Important: `references/*.png` are the author's approved visual renders; `screenshots/*.png` are captures of the runnable prototype. They are not interchangeable and the prototype README admits minor visual differences from the reference
- The exact byte-for-byte extraction of all JS functions, source CSS groups, SVG and image assets is in the chat deliverable `Impulse_Trajectory_Atomic_Blueprint.zip`, including a machine-readable `manifest.json`

## Source DOM hierarchy (do not reorder)

```text
workspace shell (already exists in Sber-Platform; do not duplicate)
└─ trajectory main
   ├─ heading-row [title, subtitle, CSS hero mountain/flag art]
   ├─ roles-grid [7 role-card slots at wide reference viewport; primary/active/paused/unselected]
   └─ content-columns [left 2.27fr, right .94fr]
      ├─ left-stack
      │  ├─ role-detail [icon, title, main badge, role text, actions]
      │  │  ├─ path-label [name + completed stage count]
      │  │  └─ roadmap-steps [sequence of milestone-circle + index + name]
      │  └─ stage-card [stage header, stage-scoped progress, task-row list, one primary CTA]
      └─ right-stack
         ├─ grade-card [single grade ring, remaining percent, status and policy hint]
         ├─ next-card [server next outcome, authorized action]
         └─ skills-card [source-backed skills, no self-awarded competencies]
```

## Atomic function mapping

| Original source | React atom | Required source |
|---|---|---|
| `renderRoleCard`, `roleIcon` | `SourceRoleCard`, `SourceIcon` | overview role list + separately approved role catalog |
| `renderTimeline` | `RoleRoadmap` | roadmaps with ordered milestones and next step |
| `renderStage`, `renderTaskRow` | `StageCard`, `TaskRow` | roadmap goal; independent stage task read model once published |
| `renderGradeCard` | `GradeCard` | `overview.concepts.career_grade` only |
| `renderNextCard` | `NextOutcomeCard` | `overview.next_outcome` |
| `renderSkills` | `SkillPassportCard` | `/api/v1/me/talent-passport` |
| `roleDialog`, `roleTabText` | existing RoleInfoDialog | vetted role catalog + roadmap |
| `detailDrawer` | existing StageTaskDrawer | evidence and review details, not demo XP |
| `renderPopover` | existing TrajectoryActions | privacy-safe actions |
| `gradesDialog` | existing grade modal | published policy; unknown catalog stays unavailable |

## Screenshot contract

| State | File | Target viewport |
|---|---|---|
| TRJ-SCREEN-01 | `screenshots/01-main.png` | 1672×1038 |
| TRJ-SCREEN-02 | `screenshots/02-view-task.png` | 1672×941 |
| TRJ-SCREEN-03 | `screenshots/03-role-info.png` | 1672×941 |
| TRJ-SCREEN-04 | `screenshots/04-more-menu.png` | 1672×941 |
| TRJ-SCREEN-05 | `screenshots/05-all-grades.png` | 1672×941 |
| TRJ-SCREEN-06 | `screenshots/06-mobile.png` | 390×2601 full-page |

## Rules governing the port

1. React source atom `frontend/src/features/trajectory-v2/source-reference/source-layout.tsx` adopts the **same nested DOM classes** as the actual prototype. Scoped `source-reference.scss` ports matching source rules rather than stacking global overrides
2. Existing authorization, queries, shell/header, navigation and dialogs remain their canonical owners. Integration must pass props/callbacks from `TrajectoryV2Body`, never create another query with simulated data
3. The Zip's role descriptions, task histories, mentor reviews, XP, grades 1–6 and percentages are demonstrative, not real user facts. The UI cannot generate them or assign user rights. When grade policy or task trace is absent, show truthful partial states
4. The selected stage must derive from an authorized roadmap; user interactions change selection, not verification outcomes
5. The page screenshot supplied by the user shows only four roles, 0/1 milestones and a single task. The source reference shows seven roles, a seven-node path and a three-row task card. The missing stage-task projection is a **data contract gap**, not a CSS problem
6. Source CSS uses a 7-column role grid, separate stacked role/stage panels, a 2.27fr/.94fr content grid, 43px milestone circles and a two-column role selector at <=660px
7. Pixel-level certification requires the **integrated React page** at identical font, DPR, viewport and deterministic user dataset; this draft source component is not enough for 1:1 sign-off

## Integration dependency

The adapter is built in an exclusive new directory to avoid interfering with concurrent `page.tsx` and `trajectory-v2.scss` claims. After independent review, an integration owner may replace the existing `TrajectoryV2Body` page body with the adapter, keep canonical overlay integrations, and run all six exact viewport Playwright captures. No production merge without passing CI and full visual acceptance.
