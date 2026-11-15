# Owner-directed Practice redesign (2026-11-15)

- task_id: IMPULSE-PRACTICE-REDESIGN-20261115
- session_id: gpt6-impulse-practice-20261115
- status: IN_PROGRESS
- source_baseline: c18b53bd93fb07d38064c596e65c8c65de3a1385
- scope: frontend/src/features/participant-practice-hub/**, owner-approved narrow integration expression in frontend/src/App.tsx, isolated browser E2E
- excluded: task-catalog-v2/page.tsx, my-projects/page.tsx, backend/**, existing dirty worktrees, role navigation array, Railway
- dependencies: participant five-section SDD and reviewed current source
- verification: Vitest, typed routes, ESLint, build, Playwright on exact local revision and CI after main push
- planned behavior: Find task / In progress / Projects, keep original numeric paths, terms, application, submission and review in source-owned modules
- never claim production deployment without evidence
