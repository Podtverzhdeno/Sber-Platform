# Functional preservation ledger — no features lost in Apple-like migration

**Definition:** every currently implemented action has a **single discoverable new home**. Visibility may change from default to L1/L2, but route, input contract, permissions, error feedback, state mutation and audit must not. The actual presence of a control in a demo preview is NOT proof of server-backed behavior.

| ID | Existing operation / context | New discoverable location | Must never change |
|---|---|---|---|
| A01 | Demo login/select persona, logout | Login page; account menu | Auth cookie, CSRF, error and role guard |
| A02 | Role switch among assigned roles | Account dropdown `Сменить роль` | Only assigned roles, stale role data invalidated |
| A03 | Global search tasks/courses/events/people/messages/documents | Toolbar search or Ctrl/Cmd+K | Search scope/RBAC, result kinds and canonical links |
| A04 | Notifications unread/read/open | Toolbar bell and concise notification list | Read receipts and mapping to role-authorized destination |
| A05 | Change appearance, locale, timezone, preferences | Settings > Appearance/Profile | Authenticated settings API, system theme |
| A06 | Consent, HR visibility, public profile | Settings > Privacy + Portfolio > Visibility | Explicit consent, revoke semantics, no leaked cached projection |
| A07 | AI Buddy preferences, history, memory/feedback | Settings > AI; optional contextual Buddy | No unsolicited AI writes, privacy and disabled fallback |
| A08 | Select primary/optional AI trajectory; freeze/reactivate | My Trajectory > Role list > role details | Track attempts/version and active role rules |
| A09 | Impulse L0→L3 advance; see requirements | My Trajectory > Level inspector; Home > Requirements | Server prereqs, separate career grade, no auto-level |
| A10 | Course browse/filter/search/continue | Bootcamp > Course list > course | `?role`/`?track`/`?course` and true completion |
| A11 | Lesson study/practice/submit/certificate | Bootcamp > Course detail > Lessons/Practice | All lesson/unit states and server confirmation |
| A12 | Task search/relevance/sort/skill filters | Tasks > Filters; list view | Same filter semantics and selected task ID |
| A13 | Bookmark/share task, see terms/price/deadline | Task detail > toolbar/info | Saved/bookmark state, source terms, clear price/payment |
| A14 | Apply/withdraw/resume task | Task detail > primary action/confirmed overflow | Terms consent, idempotency, statuses, deadlines |
| A15 | Project open/next checkpoint | My Projects > project row > overview | Deep-link `?project`, exact assignment |
| A16 | Upload artifacts, personal contribution, submit/revise | My Projects > Contribution/Checkpoint | Files and evidence, no automatic acceptance |
| A17 | Project team, replies, reviews, dispute, reward | Project inspector > Team/History/Reward | Reviews, acceptance policy, payment status |
| A18 | Events catalog/source/register/claim evidence | Events > selected event > Details/Participation | External source, signed proof, deadline, revoke |
| A19 | Rating seasons/filter/search/profile, benefits | Rating > list + inspector | Privacy and published season policy |
| A20 | Portfolio cases/documents/certificates/share | Portfolio > grouped tabs | Confirmed provenance, visibility, revoke/supersede |
| A21 | Skill Passport: verified skills and levels | Portfolio > Passport/Inspector | Confirmed case count is not grade |
| A22 | Achievements list/search/filter/add/detail | Achievements > list + detail/More | Reported≠verified, revoke, source |
| A23 | Analytics periods/activity/skills/certifications | Analytics > local tabs + date filter | Period, method, source, exact day detail |
| A24 | Messenger dialog/group create/search | Messages > left list + Compose/More | Membership, permission, selected chat |
| A25 | Messenger send/reply/file/history/download/retry/mute | Messages > chat + inspector | Delivery/read state, attachment safety, no duplicate send |
| A26 | Customer task create step wizard, save draft/preview/publish | Customer > Create task (if authorized/demo) | Required fields, terms, moderation, idempotency |
| A27 | Customer candidates/applications invite & inspect | Customer > Applications/Candidates list | Consent, evidence validity, not "auto-hire" |
| A28 | Customer acceptance, return for revision | Customer > Task > Result inspector | Human approval, rubric, required reason, audit |
| A29 | Customer AI brief suggestions | Customer > Draft > Suggest improvement | Explicit apply/undo; no AI autopublish |
| A30 | Mentor review queue/rubric/evidence/decision | Mentor > Reviews > selected contribution | Ownership, conflict, human publication and version |
| A31 | Mentor projects and participant details | Mentor > Projects/People > inspector | Only assigned objects and evidence |
| A32 | Mentor calendar, performance and AI draft | Mentor > Week/Analytics/Assistant | Do not silently write schedules or AI verdict |
| A33 | Manager initiative/team results and reporting | Manager > Initiatives/Results > inspector | Authorized role, evidence, export only if real |
| A34 | HR candidate search/consent/stage updates | HR > Candidates/Funnel > selected case | Consent, pipeline event and user permission |
| A35 | Operator case queue, checks, disputes and decisions | Operator > Queue/Verification/Disputes > inspector | Required reason, audit, blocked and version state |
| A36 | Operator payments/users/events/trophy oversight | Operator > corresponding source-authorized screens | Demo-only status not confused with live money/admin mutation |
| A37 | Per-page help, keyboard shortcuts, object source | Toolbar Help/Info + contextual inspector | No help control missing due to white minimalism |
| A38 | Legacy URLs, current deep links, browser Back/Forward | URL and same logical active selection | Original `/workspace/:index`, filters and role context |
| A39 | Errors/offline/empty/disabled | Same screen inline, explicit retry if safe | No "SUCCESS" without server ACK; no optimistic verified data |
| A40 | Public/private profiles & share/export | Authorized view, explicit share controls | Consent, no private data in URL/snapshot/clipboard |
| A41 | Selected filters/favorites and read-status | List toolbar and row menus | Persistence exactly as before; no hidden side-effect |
| A42 | Feature flags and classic UI fallbacks | versioned presentation settings/explicit fallback | No breaking API/DB migration; rollback by same role/route |

## Feature parity tests required **per row**

1. Actor role and permissions; label appears only if authorized and applicable feature flag enabled.
2. Same object and action parameter (IDs, role key, terms version, stage).
3. Same valid/invalid state transitions and server-origin result.
4. Same error/disabled reason, pending feedback, retry idempotency and audit record.
5. Same deep links, Back/Forward, browser reload and mobile focus.
6. No regression in keyboard/contrast or denied object access.
7. Cross-role switching does not reuse stale secure data.

## Prioritization and exclusions

**Essential immediate L0:** one main next action, state, strict deadline/terms/financial constraints where relevant, human approval and security blockers. **L1:** filters, context secondary CTA, member details, supporting task lists, editable preferences. **L2:** raw evidence, history, exports, original provider metadata, archived and advanced technical explanations — discoverable via clearly labelled inspector/More.

**AS-IS gaps:** generic visual fallback and fake/demonstration actions are inventoried as UI state only. A separate functional integration task must document real backend capability before treating them as preserved working functions.
