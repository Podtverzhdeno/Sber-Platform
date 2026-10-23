# Published course and curriculum provenance contract

## Purpose

Этот документ закрывает `BC2-003`: определяет, откуда production получает версии и значения course/curriculum, и как отображается отсутствие authoritative данных. Он не превращает текущий static certificate registry или demo seed в опубликованный учебный каталог.

## Source hierarchy

| Fact | Authoritative production source | Required version/provenance | Current implementation status |
|---|---|---|---|
| Course identity/title | Published course catalog record | `course_key`, `course_version`, `published_at`, `source_system` | `CourseRecord` содержит key/title, но не version/published_at |
| Course access | Catalog availability plus server prerequisite evaluator | `course_version`, `access_policy_version`, evaluated `as_of`, structured prerequisite keys | Current catalog has state/note; prerequisite map is code constant |
| Program/modules | Published course version | `course_version`, ordered module IDs/versions | Not present as domain records; prototype modules are fixture-only |
| Workload | Published course version or provider metadata snapshot | value, unit, source, source version and `as_of` | Certificate registry has hours for three demo records; not general catalog authority |
| Learning progress | Enrollment/LMS checkpoint ledger | enrollment/version, completed/total units, last meaningful activity, source state | Current enrollment stores completion status only |
| Next checkpoint | Published program graph joined with participant checkpoint state | program/course version, checkpoint key/version, allowed action | Roadmap exposes next milestone, not a complete course program checkpoint |
| Completion | Enrollment/verification workflow | state version, reported/verified/rejected/revoked timestamps and verifier provenance | Current states cover not-started/reported/verified/rejected; revoked must be added |
| Competency current level | Versioned Skill Passport/framework projection | framework/evidence snapshot/calculation versions and `as_of` | Current detail reads competency report, version metadata not exposed |
| Projected competency level | Published course outcome mapping | course/outcome/calculation versions, required checkpoint/evidence | Current calculation derives strongest level but lacks explicit calculation version |
| Trajectory target level | Published role/trajectory policy | track/roadmap/grade policy versions | Current detail may use certificate target; this is not always trajectory target |
| Grade curriculum requirements | Active published career-grade policy | `grade_policy_version`, `curriculum_version`, effective interval, requirement IDs | Full authority not yet exposed to Bootcamp |
| Course evidence/certificate | Verified evidence/credential record | evidence/credential ID, issuer, version, issued/revoked status | Existing certificate API is reusable only for issued verified credentials |

## Minimum published course version

`PublishedCourseVersion` SHALL contain:

- stable `course_key` and immutable `course_version`;
- `status=published|retired` and effective timestamps;
- localized title, concrete objective and result;
- ordered modules with stable keys and versions;
- workload value/range and unit plus provenance;
- prerequisite expression referencing stable course/checkpoint keys;
- ordered checkpoints, required artifact/evidence and verification method;
- competency outcome mappings keyed by framework/version;
- provider/source metadata and access policy version;
- content hash or equivalent immutable fingerprint.

Draft course data SHALL NOT appear in participant overview. Retired versions remain addressable for historical evidence but are not offered as new enrollment unless policy explicitly permits it.

## Minimum published grade curriculum

`PublishedGradeCurriculum` SHALL contain:

- role/trajectory key, current/target grade keys and `grade_policy_version`;
- immutable `curriculum_version`, effective interval and publication actor/time;
- ordered typed requirements: `course | project | checkpoint | competency | evidence`;
- requirement source key/version, verification rule and weight/contribution where policy uses it;
- prerequisite graph and deterministic completion rule;
- automatic transition eligibility rule referring to the career-grade policy;
- supersession/recovery behavior without rewriting history.

Changing course content does not mutate an existing curriculum version. A new curriculum references a new course version or explicitly retains the old one.

## Snapshot provenance

Every `BootcampOverviewV2` SHALL expose:

- `schema_version`, deterministic `snapshot_version`, `as_of` and `data_origin`;
- selected `track_key` plus track/roadmap version;
- grade policy and curriculum versions or explicit `not_evaluable` reason;
- per-course `course_version`, access-policy version and source freshness;
- participant enrollment/checkpoint/evidence snapshot versions;
- competency framework/evidence/calculation versions when levels are shown.

`snapshot_version` MUST change whenever a displayed authoritative input changes. Presentation copy, card/list layout or local filters do not create a new business snapshot.

## Unknown and stale behavior

| Missing/stale fact | API representation | UI behavior | Forbidden fallback |
|---|---|---|---|
| No course version | typed unavailable/unknown with reason | Course cannot promise start; show source problem/retry | Copy title/modules/workload from prototype |
| No workload | `workload=null`, provenance reason | `Трудоёмкость не опубликована` | `0 ч`, demo `8–12 ч` |
| No modules | `modules=null` or unavailable state, not empty completed list | `Программа пока не опубликована` | demo module list or `0 из 0` progress |
| No enrollment progress | `progress.state=unknown|not_enrolled`; no percent | Hide progress scale; show allowed start action if any | `0%` interpreted as started |
| Unknown denominator | completed units may be present, total/percent null | Show known completed facts without percent | Divide by guessed module count |
| No next checkpoint | typed `none|unknown` with reason | Do not render continue CTA; offer detail/retry | First prototype module |
| No competency current level | `current_level=null`, `current_known=false` | Label `не определён`; omit current contour point | Plot zero |
| No projected mapping | `projected_level=null` with reason | Explain no forecast; do not animate growth | Reuse target as projected |
| No target policy | `target_level=null`, policy not evaluable | No target contour/grade promise | Constant `уверенный` or grade N+1 |
| Stale source beyond policy | last known value plus `stale=true`, `as_of`, reason | Visible stale state and refresh; exclude from actionable relevance if policy requires | Present as current without warning |

An empty list means the authoritative source confirms zero items. `null/unknown` means the source cannot currently establish the fact; these are not interchangeable.

## Progress semantics

- `material_progress` measures published learning units and never confirms a skill.
- `checkpoint_submission` records an attempt and remains unverified until accepted.
- `course_completion=reported` is a participant/provider claim, not grade credit.
- `course_completion=verified` may satisfy only requirements whose exact policy/course versions accept it.
- `revoked` removes current eligibility credit while preserving history and triggering recalculation/recovery policy.
- `progress_percent` is emitted only with numerator, denominator, definition, source version and `as_of`; it uses decimal/integer arithmetic, not a UI estimate.

## Compatibility with current code

- `RoadmapRecord.policy_version` is a real existing version and may be reused as roadmap provenance; it is not automatically a grade curriculum version.
- `COURSE_CERTIFICATE_REGISTRY.program_version/workload_hours/competencies` may support existing demo certificates and deterministic tests. It SHALL NOT be promoted to universal production course authority without a published-registry migration and source designation.
- `CourseDetailProjection.cycle` already carries current/projected/target/evidence semantics; BC2-104 should add explicit keys and versions rather than create a second cycle model.
- `PREREQUISITE_RULES` is currently code-owned. BC2-103/104 must consume a published versioned graph before production claims dynamic curriculum behavior.
- Existing `CompletionStatus` is reusable; adding `revoked` requires a backward-compatible domain/storage/API migration and historical audit.

## Contract checks required downstream

1. Schema/contract tests reject a numeric progress percent without numerator, denominator, definition and source version.
2. Production-mode tests reject `data_origin=demo_seed|test_fixture` and prototype default values.
3. Snapshot tests prove version changes when course/curriculum/enrollment/evidence inputs change and remains stable for presentation-only changes.
4. Tests distinguish empty from unknown for modules, workload, progress, checkpoint and target.
5. Historical detail resolves the exact course/curriculum versions referenced by evidence after a newer version is published.
6. Revocation produces a new projection/audit effect without deleting the prior verified event or grade history.
