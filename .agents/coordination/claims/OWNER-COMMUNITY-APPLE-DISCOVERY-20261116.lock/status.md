# OWNER-COMMUNITY-APPLE-DISCOVERY-20261116

- status: REVIEW
- task_id: OWNER-COMMUNITY-APPLE-DISCOVERY-20261116
- started_at: 2026-11-16T16:39:00+03:00
- baseline_main_sha: fef09f28a468f68e8f51cdeaac42347ea7d1933d
- owner_request: finish one participant section with source-backed Apple UI kit/HIG, preserving functional actions; merge to main and Railway after acceptance
- scope: exactly frontend/src/features/participant-community-hub/CommunityNavigation.tsx, community-navigation.scss, events-apple.scss, CommunityNavigation.test.tsx, new community-apple-discovery E2E, new isolated workflow and docs/design/community-apple-discovery-20261116.md
- excludes: frontend/src/App.tsx, frontend/src/features/collaboration.tsx and messenger/**, participant-events.tsx, participant-events controls and other CSS, global theme, API/backend/database, other dirty agent worktrees
- dependency: earlier IMPULSE-COMMUNITY-REDESIGN-20261115 in REVIEW; its content already exists in main and is the base; this is a new owner-requested UI refinement, no overwrite of its unmerged branch
- evidence_expected: 5 widths x 3 themes, dynamic actor.navigation, no horizontal category scroll, filtering/search/popup/Back, axe, existing event/messaging E2E, full exact-head scoped CI, Railway exact merge SHA
- Apple provenance: official https://developer.apple.com/design/resources, https://developer.apple.com/design/human-interface-guidelines/tab-bars, local Apple UI kit/07-mobile-adaptive; not native assets, not 1:1 parity
