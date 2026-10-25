# Impulse Learning Levels — L0 → L1 and Subsequent Cycles

## Why

The platform previously displayed an unavailable **corporate career grade** as the participant's only level. The Bootcamp "Следующий этап" animation was purely client-side and did not persist a change. Trajectory cards displayed zero **independently verified milestones** despite completed study courses, which obscured real progress.

## Independent concepts

- **Impulse learning level:** L0 at enrolment; L1 after completing the published role courses and at least one independently approved practical submission. Owned by the Impulse role-level API, persisted per person and role.
- **Career grade:** a separate corporate-grade award governed by the published, independently approved career policy. Impulse levels never grant a corporate grade.
- **Course completion:** a self-study certificate recorded by the Impulse course-progress subsystem. It proves coursework, not a professional competency.
- **Practice:** an operator-reviewed practical certificate. Self-submission is not approval.
- **Trajectory milestone:** independently verified by its own owner; it is not equivalent to either a completed lesson or an Impulse level.

## Current implementation

A role has an initial server-visible L0. Its first published cycle reads **only the trusted role-specific course catalogue**, verified course completion and independently approved practical certificates. A participant can promote to L1 using an authenticated, CSRF-protected POST *only* when all first-cycle courses are complete and the practical-evidence threshold is met. The database stores each award and prevents concurrent duplicate transitions. GET never awards a level.

On L1, the original certificates become historical evidence; they cannot satisfy the next cycle. Because the next-cycle curriculum is not yet published, the server explicitly returns `curriculum_state=unpublished`. The user sees the saved L1 and a clear next-cycle state, not a forged 0/7 or a recycled course list.

## Acceptance criteria

- [x] L0 is visible separately from the unavailable corporate career grade.
- [x] Server projection reports completed/required courses and approved/required practices per enrolled role.
- [x] L0 → L1 requires independently reviewed practice as well as all assigned first-cycle courses.
- [x] Award is durable, role-scoped and idempotent under parallel requests.
- [x] Bootcamp graduation popup reflects actual saved server progress.
- [x] Home and Trajectory distinguish Impulse level from professional grade.
- [x] Historical certificates are never counted again in an unpublished subsequent cycle.
- [ ] Publish **versioned L1 curriculum per AI role** (new courses, practical tasks, rubric, evidence requirements) to unlock L1 → L2.
- [ ] Link future curriculum milestones and review decisions to a cycle-specific evidence ledger with immutable provenance.
- [ ] Expand roles L2+ with progressively demanding outcomes; never duplicate the initial 7 milestones as new achievements.
- [ ] Add PostgreSQL integration tests for conflicting concurrent POST requests and independent reviewer revocation.
- [ ] Add end-to-end L0 → approved practice → L1 → new cycle browser test against migrated PostgreSQL.

## Non-goals

Neither clicking the animation nor accumulating XP/learning streaks can increase a level. Corporate career grades are not renamed to Impulse levels in the backend; they remain separate projections.
