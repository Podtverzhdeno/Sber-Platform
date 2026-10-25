/** Original, course-specific starter cases, informed by public technical documentation.
 * They are learning exercises, not executable services or provider-authored curriculum.
 * No grades, certifications, or claims of verified work are issued here. */
export type StarterCase = {
  scenario: string;
  starterLabel: string;
  starter: string;
  checkpoints: string[];
  commonPitfall: string;
  reference: { label: string; url: string };
};

const cases: Record<string, StarterCase> = {
  "demo-course-1": {
    scenario: "Участник дважды нажимает «Отправить решение» из-за медленного ответа API. Нужно сохранить ровно одну отправку и показать одинаковый ID в обоих ответах.",
    starterLabel: "acceptance.md",
    starter: "REQ-01: The system SHALL create at most one submission per (actor, task, idempotency_key).\nGIVEN actor A has access to task T\nWHEN A sends POST /submissions twice with the same key K\nTHEN both responses contain the same submission_id\nAND exactly one submission exists in storage",
    checkpoints: ["Описать идемпотентность как требование к данным, а не только UI", "Добавить негативный сценарий: ключ повторён с другим телом", "Связать REQ-01 с интеграционным тестом и ADR"],
    commonPitfall: "Успешный HTTP 200 два раза не доказывает, что дублей нет в БД.",
    reference: { label: "OpenSpec", url: "https://github.com/Fission-AI/OpenSpec" },
  },
  "demo-course-2": {
    scenario: "Корпоративный AI-агент находит неоплаченные заказы и готовит предложения. Совершать платёж без авторизации и подтверждения он не вправе.",
    starterLabel: "agent-policy.py · псевдокод",
    starter: "proposal = agent.plan(request)\nargs = validate_tool_schema(proposal)\nprincipal = verify_identity(session)\nif proposal.operation == 'pay':\n    require_explicit_approval(principal, proposal)\nresult = execute_authorized(args, idempotency_key=request_id)\nverify_effect(result)\naudit(principal, proposal, result)",
    checkpoints: ["Изобразить граф состояний с веткой отказа инструмента", "Разделить права LLM и права сервиса", "Протестировать отказ в платеже без подтверждения"],
    commonPitfall: "Ответ LLM «операция выполнена» не подтверждает реальное изменение состояния системы.",
    reference: { label: "LangGraph", url: "https://docs.langchain.com/oss/python/langgraph/overview" },
  },
  "demo-course-3": {
    scenario: "Нужно безопасно просуммировать заявки со статусом new: суммы приходят строками, иногда пустыми или невалидными.",
    starterLabel: "totals.py · Python",
    starter: "from decimal import Decimal, InvalidOperation\n\ndef total_new(rows):\n    total = Decimal('0')\n    for row in rows:\n        if row.get('status') != 'new':\n            continue\n        try:\n            amount = Decimal(str(row['amount']))\n        except (KeyError, InvalidOperation, ValueError):\n            continue\n        if not amount.is_finite() or amount < 0:\n            continue\n        total += amount\n    return total",
    checkpoints: ["Проверить [] → Decimal('0')", "Проверить две строки '0.10' и '0.20' без float", "Отдельно проверить отрицательное значение, NaN и отсутствующий ключ"],
    commonPitfall: "float и неограниченный except часто дают неверные суммы и скрывают ошибки данных.",
    reference: { label: "Python tutorial", url: "https://docs.python.org/3/tutorial/" },
  },
  "demo-course-4": {
    scenario: "Сервис принимает черновик заявки. Неверный amount должен отклоняться при валидации ещё до выполнения бизнес-логики.",
    starterLabel: "main.py · FastAPI",
    starter: "from fastapi import FastAPI\nfrom pydantic import BaseModel, Field\n\napp = FastAPI()\n\nclass Draft(BaseModel):\n    amount: int = Field(gt=0)\n    task_id: str = Field(min_length=1)\n\n@app.post('/drafts', status_code=201)\ndef create_draft(draft: Draft):\n    return {'task_id': draft.task_id, 'amount': draft.amount}",
    checkpoints: ["Проверить 201 для валидного тела", "Проверить 422 для amount=0 и отсутствующего task_id", "Добавить тест доступа к объекту другого пользователя"],
    commonPitfall: "Валидация Pydantic не заменяет авторизацию доступа к конкретному объекту.",
    reference: { label: "FastAPI testing", url: "https://fastapi.tiangolo.com/tutorial/testing/" },
  },
  "demo-course-5": {
    scenario: "Посчитайте число откликов по каждому проекту, включая проекты без заявок. Не допускайте удвоения после JOIN.",
    starterLabel: "project_counts.sql · PostgreSQL",
    starter: "SELECT p.id, COUNT(a.id) AS applications\nFROM projects AS p\nLEFT JOIN applications AS a ON a.project_id = p.id\nGROUP BY p.id\nORDER BY p.id;",
    checkpoints: ["Проект без откликов должен получить 0", "Два отклика к одному проекту должны дать 2", "После присоединения других таблиц проверьте кратность и COUNT(DISTINCT a.id)"],
    commonPitfall: "INNER JOIN незаметно исключает проекты без откликов, а JOIN двух 1:N-связей раздувает число строк.",
    reference: { label: "PostgreSQL joins", url: "https://www.postgresql.org/docs/current/tutorial-join.html" },
  },
  "demo-course-6": {
    scenario: "Заказчик спрашивает, почему участники открывают задачи, но не отправляют решения. Нужна корректная воронка.",
    starterLabel: "events.json · пример событий",
    starter: "{\"event_id\":\"e1\",\"actor_id\":\"u1\",\"task_id\":\"t1\",\"event_name\":\"task_opened\",\"ts\":\"2026-10-01T10:00:00Z\"}\n{\"event_id\":\"e2\",\"actor_id\":\"u1\",\"task_id\":\"t1\",\"event_name\":\"application_sent\",\"ts\":\"2026-10-01T10:05:00Z\"}\n{\"event_id\":\"e3\",\"actor_id\":\"u1\",\"task_id\":\"t1\",\"event_name\":\"submission_accepted\",\"ts\":\"2026-10-05T10:00:00Z\"}",
    checkpoints: ["Определить единицу учёта: пользователь или пара пользователь–задача", "Удалить дубли по event_id до расчёта конверсии", "Разделить application_sent и submission_accepted, проверить окно атрибуции"],
    commonPitfall: "Складывать события вместо уникальных участников и считать корреляцию причинностью.",
    reference: { label: "Amplitude taxonomy guide", url: "https://amplitude.com/blog/event-tracking-taxonomy" },
  },
  "demo-course-7": {
    scenario: "Модель определяет, нужна ли ручная проверка заявки. Ложноотрицательный ответ пропускает рискованное решение.",
    starterLabel: "quality.py · Python",
    starter: "from sklearn.metrics import precision_recall_fscore_support\n\ny_true = [1, 1, 1, 0, 0, 0, 0]\ny_pred = [1, 0, 1, 0, 1, 0, 0]\np, r, f1, _ = precision_recall_fscore_support(\n    y_true, y_pred, average='binary', zero_division=0\n)\nprint({'precision': round(p, 2), 'recall': round(r, 2), 'f1': round(f1, 2)})",
    checkpoints: ["Посчитать FP и FN вручную", "Выбрать метрику с учётом цены пропущенного риска", "Использовать отдельный тестовый набор без утечки целевой переменной"],
    commonPitfall: "Accuracy при дисбалансе классов может маскировать неприемлемый recall.",
    reference: { label: "scikit-learn model evaluation", url: "https://scikit-learn.org/stable/modules/model_evaluation.html" },
  },
  "demo-course-8": {
    scenario: "Исправление API должно пройти ревью и тесты до слияния в главную ветку.",
    starterLabel: "terminal · Git",
    starter: "git switch -c fix/api-validation\ngit status\ngit add src/api.py tests/test_api.py\ngit diff --cached\ngit commit -m 'fix: validate incoming amount'\ngit log --oneline --graph --max-count=5",
    checkpoints: ["Посмотреть diff до коммита и убедиться, что там нет секретов", "Создать pull request с тестами и описанием риска", "Проверить конфликты и зелёный CI перед merge"],
    commonPitfall: "git add . без просмотра staged diff может захватить ключи, файлы окружения и мусор.",
    reference: { label: "Pro Git", url: "https://git-scm.com/book/en/v2" },
  },
  "demo-course-9": {
    scenario: "Повтор одного платежного запроса с тем же ключом не должен создавать новый объект.",
    starterLabel: "test_submissions.py · pytest (псевдофикстура api)",
    starter: "def test_idempotent_submission(api):\n    first = api.submit(task_id='t1', key='req-42')\n    again = api.submit(task_id='t1', key='req-42')\n    assert first.id == again.id\n    assert api.count_submissions(task_id='t1') == 1",
    checkpoints: ["Добавить отрицательный тест для чужого task_id", "Проверить побочный эффект в хранилище, а не только код ответа", "Сделать тест независимым от порядка выполнения"],
    commonPitfall: "Тест, который проверяет только HTTP 200, не доказывает корректность бизнес-состояния.",
    reference: { label: "pytest assertions", url: "https://docs.pytest.org/en/stable/how-to/assert.html" },
  },
  "demo-course-10": {
    scenario: "Пользователь из одного подразделения пытается открыть документ другого подразделения, изменив ID в URL.",
    starterLabel: "authorization.py · Python, иллюстрация",
    starter: "def read_document(actor, document):\n    if not actor.is_authenticated:\n        raise PermissionError('Unauthorized')\n    if actor.tenant_id != document.tenant_id:\n        raise PermissionError('Forbidden')\n    return storage.read(document.id)",
    checkpoints: ["Проверить запрет на чужой объект даже при валидном токене", "Не использовать только client-side проверку кнопок", "Зафиксировать аудит отказа без утечки чувствительных данных"],
    commonPitfall: "Валидный JWT подтверждает аутентификацию, но не доступ к произвольному объекту.",
    reference: { label: "OWASP API Security Top 10", url: "https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/" },
  },
  "demo-course-11": {
    scenario: "За 90 секунд нужно объяснить заказчику, зачем изменять процесс проверки задач и как оценить эффект.",
    starterLabel: "decision-note.md · структура выступления",
    starter: "Сейчас: 30% решений возвращаются без понятной причины.\nПроблема: участник не понимает, что доработать.\nПредложение: структурированные критерии + шаблон обратной связи.\nПилот: две команды, четыре недели.\nРешение для заказчика: утвердить пилот и назначить владельца метрики.",
    checkpoints: ["Отделить проверенный факт от гипотезы и обозначить источник метрики", "Показать сравнение «до / после» на одинаковой выборке", "Завершить конкретным запросом решения"],
    commonPitfall: "Большой список функций без проблемы, измерения и запрашиваемого решения не помогает аудитории.",
    reference: { label: "Microsoft accessibility for presentations", url: "https://support.microsoft.com/en-us/office/make-your-powerpoint-presentations-accessible-to-people-with-disabilities-6f7772b2-2d0c-4e39-beb2-2013a5f3fcac" },
  },
  "demo-course-12": {
    scenario: "Участник заметил, что в общий чат отправили экспорт с персональными данными. Нужно корректно остановить распространение и сообщить ответственному.",
    starterLabel: "incident-playbook.md",
    starter: "1. Не пересылай файл и не копируй его содержимое.\n2. Используй утверждённый канал сообщения об инциденте.\n3. Передай ссылку, время, канал, контекст — без повторной публикации данных.\n4. Действуй по инструкции уполномоченной команды.\n5. После инцидента предложи профилактический контроль.",
    checkpoints: ["Отделить факты от предположений", "Обратиться к ответственному без публичных обвинений", "Проверить, что инцидент не расширен своими действиями"],
    commonPitfall: "Решать проблему публичной перепалкой или пересылать чувствительные данные ради «доказательств».",
    reference: { label: "NIST AI risk playbook", url: "https://airc.nist.gov/airmf-resources/playbook/" },
  },
};
export function starterCaseFor(key: string): StarterCase | null { return cases[key] ?? null; }
export function allStarterCases(): StarterCase[] { return Object.values(cases); }
