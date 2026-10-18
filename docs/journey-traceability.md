# Playwright journey traceability

Матрица подготавливает задачи 19.1–19.3: OpenSpec scenario → deterministic fixture →
Playwright journey → обязательные доменные, audit и privacy assertions. Строка не считается
покрытой по одному screenshot или видимости текста; тест должен выполнить primary workflow.

## Общие правила fixture

- фиксируются persona, role, locale `ru-RU`, timezone, clock, stable UUID и seed revision;
- внешний provider заменяется FakeGateway, кроме отдельного controlled manual smoke;
- тест не зависит от порядка других тестов и создаёт/сбрасывает только owned fixture state;
- assertion проверяет API/domain result и audit/version, а не только optimistic UI;
- foreign-object и AI-disabled branch обязательны для privacy/security-sensitive journey;
- trace, screenshot и report не содержат cookie, CSRF, secrets или raw sensitive content.

## 19.1 — взрослый участник

| Journey ID | OpenSpec trace | Deterministic fixture | Обязательные assertions | Target test |
|---|---|---|---|---|
| `J-PAR-ADULT-01` | `identity-access/Регистрация взрослого участника`; `career-roadmap/Выбор второй роли`; `projects-tasks/Первый успешный отклик`; `compensation-5plus/Публикация B` | adult participant, два направления, verified course, paid task, accepted assignment, contribution/evidence | login без требования вуза; два active tracks; course/streak; один application; принятый личный вклад; human B; calculated отдельно от paid; portfolio содержит evidence/version | `frontend/e2e/journey-participant-adult.spec.ts` |

Последовательность: login → два tracks → course/streak → paid task/terms → application →
mock acceptance → project workspace → contribution/evidence → human B → calculated payout →
portfolio. На каждом переходе сохраняется конкретный object ID, а reload восстанавливает
текущий route и server state без создания дубля.

## 19.2 — доменные и privacy journeys

| Journey ID | OpenSpec trace | Ключевой переход | Обязательные assertions | Target test |
|---|---|---|---|---|
| `J-TRACK-SWITCH-01` | `career-roadmap/Смена интереса`; `career-roadmap/Возврат через месяц` | третий выбор замораживает один active track, затем возвращает его | progress/history не потеряны; mentor approval не требуется; не более двух active | `journey-track-switch.spec.ts` |
| `J-TERMS-CHANGED-01` | `compensation-5plus/Изменение A`; `projects-tasks/Принятие устаревших условий` | terms меняются между preview и consent | stale acceptance получает `TERMS_CHANGED`; новые суммы/version видимы до повторного согласия | `journey-terms-changed.spec.ts` |
| `J-GRADE-DISPUTE-01` | `projects-tasks/Неясное авторство`; `compensation-5plus/Черновик агента` | revision/dispute после review | AI draft не final; human actor/reason/version в audit; конфликт блокирует payout | `journey-grade-dispute.spec.ts` |
| `J-TROPHY-REVOKE-01` | `portfolio-trophies/Награда МАЯКОВ`; `portfolio-trophies/Источник отозвал победу` | verified trophy становится revoked | correction append-only; score/credential dependencies invalidated; trophy не превращается в offer | `journey-trophy-revocation.spec.ts` |
| `J-PRIVACY-OPTOUT-01` | `identity-access/Отзыв видимости`; `portfolio-trophies/HR открывает профиль` | participant отзывает HR/profile consent | профиль исчезает из search и сохранённой карточки; audit остаётся; foreign direct URL возвращает safe 404 | `journey-privacy-optout.spec.ts` |
| `J-HR-VERIFY-01` | `portfolio-trophies/HR открывает профиль`; `portfolio-trophies/Победа без оффера` | HR проверяет consented evidence и создаёт отдельную кадровую стадию | видны только allowlisted fields; offer появляется только из отдельного подтверждения; ranking/grade не создаёт offer | `journey-hr-verification.spec.ts` |

Каждый тест также проверяет reload/deep link, актуальную version и отсутствие чужих IDs в
network payload, accessible name или error message.

## 19.3 — AI journeys

| Journey ID | OpenSpec trace | FakeGateway outcomes | Обязательные assertions | Target test |
|---|---|---|---|---|
| `J-BUDDY-MONEY-01` | `agent-buddy/Сколько заплатят за B`; `agent-buddy/Условия сменились` | grounded text, stale source, malformed, `402`, `429`, timeout | exact terms/version/source; calculated ≠ paid; no paid fallback; manual path при failure | `journey-ai-buddy.spec.ts` |
| `J-BUDDY-OFFER-01` | `agent-buddy/Лидер без оффера`; `agent-buddy/Чужой thread ID` | grounded refusal и foreign-thread attempt | не заявляет personal offer; foreign thread safe 404; citations только разрешённые | `journey-ai-buddy.spec.ts` |
| `J-MENTOR-DRAFT-01` | `agent-mentor/Ментор исправляет черновик`; `agent-mentor/Новый артефакт` | structured suggestion и stale resume | suggestion редактируем; publish только human; новая evidence/rubric version делает draft stale | `journey-ai-mentor.spec.ts` |
| `J-OPERATOR-DUP-01` | `agent-operator/Тёзки`; `agent-operator/Ложный дубль` | duplicate suggestion с совпадающим именем и разными source IDs | записи не объединены; transparent reason; reject feedback не меняет trophy/score/credential | `journey-ai-operator.spec.ts` |

Каждый AI journey запускается второй раз с соответствующим feature flag `false`. Повторный
прогон подтверждает отсутствие model call и доступность core/manual flow. Raw prompt/response
не используется как Playwright assertion или artifact.

## Evidence для закрытия

Для каждой строки сохранить:

- ссылку на target test и точные `spec/<Scenario>` markers;
- seed/dataset/FakeGateway version и Commit SHA;
- Playwright report/trace для текущего candidate;
- domain/API assertions для audit, version, privacy и human actor;
- AI-disabled результат для 19.3;
- foreign-ID результат для privacy/threads/credentials;
- открытые defects с owner/severity либо явное `none`.

Задачи 19.1–19.3 остаются открытыми, пока target tests не существуют и не прошли в CI.
Этот документ не является заменой реализации или test report.
