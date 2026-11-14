# Impulse Apple-like Experience · Specification index

> **IMPORTANT REFERENCE CORRECTION:** the old `impulse-reference-pack-20261114.zip` was assistant-generated Impulse concept PNGs, not the four real user uploads. The **true owner originals** are separately preserved in personal Library archive `impulse-USER-original-4-images.zip` and described in [owner-true-originals-analysis](docs/owner-true-originals-analysis-20261114.md). User originals take precedence; older mockup coordinates are illustrative only. This fixes the initial provenance misidentification.



> **OWNER REFERENCE OVERRIDE — 2026-11-14 (stop-design gate).** Four screenshots delivered by the owner are now the authoritative visual basis; implementation/deployment is **PAUSED** until SDD visual reference review. The primary A1/A2 pixel layout overrides the more decorative older Calm B screenshots. Original PNGs and manifest are stored as `impulse-reference-pack-20261114.zip` in the owner's personal ChatGPT Library folder `/Impulse-UI-References-2026-11-14` (archive copy also supplied in chat). Railway production is intentionally unchanged.

## User visuals and external app research (read **before coding**)

- [Owner's four original screenshots: sizes, SHA-256 and exact 1440/390px anchor measurements](docs/owner-screenshot-pixel-contract-20261114.md).
- [Official app research: Apple iCloud Notes, Linear 2026, Notion, Vercel Geist, GitHub Projects, Airtable](docs/web-app-interface-research-20261114.md).
- [Pixel-oriented page templates, **all 49 routes mapped**, light/dark semantic bridge](docs/screen-templates-pixel-map-20261114.md).
- Do **not** ship the interrupted `feat/impulse-global-futurist-ui-20261114` draft branch to Railway before the reference-first review.

**Status:** DRAFT · SDD-first, **no application runtime changes**.  
**Owner request:** make the entire Impulse app visually/behaviorally close to the clear, white, systematic organization of Apple apps; **preserve all existing functions**, move secondary controls under discoverable contextual navigation. Document every screen before modifying the implementation.

## Read in this order

1. [Proposal](proposal.md) — goals, boundaries, compatibility.
2. [Design](design.md) — architecture, L0/L1/L2 strategy, staged rollout.
3. [Source role & route inventory](docs/source-route-inventory.md) — backend's six role menus and actual frontend renderers (49 entries).
4. [Navigation grouping](docs/navigation-groups-and-visibility.md) — sidebar grouping without changing original `/workspace/:index` or permissions.
5. [Participant screen designs](docs/participant-screen-contracts.md) — all 13 destinations, user journeys and function preservation.
6. [Customer and Mentor screens](docs/customer-mentor-contracts.md) — 6+8 server destinations plus separately conditional demo customer screens.
7. [Manager, HR, Operator screens](docs/management-hr-operator-contracts.md) — 8+5+9 destinations with genuine vs placeholder states.
8. [Apple-like design system](docs/design-system-and-behavior.md) — colors, typography, spacing, toolbars, list/detail, modal, accessibility.
9. [Functional preservation ledger](docs/action-preservation-ledger.md) — actions A01–A42, new locations, invariants.
10. [Wireframes](docs/screen-layout-wireframes.md) — the actual first-fold composition and grouped secondary views.
11. [Acceptance matrix](docs/acceptance-matrix.md) — all 49 role destinations and tests.
12. [Tasks](tasks.md) — S0 spec and independent review before S1 shell, S2 six homes and S3–S7 all other pages.

## Formal capability specs

- [Apple-like shell and route safety](specs/apple-shell-navigation/spec.md)
- [Screen-level functional design](specs/apple-role-screen-contracts/spec.md)
- [Action/parity preservation](specs/apple-feature-preservation/spec.md)
- [Visual design system](specs/apple-design-system/spec.md)
- [Progressive workflows](specs/apple-progressive-workflows/spec.md)
- [Independent quality gates](specs/apple-ux-quality-gates/spec.md)

## References and prior work

- Apple HIG primary sources are linked in `design.md` and design-system.
- Previous broad layout/navigation draft [PR #160](https://github.com/Podtverzhdeno/Sber-Platform/pull/160) remains isolated (separate claim, separate files).
- Participant home draft [PR #161](https://github.com/Podtverzhdeno/Sber-Platform/pull/161) remains isolated (separate claim, separate files). Its production status must be checked on an exact Railway SHA; this spec-only branch never deployed it.
- Do not confuse desired Apple-like appearance with native macOS pixel-identity on Windows/Yandex Browser. No licensed/proprietary Apple artwork, binaries or fonts are imported.

## Independent review checklist

- [ ] All six authorized role navigation arrays and 49 labels correctly mapped at `main` baseline.
- [ ] Conditional demo customer menu separately represented, no unauthorized additions.
- [ ] Every screen defines L0, L1, L2 and describes its current renderer / existing limitations.
- [ ] All A01–A42 operations preserved or accurately marked as demo/AS-IS gap.
- [ ] Correct permission, CSRF, deep-link, terms, evidence and human approval semantics.
- [ ] Dark/light/mobile/keyboard/contrast/200% zoom and no lost long content.
- [ ] Quality gates, claim scopes, migration waves and rollback documented.
- [ ] No production, code, secrets or DB changed as part of the SDD change.

**The reviewer, not this spec author, accepts S0. Application styling begins only in separately authorized integration scopes.**
