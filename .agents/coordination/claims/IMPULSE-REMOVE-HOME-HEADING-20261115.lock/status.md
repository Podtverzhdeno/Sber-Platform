# Owner follow-up: remove visible "Главная" from live participant home

- task_id: IMPULSE-REMOVE-HOME-HEADING-20261115
- session_id: gpt6-owner-home-heading-20261115
- status: IN_PROGRESS
- started_at: 2026-11-15T22:37:00+03:00
- heartbeat_at: 2026-11-15T22:37:00+03:00
- user_instruction: "Главная - убери это слово в главном разделе" (attached screenshot), immediate main and Railway
- source_validation: App.tsx participant home /workspace/0 mounts OwnerPixelHome → PixelParticipantShell → ImpulsePixelReference; visible header originates in ImpulsePixelReference.tsx line 195
- write_scope:
  - frontend/src/features/pixel-reference/ImpulsePixelReference.tsx (single visible heading replacement)
  - frontend/src/features/pixel-reference/ImpulsePixelReference.test.tsx (focused regression)
  - frontend/e2e/approved-home-1672.spec.ts (update first-fold visual acceptance for intentional title removal)
  - .agents/coordination/claims/IMPULSE-REMOVE-HOME-HEADING-20261115.lock/status.md
- excluded: App.tsx; sidebars; route names; backend; other role dashboards; Railway settings; owner-pixel main integration
- coordination: explicit direct owner follow-up narrowly amends pixel-reference component while OWNER-LIVE-PIXEL-APPLE-SHELL claim is IN_PROGRESS; no other shared file modifications
- acceptance: visible text "Главная" absent on active participant home, accessible h1 retained for aria-labelledby and screen readers, existing navigation unchanged, focused Vitest and lint/typecheck, deployed exact main SHA
- progress: owner-pixel visible title was removed in a1201ed6 and validated 9/9 unit and 8/8 browser E2E; owner follow-up requests removing role label directly below the old title on live home, retaining the page's accessible hidden h1, role data in relevant work surfaces, and journey link; CSS and visual E2E pending on this revision.
- blockers: visual screenshot diff requires browser verification

- owner-collaboration: main 80c87e6 updated the accessible hidden h1 to «Обзор участника», retaining no visible role title. Synchronized owner E2E and focused test expectations with that source.
