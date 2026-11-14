# Global futurist minimalism — all Impulse workspaces

## Problem and source of truth

All six server-authorized roles and 49 route destinations already have documented L0/L1/L2 UX in `openspec/changes/impulse-apple-app-experience-20261114/`. The current implementation has a Calm participant home but all other sections still inherit the inconsistent navy/glowing gradient shell and dense navigation. Theme infrastructure `frontend/src/app/theme.ts` already supports `light | dark | system`, but there is **no accessible visible global switcher**. The user explicitly requires white and dark design across **all** sections, based on SDD.

## Scope

1. One cohesive, text-first, crisp, readable futuristic-minimalist visual foundation: consistent app shell, tokens and typography, surfaces, separators, form controls, data tables, cards, dialogs, menus, lists, analytics and all business-module containers; white and dark parity.
2. Mount role-aware `CalmSidebar` on *every workspace route* for six roles, using the existing server-authorized navigation array and exact original indexes. Every authorized feature remains reachable through at most 1 expanded group plus destination.
3. Add visible persistent theme control `Светлая / Тёмная / Системная` in shared toolbar for all roles. Existing `impulse-theme` storage key and OS theme subscription remain authoritative. Dark/white does not change permissions, data or activity.
4. Keep current screens as they are functionally — no backend, business logic, data projections, status semantics, payment, consent or workflow rewrites. This wave improves **all screen shells and appearance**; it does not claim 49 screens individually rewritten to pixel-perfect native macOS.
5. Keep login/persona flow legible and preserve `/workspace/0?home=legacy`.

## Constraints and staging

- Build on deployed `277a163f` exact SHA, not stale `main`. Code branch dedicated to global UI.
- No source of Apple proprietary artwork/fonts. Use system font stack and lucide icons already installed.
- Preserve mobile drawer keyboard focus/escape and logged-out demo selection.
- Respect missing API state, high-stakes warnings and confirmation dialogs.
- Exact frontend typecheck/lint/unit and Docker build plus manual browser/contrast checks; pre-existing full E2E failures must remain visible.

## Exclusions

No model, API, PostgreSQL or authorization changes. No false claim of successful browser screenshots or full 49-section functional E2E where tests are unavailable.
