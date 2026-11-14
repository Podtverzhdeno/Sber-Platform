# Impulse Apple-like Experience · Specification index

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
