# Design

## Context

Архив содержит утверждённое дизайн-направление, 52 engineering tasks и 22 acceptance scenarios. PNG показывают композицию, но используют демонстрационные числа, даты, компании, грейды и прогнозы. Existing `projects-tasks` остаётся источником жизненного цикла задачи/заявки/assignment; новый change расширяет discovery и decision-before-apply flow.

## Decisions

### 1. Один task recommendation projection

Cards, list and detail consume one typed server projection and one query family. A task is identified by stable ID; labels are not join keys. The projection includes catalog facts, eligibility, explainable match, application state, versions and allowed actions. Detail/terms may load on demand but MUST preserve the same snapshot/version semantics.

### 2. Eligibility precedes ranking

Visibility, publication, tenant/program, invitation, deadline, quota and hard prerequisites are evaluated before ranking. Matching score is computed only from allowed versioned inputs and includes algorithm/source version, coverage and reason codes. Missing evidence is not zero and MUST NOT yield false precision.

### 3. Metrics remain distinct

- `match_percent`: relevance to selected role and task requirements;
- `skill_current`: current evidenced/assessed state;
- `skill_projected`: potential state after successful verified work;
- `task_progress`: accepted assignment checkpoints, only after assignment;
- `role_readiness`: roadmap readiness;
- `career_grade/readiness`: canonical grade service.

No UI formatter or client reducer derives one from another.

### 4. Preview stages are a plan

Before assignment, stages are versioned brief elements with neutral planned/locked states and estimated duration. They do not create checkpoints and never appear completed. After assignment, operational progress comes only from existing assignment/checkpoint domain. The helper image `04_stages_preview_reference.png` communicates meaning; its «Итог» block is explicitly excluded.

### 5. Terms are versioned consent

Conditions modal reads published brief/terms and identifies version. Apply sends current `terms_version`, CSRF/session context and idempotency key. A changed version returns a typed `TERMS_CHANGED` conflict and requires review/re-consent. Repeated submission creates at most one application.

### 6. Forecasts never mutate evidence

Skill impact is a read-only projection with calculation status and verification-required marker. Without an approved forecast model the UI shows qualitative impact, not invented numbers. Viewing, bookmarking and applying never changes Skill Passport, grade, XP, certificate or portfolio.

### 7. URL and view parity

URL encodes at least view, sorting, filters and selected task where appropriate. Back/Forward and direct links restore selection or a safe not-found state. Cards/list share server ordering and IDs; switching view is immediate and side-effect free.

### 8. Performance and failure isolation

Catalog shell does not blank on detail changes. Detail is fetched/cached by task ID and version. Hover does not trigger expensive matching recomputation. Catalog, detail and modal expose local loading/empty/error/offline/stale states. Core CJM works with AI flags disabled.

### 9. Security and privacy

Object-level RBAC and safe 404 apply to catalog/detail/terms/share. Private brief, contacts, artifacts and foreign IDs do not enter DOM, logs or analytics. Customer verification, mentor, benefits and portfolio permission are displayed only from authoritative records.

### 10. Rollout

Implement behind feature flag after inventory and product approvals. Use expand/backfill/contract if persistence changes. Rollback disables v2 while preserving applications and accepted terms. No production deploy is part of this change without explicit owner authorization.

## Safe parallel lanes

| Lane | Scope | Depends on |
|---|---|---|
| `task-catalog-inventory` | current route/API/component mapping | SDD accepted |
| `task-recommendation-api` | projection, visibility, terms reads | inventory, product criteria |
| `task-matching` | eligibility, score, explanation, forecast | approved algorithm contract |
| `task-catalog-cards-ui` | cards and shared detail panels | stable generated schema, Sass accepted |
| `task-catalog-list-ui` | list/table and view switch | cards/list shared contract, Sass accepted |
| `task-conditions-apply` | modal and apply command | terms/apply contracts |
| `task-catalog-integration` | route, shared query keys, feature flag | UI lanes ready |
| `task-catalog-quality` | E2E/a11y/visual/performance | integrated UI |

Shared route, query client, locale, global styles and screenshot manifests belong only to integration/quality owner claims.

## Approval gates

- Eligibility-before-matching, permitted factor categories and insufficient-data instead of zero are approved in `docs/product-owner-decisions-2026-10-22.md`; exact weights, coverage threshold and numeric examples remain open.
- Required brief/terms fields, paid/unpaid semantics, IP/confidentiality and portfolio permission are approved in `docs/product-owner-decisions-2026-10-22.md`.
- Task/customer share remains permission-scoped and SHALL NOT disclose private brief/contact data; broader external sharing requires a separate decision.

