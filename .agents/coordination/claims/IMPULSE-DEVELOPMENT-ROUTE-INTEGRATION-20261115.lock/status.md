# Owner-directed Development route integration (2026-11-15)
- session_id: gpt6-owner-development-route-20261115
- status: REVIEW
- owner_instruction: "сразу всегда в main пуш"; "Делай теперь полноценный редизайн разделов поочередно"
- scope: frontend/src/App.tsx (one import and one route switch), participant-development-hub/DevelopmentHub.tsx, frontend/e2e/participant-development-hub.spec.ts
- coordination: UI-ALL-APPLE and UI-APPLE-INTEGRATE still mention App; owner-directed limited takeover of route expression, complete remote App file compared with exact baseline; no local dirty workspace touched; other claims untouched
- rollback: ?hub=legacy; ?source=1 and ?legacy=1 unchanged
- evidence: 29/29 Vitest App/TrajectoryV2/Hub; TS typecheck PASS; scoped ESLint PASS; production build PASS; legacy Playwright 1/1; new Playwright 2/2 including 320/390/1440
- outstanding: full integrated backend/CJM E2E, independent pixel review against owner's images, final CI and Railway post-deploy smoke
