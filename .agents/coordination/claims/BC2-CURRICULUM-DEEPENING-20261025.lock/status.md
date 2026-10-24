# Claim BC2-CURRICULUM-DEEPENING-20261025
- task_id: BC2-CURRICULUM-DEEPENING-20261025
- session_id: gpt6-20261025-curriculum-deepening
- status: REVIEW
- base_revision: abf50e91eda4460faf2c76fb259e6cbd290d45db
- write_scope:
  - frontend/src/features/bootcamp/learning-content/**
  - .agents/coordination/claims/BC2-CURRICULUM-DEEPENING-20261025.lock/status.md
- goal: expand every one of twelve programs from four to eight substantial lessons; add prerequisite/outcomes and applied capstone with evidence-based rubric; make instructional content navigable in existing Bootcamp UI without pretending completion/XP is official
- verification: no unknown-course leakage; all 12 program ids; 8 lessons per program; strict TS/ESLint/unit and focused browser behavior
- boundaries: do not change API server grading, certification, enrolment or source-provider authored content; do not edit global Bootcamp route or shared catalog

## Handoff
- implementation: main contains 12 eight-lesson editorial programs, 12 capstone blueprints with 100-point rubrics, 24 case-based checks
- verification: Bootcamp Curriculum QA run 40143461277 SUCCESS on exact implementation commit 9c6f9d23872e75c46ce8a5fad4144e0509cf62e8 (lint, TypeScript, focused tests, production build)
- content_constraints: no server-side XP/certificate/grade or enrollment mutations; provider curriculum remains distinct
- still_pending: full application E2E and production smoke on current main; other teams commit independently
