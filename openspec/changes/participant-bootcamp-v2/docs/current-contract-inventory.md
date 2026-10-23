# Current contract inventory for `BootcampOverviewV2`

## Scope and revision

- Task: `BC2-001`.
- Inspected revision: `97f9fc1079b15188e33c11d2e8e82408cfc73431` plus preserved working-tree changes owned by other claims.
- Read surfaces: `src/impulse/bootcamp/{catalog,service,api}.py`, `src/impulse/application/development.py`, `src/impulse/api/v1/development.py`, generated `openapi.json`/`frontend/src/api/schema.ts`, `frontend/src/features/bootcamp/catalog.tsx` and its tests.
- Rule: this inventory records existing truth and gaps; it does not authorize fixture defaults or silently redefine an existing field.

## Existing HTTP surfaces

| Endpoint | Existing authority | Reuse in V2 | Gap / restriction |
|---|---|---|---|
| `GET /api/v1/me/bootcamp/catalog` | `BootcampCatalogService.catalog` | Canonical course identities and current card state axes | Returns a bare array: no schema/snapshot/as-of/data-origin, selected role, counts, freshness or curriculum remainder |
| `GET /api/v1/development/courses` | `DevelopmentService.course_catalog` | Compatibility/read-only source for active-track recommendation and completion/rating eligibility | Duplicates part of catalog projection; SHALL NOT become a second V2 card source |
| `GET /api/v1/me/courses/{course_key}/detail` | `DevelopmentService.course_detail` | Existing detail, program metadata and competency cycle source | Missing explicit course/curriculum/calculation versions, module list, trusted reviews, prerequisite keys, allowed actions and typed freshness |
| `POST /api/v1/me/courses/{course_key}/completion` | `DevelopmentService.report_completion` | Existing reported-completion command | Produces `reported`, not verified; currently no version/prerequisite/idempotency contract in this endpoint |
| `POST /api/v1/me/courses/{course_key}/learning-days` | learning-day domain | Separate streak command, not a primary course CTA | SHALL NOT be interpreted as progress, completion or evidence |
| `GET /api/v1/me/roadmaps` and development overview/growth reads | development/career domains | Active attempts, roadmap policy/milestones and grade/readiness facts | V2 should compose through application services; frontend SHALL NOT join several requests into contradictory truth |
| Bootcamp certificate endpoints | certificate/credential domain | Verified certificate/detail links where issuer and visibility permit | Certificate is not course completion input and SHALL NOT be fabricated when no issued credential exists |

## Existing `CourseCardView` mapping

| Existing field | Authoritative source today | V2 destination | Decision |
|---|---|---|---|
| `key` | `CourseRecord.key` | `courses[].key` | Reuse as canonical stable course key |
| `title` | `CourseRecord.title` | `courses[].title` | Reuse; published course version is still required |
| `track_keys` | `CourseRecord.track_keys` | `courses[].track_keys` | Reuse membership; MUST NOT be treated as relevance |
| `source_url` | `CourseRecord.source_url` | `courses[].source.url` | Reuse only after existing safe-link policy; not a primary CTA |
| `access_state` | availability plus `PREREQUISITE_RULES` and verified enrollments | `courses[].access.state` | Reuse semantic values; move prerequisite rules to a published/versioned source before claiming V2 completeness |
| `access_note` | course record or derived prerequisite note | `courses[].access.explanation` | Reuse as display explanation; structured prerequisite keys remain a gap |
| `completion_state` | enrollment + verified set | `courses[].completion.state` | Reuse `not_started/reported/verified/rejected`; V2 additionally specifies `revoked` |
| `relevant` | active roadmap milestone mapping | `courses[].recommendation.relevant` | Reuse current boolean only with freshness/version; «Актуальные» also needs availability/prerequisite/freshness predicate |
| `relevance_reasons` | milestone/track/access facts | `courses[].recommendation.reasons[]` | Reuse; reasons need structured provenance/version rather than text-only authority |
| `recommendation_reason` | first matched milestone or general fallback | `courses[].recommendation.summary` | Reuse as presentation text, not as a machine decision |
| `must_take.skill` | first open roadmap milestone | `courses[].recommendation.gap.skill` | Reuse when milestone/policy version is present |
| `must_take.current_level` | competency reports | `...gap.current_level` | Reuse; `null` remains unknown, never zero |
| `must_take.target_level` | `SkillPosition.target_level` | `...gap.target_level` | Current implementation defaults to constant `уверенный`; V2 requires published trajectory/policy authority before reuse |
| `must_take.projected_impact` | generated domain copy | `...gap.projected` | Presentation-only today; structured projected level/version/evidence rule is required |
| `must_take.explanation` | generated domain copy | `...gap.explanation` | Reuse as copy only after underlying facts are included |
| `pending_verification_note` | derived from `reported` | `courses[].completion.explanation` | Reuse; must remain non-crediting |
| `verified_evidence` | derived `course:<key>` | `courses[].completion.evidence_ref` | Identifier/provenance only; raw evidence SHALL NOT be exposed from overview |

## Existing course-detail mapping

| Existing field | Current source | V2 use | Missing for target contract |
|---|---|---|---|
| `course_key`, `title`, `source_url`, `availability`, `access_note` | `CourseRecord` | Reuse | Published course version and structured access/prerequisites |
| `enrollment_status`, `verified` | enrollment store | Reuse | `reported/rejected/revoked` explanation and allowed actions |
| `specialization`, `program_version`, `workload_hours`, `program_competencies` | `COURSE_CERTIFICATE_REGISTRY` | Conditional reuse | Static registry is certificate metadata, not automatically a published curriculum/module catalog |
| `objective`, `milestone_title`, `next_step` | roadmap milestone | Reuse | Roadmap/policy version and actionable target/deep link |
| `artifact` | first certificate competency evidence label | Conditional reuse | Required evidence schema/checkpoint and verification state |
| `cycle[].competency` | certificate registry | Reuse only with program version | Stable competency key/framework version absent |
| `cycle[].current_level` | competency report | Reuse | Evidence snapshot/version/as-of absent |
| `cycle[].projected_level` | strongest current/target or endorsed value | Reuse only as expected projection | Calculation version and distinction between expected and endorsed must be explicit |
| `cycle[].target_level` | program competency | Reuse only with policy authority | Trajectory target/policy version absent |
| `cycle[].projected_confirmed`, `evidence` | course anchors/registry | Reuse semantics | Structured evidence reference/status and privacy-safe detail absent |

## Existing frontend and URL state

| Concern | Current implementation | V2 decision |
|---|---|---|
| `relevance` | `all` omitted; `relevant` serialized and restored | Preserve exactly; remains independent «Все / Актуальные» filter |
| `track` | `all` omitted; exact key filters `track_keys` | Preserve; role membership does not imply relevance |
| `view` | `card` omitted; `list` serialized and restored | Preserve; switching is local and uses the same array/order |
| `course` | stable key; current `App.tsx` switches from `BootcampCatalog` to legacy `Bootcamp` route branch | Preserve key, replace route branch with the single V2 drawer state during later wiring task |
| `category`, `q`, `level` | absent | Add only via versioned parser/serializer in BC2-201; reset keeps selected track |
| API typing | local handwritten `CourseCardState` despite generated `CourseCardView` | BC2-106/201 SHALL use generated contract or a checked adapter; no second drifting interface |
| query/cache | `['bootcamp-catalog']` and separate `['streak']` | V2 overview gets one versioned query key; streak remains independent; view/local filters do not refetch |
| actions | card currently exposes trajectory, report completion, learning day and source simultaneously | Target action selector allows one primary CTA; source/provenance and streak move out of competing primary actions |

## `BootcampOverviewV2` field-by-field ownership

| Target field/group | Existing reusable authority | Status for implementation |
|---|---|---|
| `schema_version` | none | New contract constant, not business data |
| `snapshot_version` | none for combined Bootcamp state | New deterministic version/fingerprint required |
| `as_of` | none for catalog | New server timestamp required |
| `data_origin` | platform projection convention exists, catalog omits it | Add and prohibit implicit demo fallback |
| `selected_track_key` | active attempts + requested/selected URL track | Compose with membership/RBAC validation |
| `roles[]` | tracks + participant attempts | Reuse; include active/paused/unselected explicitly |
| `continue_learning` | enrollment/checkpoint/roadmap facts exist separately | New server selector BC2-102; no frontend inference |
| `role_summary.grade/readiness` | career-grade/development overview domain | Reuse only server-authoritative, including not-evaluable/unknown |
| `role_summary.matrix_count` | competency framework report | Compose with framework/version |
| `curriculum.policy_version` | roadmap has policy version; full grade curriculum source not yet present in Bootcamp | BC2-003/103 must identify/add published grade-policy authority |
| `curriculum.requirements[]` | course milestones partially exist | Extend to course and non-course requirements with verification states |
| `courses[]` identity/access/completion/recommendation | current catalog | Reuse fields above; add version/freshness/structured allowed actions |
| `counts` | frontend currently derives total/relevant only | Server or pure selector may derive from the same snapshot; never static `8/24/3/12` |
| `freshness` | none | Add source versions/as-of/stale reason |

## Confirmed gaps and sequencing

1. `BC2-002` owns approved grade/curriculum copy; it must reference automatic server transition at verified readiness 100% without promising promotion for one course.
2. `BC2-003` must name authoritative course/curriculum versions and provenance for workload, modules, checkpoint, progress and unknown values.
3. `BC2-101` may compose existing catalog, development overview, roadmap and competency services; it SHALL NOT duplicate their persistence models.
4. `BC2-104` extends the existing `CourseDetailProjection`; it does not create a competing detail endpoint/model from scratch.
5. `BC2-106` replaces local handwritten frontend contract with generated types only after OpenAPI is updated.
6. Current frontend files are dirty under another UI lane; no BC2 frontend task may overwrite them without a fresh non-conflicting claim/integration handoff.

## Acceptance evidence for BC2-001

- Every existing `CourseCardView` field has a named source and V2 destination.
- Existing course detail/cycle and command endpoints are identified for reuse.
- Existing URL parameters and the `course` route incompatibility are recorded.
- Unknown/provenance/version gaps are explicit; no new field is declared authoritative without a source.
