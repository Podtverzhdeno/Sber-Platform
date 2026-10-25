import { manualFor } from "./manuals";

/** Completely independent editorial sidebar: official course data remain untouched. */
const demoSnippets: Readonly<Record<string, { language: string; caption: string; body: string }>> = {
  "demo-course-1": {
    language: "spec.md",
    caption: "Из жалобы пользователя — в условие, которое можно проверить",
    body: "### Requirement: Repeated submission\\nThe system SHALL return the original submission ID\\nwhen the same actor repeats a request with the same\\nidempotency key; it SHALL NOT create a duplicate.",
  },
  "demo-course-2": {
    language: "Python · псевдокод",
    caption: "Модель предлагает; сервис принимает решение об операции",
    body: "proposal = agent.propose(request)\\nverify_schema(proposal)\\nverify_permission(actor, proposal.resource)\\nresult = service.execute(proposal, idempotency_key=key)\\nassert result.status == 'confirmed'",
  },
  "demo-course-3": {
    language: "Python",
    caption: "Проверяем значение до вычисления",
    body: "def normalize_amount(raw: str) -> int:\\n    value = int(raw)\\n    if value <= 0:\\n        raise ValueError('Amount must be positive')\\n    return value",
  },
  "demo-course-4": {
    language: "Python · FastAPI",
    caption: "Контракт отделяет тело запроса от результата",
    body: "from fastapi import FastAPI\\nfrom pydantic import BaseModel, Field\\n\\napp = FastAPI()\\n\\nclass Draft(BaseModel):\\n    amount: int = Field(gt=0)\\n\\n@app.post('/drafts', status_code=201)\\ndef create_draft(draft: Draft):\\n    return {'amount': draft.amount, 'status': 'draft'}",
  },
  "demo-course-5": {
    language: "SQL",
    caption: "Убираем удвоение заявок после соединения",
    body: "SELECT p.id, COUNT(DISTINCT a.id) AS applications\\nFROM projects p\\nLEFT JOIN applications a ON a.project_id = p.id\\nGROUP BY p.id;",
  },
  "demo-course-6": {
    language: "JSON",
    caption: "Событие с понятным происхождением, а не просто click",
    body: "{\\n  \"event_id\": \"evt_031\",\\n  \"event_name\": \"task_submission_confirmed\",\\n  \"task_id\": \"task_demo_1\",\\n  \"source\": \"backend\"\\n}",
  },
  "demo-course-7": {
    language: "Python",
    caption: "Точность — не единственная метрика классификатора",
    body: "tp, fp, fn = 8, 2, 12\\nprecision = tp / (tp + fp)\\nrecall = tp / (tp + fn)\\nprint(f'precision={precision:.2f}, recall={recall:.2f}')",
  },
  "demo-course-8": {
    language: "Shell",
    caption: "Три команды, которые помогают понять ветки",
    body: "git status\\ngit log --oneline --graph --decorate --all\\ngit diff --stat",
  },
  "demo-course-9": {
    language: "Python · pytest",
    caption: "Один инвариант важнее расплывчатого «работает»",
    body: "def test_idempotent_submission(api):\\n    first = api.submit(key='req-42')\\n    second = api.submit(key='req-42')\\n    assert first.id == second.id\\n    assert api.count_submissions() == 1",
  },
  "demo-course-10": {
    language: "Python · псевдокод",
    caption: "Авторизация находится на стороне сервера",
    body: "def read_document(actor, document):\\n    if actor.tenant_id != document.tenant_id:\\n        raise PermissionError('Forbidden')\\n    return storage.read(document.id)",
  },
  "demo-course-11": {
    language: "Тезис → доказательство → действие",
    caption: "Заголовок должен сообщать вывод",
    body: "Тезис: Повторные заявки дают 18% лишней нагрузки\\nДоказательство: 1 000 синтетических событий, 180 дублей\\nРешение: idempotency key и серверная проверка\\nСледующий шаг: измерить результат на пилоте",
  },
  "demo-course-12": {
    language: "Decision log",
    caption: "Чтобы договорённость пережила встречу",
    body: "Решение: включить ручное подтверждение опасных действий\\nВладелец: команда API\\nПричина: ограничить полномочия AI-агента\\nПроверка: тест отклонённой операции до запуска",
  },
};

export function ManualCompanionCard({ courseKey, lessonIndex }: { courseKey: string; lessonIndex: number }) {
  const guide = manualFor(courseKey, lessonIndex);
  if (!guide) return null;
  const snippet = lessonIndex === 0 ? demoSnippets[courseKey] : undefined;
  return (
    <section className="bc-manual" aria-label="Разбор из практики и методические материалы">
      <div className="bc-manual__story">
        <span className="bc-manual__label">С чего начинается настоящая задача</span>
        <p className="bc-manual__hook">{guide.hook}</p>
      </div>
      <div className="bc-manual__insight">
        <strong>Как об этом думает инженер</strong>
        <p>{guide.insight}</p>
      </div>
      {snippet && (
        <div className="bc-manual__snippet">
          <div className="bc-manual__snippet-head"><strong>{snippet.caption}</strong><small>{snippet.language}</small></div>
          <pre><code>{snippet.body.replaceAll("\\n", "\n")}</code></pre>
          <small>Авторский учебный пример, не фрагмент из документации. Данные и идентификаторы условные.</small>
        </div>
      )}
      <div className="bc-manual__source">
        <div>
          <strong>Настоящая методичка</strong>
          <p>Что найти в руководстве: <em>{guide.read}</em>. Сопоставьте объяснение с примером выше и вернитесь к практическому заданию.</p>
          <small>Объяснения Impulse написаны самостоятельно по мотивам технических принципов источника; это не перепечатка или официальный курс автора документации.</small>
        </div>
        <a href={guide.url} target="_blank" rel="noopener noreferrer">Читать {guide.source} ↗</a>
        {guide.additional && <a href={guide.additional.url} target="_blank" rel="noopener noreferrer" className="bc-manual__secondary">Дополнительно: {guide.additional.label} ↗</a>}
      </div>
    </section>
  );
}
