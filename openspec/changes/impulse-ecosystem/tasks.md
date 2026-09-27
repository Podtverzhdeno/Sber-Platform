# Tasks

## 1. Репозиторий и воспроизводимый toolchain

- [x] 1.1 Обновить `pyproject.toml` под package `impulse`, Python `>=3.13,<3.15`, runtime/dev dependencies и scripts; проверить `uv lock` и `uv sync --frozen` в чистом окружении.
- [x] 1.2 Создать модульную структуру `src/impulse`, app factory и минимальный FastAPI с `/health/live`; проверить импорт пакета, `pytest` smoke и HTTP 200.
- [x] 1.3 Создать React/TypeScript/Vite frontend со strict TypeScript и test setup; проверить `npm ci`, `npm run typecheck`, `npm test` и production build.
- [x] 1.4 Добавить `.gitignore`, `.dockerignore`, `.env.example` без значений, editor/config files и скан секретов; проверить, что `.env`, ключи, build output и IDE state не попадают в `git status`.
- [x] 1.5 Добавить Ruff, Pyright, ESLint и единые команды quality; проверить локальный запуск всех linters на scaffold.
- [x] 1.6 Создать README с локальным запуском, demo boundary, OpenSpec workflow и secret setup без ключа; выполнить документированные команды на чистом checkout.

## 2. Конфигурация, ошибки и API foundation

- [x] 2.1 Реализовать Pydantic Settings с development/test/production validation и feature flags; unit tests SHALL покрыть missing secrets, demo hard fail и безопасную сериализацию конфигурации.
- [x] 2.2 Реализовать request/correlation ID middleware, единый error envelope и structured redacted logs; API tests SHALL подтвердить отсутствие stack trace и секретов.
- [x] 2.3 Настроить `/api/v1`, cursor pagination, ISO UTC и Decimal/currency schemas; contract tests SHALL проверить round-trip и запрет binary float.
- [x] 2.4 Реализовать `Idempotency-Key` storage/guard для опасных команд; concurrent API test SHALL вернуть один результат для повторной команды.
- [x] 2.5 Добавить OpenAPI generation/snapshot и frontend API type generation; CI check SHALL падать при несинхронизированном контракте.

## 3. PostgreSQL, миграции, аудит и demo seed

- [x] 3.1 Настроить async SQLAlchemy, session/transaction boundary и Alembic; проверить upgrade пустой PostgreSQL до head и повторный запуск без изменений.
- [x] 3.2 Создать identity/development/work/reward/recognition/ecosystem/assist/insight tables с версиями, provenance и constraints; migration tests SHALL проверить уникальные бизнес-ключи.
- [x] 3.3 Реализовать optimistic concurrency, append-only audit и domain events в одной транзакции; tests SHALL покрыть stale version и rollback без orphan event.
- [x] 3.4 Создать идемпотентный versioned demo seed со связанными personas, курсами, событиями, задачами, рейтингом и кейсами; два запуска SHALL давать одинаковые business IDs/counts.
- [x] 3.5 Добавить `data_origin=demo_seed` во все публичные demo projections и административную reset-команду только для demo; API test SHALL запрещать reset в non-demo.
- [x] 3.6 Документировать ER/domain map и seed personas; сверить таблицы документа с Alembic metadata автоматическим check.

## 4. Demo authentication, роли, согласия и RBAC

- [x] 4.1 Реализовать DemoAuthProvider, подписанную HttpOnly session cookie, CSRF и logout; auth tests SHALL проверить expiry, tampering и cookie flags.
- [x] 4.2 Реализовать `GET /me`, назначенные роли и demo role switch без расширения scopes; scenario `identity-access/Несколько рабочих ролей` SHALL пройти API test.
- [x] 4.3 Реализовать ActorContext и object-level policies во всех repository/application entry points; matrix tests SHALL покрыть шесть ролей и чужие объекты.
- [x] 4.4 Реализовать единый non-disclosing 404 для unknown/forbidden IDs; negative tests SHALL подтвердить одинаковый body/status до доступа к данным.
- [x] 4.5 Реализовать отдельные consent/visibility scopes и отзыв с обновлением public/HR projection; scenarios `identity-access/Согласие на публичность` SHALL пройти.
- [x] 4.6 Создать login/persona UI и demo badge; Playwright SHALL войти каждой persona и показать только разрешённую навигацию.

## 5. Frontend shell и доступная design system

- [x] 5.1 Реализовать responsive app shell, role-aware sidebar/topbar, routing и page guards; component/e2e tests SHALL покрыть desktop/mobile navigation.
- [x] 5.2 Создать design tokens и компоненты badge, card, table, drawer, modal, tooltip, timeline, funnel и state panel; accessibility tests SHALL проверить keyboard/focus/ARIA.
- [x] 5.3 Реализовать единые loading/empty/restricted/stale/error/offline states с actionable CTA; Story/test fixtures SHALL покрыть каждое состояние.
- [x] 5.4 Настроить TanStack Query, typed API client и error mapping; test SHALL подтвердить retry только для безопасных retryable reads.
- [x] 5.5 Добавить CSP-compatible asset build, external-link safety и reduced-motion; automated accessibility/security check SHALL пройти без critical issues.
- [x] 5.6 Применить утверждённую navy/teal visual system к role-aware shell, dashboard и общим компонентам; Playwright screenshot regression SHALL покрыть 1440×900, 1024×768 и 390×844.

## 6. Направления, roadmap и Bootcamp

- [x] 6.1 Реализовать track/attempt policies: максимум два active, freeze/reactivate, история без штрафа; domain tests SHALL покрыть все scenarios `career-roadmap`.
- [x] 6.2 Реализовать roadmap versions/milestones и объяснимый next step; API tests SHALL сохранить completed milestones при пересчёте версии.
- [x] 6.3 Реализовать participant dashboard, tracks и roadmap UI, включая выбор замораживаемого track при третьей роли; Playwright SHALL пройти switch journey без mentor approval.
- [x] 6.4 Реализовать course catalog, track links, availability и `reported/verified/rejected` completion; tests SHALL запретить баллы за reported.
- [x] 6.5 Реализовать learning-day qualification и streak по timezone с максимум одним днём; property/boundary tests SHALL покрыть полночь и дубликаты.
- [x] 6.6 Реализовать Bootcamp UI с filters, reason, progress, verification и feature-flagged honor board; frontend tests SHALL скрыть пользователя без consent.

## 7. Каталог событий и внешние доказательства

- [x] 7.1 Реализовать events/programs catalog API с источником, deadline, status и track relevance; contract tests SHALL покрыть filters/cursor/freshness.
- [x] 7.2 Реализовать participation claims `reported→awaiting_verification→verified|rejected|revoked`; state tests SHALL не создавать trophy до verified.
- [x] 7.3 Реализовать provider/external ID uniqueness и idempotent import/manual source adapter; duplicate tests SHALL исключить match только по ФИО.
- [x] 7.4 Реализовать participant events UI с source links, reason и claim status; accessibility test SHALL обеспечить не-hover доступ к источнику.
- [x] 7.5 Реализовать invalidation затронутых trophy/score/credential records при отзыве источника; integration test SHALL создать correction, не rewrite.

## 8. R&D/MVP-задачи, заявки и вклад

- [x] 8.1 Реализовать task aggregate и publication validator для problem/deliverable/criteria/deadline/data/IP/support; `projects-tasks/Неполный бриф` SHALL пройти.
- [x] 8.2 Реализовать customer draft/submit/moderation/publish и optional mentor nomination; task без support SHALL остаться unpublished согласно operations spec.
- [x] 8.3 Реализовать immutable terms versions и participant task catalog/detail с accepted terms consent; changed-version API test SHALL вернуть `TERMS_CHANGED`.
- [x] 8.4 Реализовать applications, staffing и assignment transitions с places/concurrency; tests SHALL исключить двойное назначение и stale acceptance.
- [x] 8.5 Реализовать checkpoints, team artifacts и personal contribution evidence; scenario `projects-tasks/Индивидуальный вклад` SHALL требовать личное описание.
- [x] 8.6 Реализовать business acceptance, revision request и dispute с reason/deadline/owner; conflicting authorship SHALL приостановить review/payout.
- [x] 8.7 Реализовать participant task/my-work UI и customer participant-preview; Playwright SHALL пройти paid application→submission→revision journey.

## 9. Оплата, оценка 5+ и human decision

- [x] 9.1 Реализовать CompensationTerms и Decimal `premium_total` с B=1.5, A=[2,3], quantum/rounding snapshot; Hypothesis tests SHALL покрыть границы и invalid policy.
- [x] 9.2 Реализовать paid/unpaid display models и одинаковые base/B/A details в card, focus tooltip и consent screen; UI tests SHALL проверить keyboard и exact totals.
- [x] 9.3 Реализовать rubric/review state machine, evidence-linked draft и human publish с conflict check; scenarios `compensation-5plus/Оценка конкретного проекта` SHALL пройти.
- [x] 9.4 Реализовать payout claim calculation/approval/demo adapter statuses раздельно от settlement; duplicate/retry/reversal tests SHALL исключить двойную выплату.
- [x] 9.5 Реализовать appeal блокировку по policy и corrected/upheld flow без переписывания истории; integration test SHALL сохранить обе review versions.
- [x] 9.6 Реализовать review/payout explanation UI для участника и human review workspace ментора; Playwright SHALL показать AI draft отдельно от final human grade.

## 10. Рейтинг, дипломы, портфолио и трофеи

- [x] 10.1 Реализовать versioned season/rating policy с cohort, weights, caps, ties, thresholds и appeal period; opening SHALL блокироваться при неполной policy.
- [x] 10.2 Реализовать append-only ScoreLedger и deterministic standings rebuild; tests SHALL покрыть duplicate source, correction, tie и cohort boundary.
- [x] 10.3 Реализовать opt-in leaderboard с place, successful projects, score и consented trophy proof; privacy tests SHALL обезличить non-consenting participant.
- [x] 10.4 Реализовать credential issue/verify/revoke/supersede после frozen season; public verification tests SHALL раскрывать только разрешённые поля.
- [x] 10.5 Реализовать trophy и offer evidence как разные типы; scenario `portfolio-trophies/Победа без оффера` SHALL исключить ложную надпись.
- [x] 10.6 Реализовать portfolio/resume UI с review reason, contribution, courses, credentials, trophies и visibility controls; HR consent withdrawal SHALL убрать профиль из search.

## 11. Кабинеты заказчика, ментора, руководителя, HR и оператора

- [x] 11.1 Реализовать customer dashboard/wizard/queue/acceptance и analytics links; role e2e SHALL создать unpaid и paid draft с participant preview.
- [x] 11.2 Реализовать mentor queue/workspace с due sorting, evidence, rubric, publish/escalate; permission tests SHALL скрыть неназначенные assignments.
- [x] 11.3 Реализовать manager initiatives/accepted artifacts/reuse aggregates; tests SHALL исключить chats, closed reviews и чужие payouts.
- [ ] 11.4 Реализовать HR candidate search/evidence resume и pipeline invitation→interview→offer→hire; tests SHALL считать каждую стадию только по human event.
- [ ] 11.5 Реализовать operator unified case queue, timeline, sources, dependencies и versioned decisions; stale case test SHALL запретить старое решение.
- [ ] 11.6 Добавить disabled placeholders только для ролей второй очереди и убрать их из MVP navigation; e2e SHALL вернуть feature-not-enabled без кабинета.

## 12. Аналитика и события

- [ ] 12.1 Реализовать versioned domain event schema и transactional emission для всех значимых transitions; tests SHALL проверить idempotency и отсутствие raw chat/payment details.
- [ ] 12.2 Реализовать participant funnel и earnings breakdown с next action/unknown/freshness; incomplete journey SHALL не считаться success.
- [ ] 12.3 Реализовать mentor/customer/manager/HR/operator metric queries с numerator/denominator/period/cohort; fixture tests SHALL сверить формулы из analytics spec.
- [ ] 12.4 Реализовать small-cohort suppression и provisional/verified import states; privacy test SHALL скрыть персональные строки ниже threshold.
- [ ] 12.5 Реализовать role analytics dashboards с definitions drill-down и stale data state; frontend tests SHALL отображать задержку, а не нулевой результат.
- [ ] 12.6 Добавить analytics dictionary и test-backed query examples в docs; documentation check SHALL выполнить каждый SQL/API example.

## 13. AI foundation, gateway и governance

- [ ] 13.1 Реализовать ModelPurpose/ModelResult/ModelGateway contracts и FakeGateway outcomes; unit tests SHALL покрыть text, tool, structured, malformed, 402, 429 и timeout.
- [ ] 13.2 Реализовать OpenRouterGateway через `ChatOpenRouter` без утечки SDK в domain; contract test с mock transport SHALL нормализовать model/provider/usage/request ID.
- [ ] 13.3 Реализовать versioned model registry только для `openrouter/free` или verified `:free`, capability/price startup probe и запрет paid fallback; tests SHALL отклонить non-free slug.
- [ ] 13.4 Реализовать data classifier, field allowlist, secret redaction и privacy preflight; blocked classes SHALL завершаться до HTTP-вызова.
- [ ] 13.5 Реализовать per-agent/user/day/run quotas, timeout, max tools/steps и circuit breaker; tests SHALL остановить loop и сохранить manual path.
- [ ] 13.6 Реализовать prompt registry/version hashing и Pydantic answer/suggestion validation; invalid source refs/schema SHALL не достигать UI/domain.
- [ ] 13.7 Добавить admin-safe `/health/ai`/registry diagnostics без key/content; API tests SHALL проверить authentication и redaction.

## 14. LangGraph persistence и Buddy

- [ ] 14.1 Реализовать PostgreSQL-backed graph checkpoint/thread ownership namespace и restart harness; test SHALL восстановить awaiting run ровно один раз.
- [ ] 14.2 Реализовать read-only Buddy tools поверх application services с повторным RBAC/source versions/limits; каждый tool SHALL иметь foreign-ID test.
- [ ] 14.3 Реализовать Buddy graph classify→tools→grounded answer→validation и manual hand-off; fixtures SHALL покрыть role switch, money, offer и unverifiable event.
- [ ] 14.4 Реализовать thread/messages/feedback API, idempotent client request и SSE safe events; tests SHALL покрыть duplicate message, cancel и cross-thread IDOR.
- [ ] 14.5 Реализовать Buddy UI, sources, suggested navigation, uncertainty, disable/delete/memory consent; Playwright SHALL проверить основной продукт при выключенном AI.
- [ ] 14.6 Реализовать retention cleanup и immediate stop reading preferences после consent withdrawal; tests SHALL сохранить доменный audit при удалении chat.
- [ ] 14.7 Выполнить ручной smoke настоящего OpenRouter на synthetic/public fixtures и записать фактическую free model/capabilities без сохранения ключа или raw trace.

## 15. Помощники ментора, оператора и заказчика

- [ ] 15.1 Реализовать mentor graph/evidence retrieval/ReviewSuggestion и injection isolation; malicious README test SHALL не расширить tools и не выставить grade.
- [ ] 15.2 Реализовать mentor human interrupt/resume и domain recheck; changed artifact/rubric SHALL сделать suggestion `stale`.
- [ ] 15.3 Реализовать operator triage/duplicate graph с provider+external IDs и transparent priority; namesake fixtures SHALL не объединиться.
- [ ] 15.4 Реализовать operator human decision/feedback и dependent-record preview; suggestion SHALL не изменить trophy/score/credential без command.
- [ ] 15.5 Реализовать optional customer brief suggestion только для synthetic/public draft и deterministic publish validator; internal brief SHALL получить manual template.
- [ ] 15.6 Интегрировать suggestions в role workspaces с approve/edit/reject и version display; e2e SHALL подтвердить human actor/reason/audit.

## 16. Langfuse, evaluation и AI release gates

- [ ] 16.1 Реализовать optional Langfuse adapter с metadata-only default и pre-callback redaction; unavailable Langfuse test SHALL не ломать run/audit.
- [ ] 16.2 Создать versioned offline dataset всех cases из design и expected tool/fact/refusal contracts; dataset schema test SHALL валидировать каждый fixture.
- [ ] 16.3 Реализовать evaluation runner baseline vs candidate по groundedness/tool/schema/safety/latency/usage; deterministic report SHALL сохранять versions и run IDs.
- [ ] 16.4 Реализовать hard gates для disclosure, secret, wrong money/offer, unauthorized write, paid model и blocked data; каждый gate SHALL иметь failing regression fixture.
- [ ] 16.5 Реализовать online feedback linkage и dashboards override/fallback/business outcome; tests SHALL не менять participant grade от feedback.
- [ ] 16.6 Документировать model/prompt release/canary/rollback и выполнить dry-run смены policy на FakeGateway; previous version SHALL восстановиться без domain migration.

## 17. Security и эксплуатационная устойчивость

- [ ] 17.1 Реализовать CORS/CSP/CSRF, secure cookies, request/attachment limits и external-link protection; security tests SHALL покрыть unsafe origin/payload.
- [ ] 17.2 Добавить rate limiting для auth/search/write/agents и sanitized abuse logging; tests SHALL проверить независимые лимиты и отсутствие полного sensitive identifier.
- [ ] 17.3 Провести системные IDOR tests по API/tools/threads/credentials и secret scan Git/image/log/trace fixtures; critical finding SHALL падать CI.
- [ ] 17.4 Реализовать AI kill switches и degraded states; integration test SHALL выключить каждый agent независимо при доступных core flows.
- [ ] 17.5 Реализовать incident runbooks для false offer/money, leak, provider outage, failed payout и revoked source; tabletop tests SHALL пройти по документированным steps.

## 18. Docker, Railway и CI/CD

- [ ] 18.1 Создать multi-stage non-root Dockerfile с locked frontend/backend builds и SPA fallback; `docker build` и container smoke SHALL пройти без secret build args.
- [ ] 18.2 Добавить `/health/live`, `/health/ready`, migration pre-deploy и `railway.toml`; local container+PostgreSQL test SHALL пройти startup/restart.
- [ ] 18.3 Создать CI pipeline: OpenSpec strict, lint/types, unit/integration/frontend, build, Docker smoke, scans; intentional failure каждого stage SHALL блокировать merge.
- [ ] 18.4 Добавить expand/backfill/contract migration и Railway rollback instructions; dry-run SHALL развернуть предыдущий image на совместимой schema.
- [ ] 18.5 Подготовить Railway Variables checklist без значений и budget/free-quota observability; review SHALL подтвердить отсутствие ключа в tracked files.

## 19. Сквозная приёмка MVP и handoff

- [ ] 19.1 Реализовать Playwright journey взрослого участника: login→два tracks→курс/streak→paid task→contribution→human B→calculated payout→portfolio; traceability SHALL ссылаться на specs.
- [ ] 19.2 Реализовать journeys смены направления, changed terms, disputed grade, verified/revoked trophy, opt-out и HR verification; каждый SHALL проверять audit/version/privacy.
- [ ] 19.3 Реализовать AI journeys Buddy money/offer/manual path, mentor draft/reject и operator false duplicate; тесты SHALL пройти с FakeGateway и AI disabled.
- [ ] 19.4 Запустить full quality suite, OpenSpec `validate --all --strict`, Docker smoke и dependency/secret scans; сохранить краткий release report с командами и результатами.
- [ ] 19.5 Развернуть demo в Railway после явного подтверждения владельца, задать secrets через Variables и выполнить post-deploy health/login/Buddy smoke без вывода ключа.
- [ ] 19.6 Провести ручную приёмку шести ролей и accessibility pass, зафиксировать известные ограничения/free quota/launch gates и получить решение expand/iterate/stop.
