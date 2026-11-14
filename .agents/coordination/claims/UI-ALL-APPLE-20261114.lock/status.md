# Claim UI-ALL-APPLE-20261114

- task_id: UI-ALL-APPLE-20261114
- status: IN_PROGRESS
- source_baseline_sha: 277a163f777af66ff152fab1fa30d0a2909b5b56
- source_guide: PR #162 SDD v3 5e5cfa95db0d8ad19eee93b0fdfae29b2eed997b
- owner_instruction: "вноси" — resume stopped implementation, preserve all functions
- allowed_files:
  - frontend/src/App.tsx
  - frontend/src/app/impulse-next.scss
  - frontend/src/app/theme-controls/**
  - frontend/src/features/calm-navigation/model.ts
  - frontend/src/features/calm-navigation/Sidebar.tsx
  - frontend/src/features/calm-navigation/sidebar.scss
  - frontend/src/features/apple-surface/**
  - frontend/src/main.tsx
  - frontend/src/**/*.test.tsx (navigation/theme test repair)
  - frontend/e2e/sidebar-consistency.spec.ts (new sidebar responsive contract)
  - frontend/e2e/bootcamp-approved.spec.ts (new role nav route test entry)
  - openspec/changes/impulse-apple-app-experience-20261114/**
  - .agents/coordination/claims/UI-ALL-APPLE-20261114.lock/status.md
- excluded:
  - backend src/**, data, migrations, payments, permissions and real user records
  - frontend/src/features/trajectory-v2/** and bootcamp/** (active other agent work)
  - Railway until exact-SHA CI and safety gate
- no_main_merge: independent reviewer required
- app_sections: six roles x 49 existing server routes, plus customer demo override
- verification: TypeScript, lint, Vitest, route/role tests, build and browser acceptance where available
- rollback_sha: 277a163f777af66ff152fab1fa30d0a2909b5b56

## UIKit + Figma reference update · 2026-11-14

- owner_sources: official https://developer.apple.com/documentation/uikit and user-provided Figma link https://www.figma.com/design/51dkjSuhgFyyeGV2cWLxex/iOS-16-UI-Kit-for-Figma--Community-?node-id=1002-6668&p=f
- source_limitations: official UIKit and Apple HIG accessible; Figma exact node inaccessible via current public browser; community iOS16 kit by Joey Banks is third-party (2022/2023), not official Apple kit
- detailed_mapping: openspec/changes/impulse-apple-app-experience-20261114/docs/uikit-ios16-figma-reference-contract.md
- latest_product_edits:
  - frontend/src/app/overlay-navigation.scss: hidden-by-default full-width workspace with two-way soft floating menu, fallback for missing blur, reduced transparency, forced colors, reduced motion
  - frontend/src/features/calm-navigation/Sidebar.tsx: mounted background scrim with reversible fade and close focus
  - frontend/e2e/sidebar-consistency.spec.ts: full-width desktop and mobile overlay, dark/forced-colors/reduced-motion coverage
  - frontend/src/features/calm-navigation/Sidebar.test.tsx: backdrop click and focus restoration, strict lint correction
  - frontend/e2e/bootcamp-approved.spec.ts: click grouped navigation from floating menu at every viewport
- current_head_at_documentation: 385f9bc8151a4733349aad8e831aa7daf9b46232 (following checkpoint commit advances branch)
- exact_sha_quality: latest full frontend CI E2E and browser visual review PENDING. Earlier 2ceee67e failed ESLint because of 4 new test issues; those were fixed in later commits. Existing unrelated backend/dependency and old visual E2E failures remain unresolved.
- railway: NOT DEPLOYED from latest branch. Production still pinned at e96e1773b26f5e64738c77b77863a51c5c82fd4c (previous successful release), rollback separately retained.
- release_policy: NO-GO until exact-SHA frontend build/lint/behavior pass and suitable independent visual evidence; no main merge without independent review.
