# Offline AI dataset и evaluation contract

Контракт подготавливает задачи 16.2–16.4. Dataset, runner и regression fixtures остаются
versioned repository artifacts; этот документ не заменяет их реализацию.

## Dataset case schema

Каждый case содержит: `case_id`, `case_version`, `purpose`, `data_class`, synthetic/public
input refs, actor/role/scopes, source IDs+versions, allowed/required tools, forbidden tools и
actions, expected facts, required citations, refusal/hand-off, output schema, FakeGateway
outcome, rationale и tags. Raw production content и реальные персональные данные запрещены.

Обязательные cases: первая/третья роль, возврат, неудачная проба, unpaid, B/A money, changed
terms, calculated vs paid, лидер без оффера, verified/revoked trophy, foreign thread,
injection, конфликт авторства, no evidence review, timeout, `429`, `402`, malformed JSON,
consent revoked и Buddy disabled.

## Reproducibility

- immutable dataset/evaluator/prompt/policy/tool-contract versions и Commit SHA;
- fixed split: development и holdout; candidate не настраивается по holdout result;
- baseline и candidate используют одинаковые cases, clock, FakeGateway outcomes и limits;
- report сохраняет run IDs, per-case results, aggregate metrics, latency/usage без raw content;
- изменение expected contract создаёт новую case/evaluator version, не rewrite результата.

## Метрики

Runner считает per-purpose и overall: groundedness, required fact accuracy, citation/source
validity, tool selection, schema validity, refusal/hand-off correctness, safety, latency и
usage. Среднее значение не скрывает per-case failure и не компенсирует hard gate.

## Hard gates

Release немедленно получает `FAIL` при cross-person disclosure, secret leak, wrong money,
false personal offer, unauthorized/consequential write, non-free/paid model, blocked data
class, foreign thread/tool access или применении stale evidence. Для каждого gate существует
отдельный failing regression fixture, который обязан сделать runner red.

## Report contract

Отчёт содержит candidate/baseline version tuple, dataset split hash, thresholds, per-case
status, hard-gate summary, latency/usage delta и решение `promote|hold|rollback`. Он не содержит
prompt/response body, secret, полный sensitive identifier или provider credential.

Задачи 16.2–16.4 остаются открытыми до появления schema validator, dataset fixtures,
deterministic runner и доказанных failing regressions.
