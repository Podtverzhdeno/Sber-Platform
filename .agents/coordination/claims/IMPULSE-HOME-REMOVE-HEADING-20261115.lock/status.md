# Claim IMPULSE-HOME-REMOVE-HEADING-20261115
- task_id: IMPULSE-HOME-REMOVE-HEADING-20261115
- session_id: gpt6-owner-home-remove-heading-20261115
- status: IN_PROGRESS
- started_at: 2026-11-15
- owner_instruction: remove only visible word “Главная” from the live main content, keep nav text and all actions
- scope: frontend/src/features/pixel-reference/ImpulsePixelReference.tsx; frontend/src/features/pixel-reference/ImpulsePixelReference.test.tsx; frontend/src/features/pixel-reference/impulse-pixel-reference.scss; this claim only
- coordination: previous IMPULSE-PIXEL-REFERENCE-20261114 is REVIEW; owner has directly overridden visible heading requirement, no overlapping active write observed
- exclusions: App.tsx; live pixel data; all dashboard content counters; navigation; other agent worktrees; backend
- acceptance: heading visually hidden, accessible workspace label preserved, role and journey visible, focused unit and type/lint gates pass, main fast-forward + Railway auto-deploy exact SHA
