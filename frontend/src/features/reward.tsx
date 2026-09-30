import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { apiRequest } from "../api/client";
import { Badge, Card, StatePanel } from "../components/ui";

type Assessment = {
  criterion_key: string;
  finding: string;
  evidence_refs: string[];
};
type Review = {
  id: string;
  contribution_id: string;
  contribution_version: number;
  version: number;
  grade: "A" | "B" | "C";
  assessments: Assessment[];
  explanation: string;
  status: string;
  draft_origin: string;
  confirmed_by: string | null;
  published_by: string | null;
};
type Payout = {
  id: string;
  review_version: number;
  amount: string | null;
  currency: string | null;
  status: string;
  version: number;
};
type RewardItem = { review: Review; payout: Payout | null };
type MentorQueueItem = RewardItem & {
  task_title: string;
  deadline_at: string;
  personal_summary: string;
  artifact_keys: string[];
  contribution_accepted: boolean;
  authorship_conflict_open: boolean;
};

const csrfHeaders = (): HeadersInit => ({
  "X-CSRF-Token": sessionStorage.getItem("impulse_csrf") ?? "",
});
const statusLabels: Record<string, string> = {
  draft: "Черновик",
  proposed: "Ожидает подтверждения",
  human_confirmed: "Подтверждено человеком",
  published: "Опубликовано",
  disputed: "Оспаривается",
  corrected: "Исправлено",
  upheld: "Оставлено без изменения",
  calculated: "Оценка рассчитана",
  approved: "Оценка подтверждена",
  sent_to_payment_system: "Передано в платёжный контур",
  paid: "Выплачено",
  failed: "Требует проверки",
  reversed: "Возвращено",
  not_applicable: "Не применяется",
};

function ReviewEvidence({
  item,
  mentor = false,
}: {
  item: RewardItem;
  mentor?: boolean;
}) {
  const { review, payout } = item;
  return (
    <Card
      title={`Оценка ${review.grade} · вклад версии ${String(review.contribution_version)}`}
    >
      <div className="review-statuses">
        <Badge tone={review.status === "disputed" ? "warning" : "success"}>
          {statusLabels[review.status] ?? review.status}
        </Badge>
        {payout && (
          <Badge tone={payout.status === "failed" ? "warning" : "neutral"}>
            {statusLabels[payout.status] ?? payout.status}
          </Badge>
        )}
      </div>
      {review.draft_origin === "ai_suggestion" && (
        <aside className="ai-draft" aria-label="Черновик AI">
          <strong>Черновик предложен AI</strong>
          <p>
            Это только подготовка по доказательствам. AI не выставляет финальную
            оценку и не принимает решение за эксперта.
          </p>
        </aside>
      )}
      <section
        className="human-decision"
        aria-label="Финальное решение человека"
      >
        <p className="eyebrow">Финальное решение человека</p>
        <p className="review-grade">{review.grade}</p>
        <p>{review.explanation}</p>
        <p className="muted">
          Версия оценки {review.version}
          {review.published_by
            ? ` · подписал ${review.published_by.slice(0, 8)}`
            : " · ещё не опубликована"}
        </p>
      </section>
      <dl className="review-criteria">
        {review.assessments.map((assessment) => (
          <div key={assessment.criterion_key}>
            <dt>{assessment.criterion_key}</dt>
            <dd>
              {assessment.finding}
              <small>
                Доказательства: {assessment.evidence_refs.join(", ")}
              </small>
            </dd>
          </div>
        ))}
      </dl>
      {payout ? (
        <div className="payout-explanation"><strong>Оценка опубликована</strong><span>Результат подтверждён экспертом</span></div>
      ) : (
        <div className="payout-explanation payout-explanation--demo"><strong>Оценка опубликована</strong><span>Результат подтверждён экспертом</span></div>
      )}
      {mentor && (
        <p className="muted">
          Вклад: {review.contribution_id} · версия доказательств{" "}
          {review.contribution_version}
        </p>
      )}
    </Card>
  );
}

function MentorDemoWorkspace() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [queueFilter, setQueueFilter] = useState("Все");
  const [queueSearch, setQueueSearch] = useState("");
  const [activeTab, setActiveTab] = useState("Доказательства");
  const [grade, setGrade] = useState<"A" | "B" | "C">("A");
  const [decision, setDecision] = useState("");
  const people = [
    {
      name: "Анна Смирнова",
      task: "Рекомендательная система",
      due: "сегодня, 18:00",
      status: "Срочно",
      tone: "warning",
    },
    {
      name: "Илья Кузнецов",
      task: "Ассистент базы знаний",
      due: "завтра, 12:00",
      status: "На проверке",
      tone: "neutral",
    },
    {
      name: "Мария Волкова",
      task: "Сжатие изображений",
      due: "30 сентября",
      status: "Черновик AI",
      tone: "neutral",
    },
    {
      name: "Артём Соколов",
      task: "Прогнозирование нагрузки",
      due: "2 октября",
      status: "Ожидает",
      tone: "warning",
    },
  ];
  const visiblePeople = people
    .map((person, index) => ({ ...person, index }))
    .filter((person) => {
      const matchesSearch = `${person.name} ${person.task}`
        .toLowerCase()
        .includes(queueSearch.toLowerCase());
      const matchesFilter =
        queueFilter === "Все" ||
        (queueFilter === "Срочные" && person.tone === "warning") ||
        (queueFilter === "С AI-черновиком" && person.status === "Черновик AI");
      return matchesSearch && matchesFilter;
    });
  const selectedPerson = people[selectedIndex] ?? people[0];
  return (
    <div className="feature-stack mentor-demo">
      <header className="dashboard-heading">
        <div>
          <p className="eyebrow">Ментор · R-MEN-02</p>
          <h1 id="workspace-title">Проверка вкладов</h1>
          <p className="lead">
            Оцените личный вклад по доказательствам. AI готовит черновик,
            финальную оценку публикуете только вы.
          </p>
        </div>
        <Badge tone="success">Данные актуальны</Badge>
      </header>
      <section className="metric-grid">
        <article className="metric-card metric-card--blue">
          <span className="metric-icon">▤</span>
          <span>В очереди</span>
          <strong>12</strong>
          <small>3 новых сегодня</small>
          <i />
        </article>
        <article className="metric-card metric-card--violet">
          <span className="metric-icon">◷</span>
          <span>Просрочено</span>
          <strong>3</strong>
          <small>требует внимания</small>
          <i />
        </article>
        <article className="metric-card metric-card--teal">
          <span className="metric-icon">◴</span>
          <span>Среднее ревью</span>
          <strong>14 ч</strong>
          <small>↓ 20% за месяц</small>
          <i />
        </article>
        <article className="metric-card metric-card--teal">
          <span className="metric-icon">✓</span>
          <span>Принято</span>
          <strong>5</strong>
          <small>за неделю</small>
          <i />
        </article>
      </section>
      <div className="review-workbench">
        <section className="review-queue-panel">
          <header>
            <div>
              <h2>Очередь вкладов</h2>
              <span>{visiblePeople.length} показано</span>
            </div>
            <label>
              <span className="sr-only">Поиск по очереди</span>
              <input
                value={queueSearch}
                onChange={(event) => {
                  setQueueSearch(event.target.value);
                }}
                placeholder="Поиск участника…"
              />
            </label>
            <div className="filter-chips">
              {["Все", "Срочные", "С AI-черновиком"].map((item) => (
                <button
                  className={queueFilter === item ? "active" : ""}
                  type="button"
                  key={item}
                  onClick={() => {
                    setQueueFilter(item);
                  }}
                >
                  {item}
                </button>
              ))}
            </div>
          </header>
          {visiblePeople.map((person) => (
            <button
              className={`review-person${person.index === selectedIndex ? " active" : ""}`}
              type="button"
              key={person.name}
              onClick={() => {
                setSelectedIndex(person.index);
                setDecision("");
              }}
            >
              <span className="candidate-avatar">{person.name[0]}</span>
              <span>
                <strong>{person.name}</strong>
                <small>{person.task}</small>
                <em>{person.due}</em>
              </span>
              <Badge tone={person.tone === "warning" ? "warning" : "neutral"}>
                {person.status}
              </Badge>
            </button>
          ))}
        </section>
        <section className="review-detail-panel">
          <header>
            <div className="review-person-title">
              <span className="candidate-avatar">
                {selectedPerson?.name[0]}
              </span>
              <div>
                <p className="eyebrow">Личный вклад · версия 3</p>
                <h2>{selectedPerson?.name}</h2>
                <span>{selectedPerson?.task}</span>
              </div>
            </div>
            <Badge
              tone={selectedPerson?.tone === "warning" ? "warning" : "neutral"}
            >
              {selectedPerson?.due}
            </Badge>
          </header>
          <nav className="detail-tabs" aria-label="Разделы проверки">
            {["Доказательства", "Критерии", "История"].map((item) => (
              <button
                className={activeTab === item ? "active" : ""}
                type="button"
                key={item}
                onClick={() => {
                  setActiveTab(item);
                }}
              >
                {item}
              </button>
            ))}
          </nav>
          {activeTab !== "Доказательства" && (
            <div className="review-tab-summary">
              <strong>{activeTab}</strong>
              <span>
                {activeTab === "Критерии"
                  ? "Рубрика: функциональность, качество кода, архитектура, тестирование, документация и личный вклад."
                  : "Версия 1 · запрос уточнений; версия 2 · добавлены тесты; версия 3 · готово к финальному решению."}
              </span>
            </div>
          )}
          <div className="review-evidence-grid">
            <article>
              <p className="eyebrow">Описание вклада</p>
              <h3>Ранжирование и оценка качества</h3>
              <p>
                Реализовала гибридное ранжирование, подготовила воспроизводимый
                benchmark и описание ограничений модели.
              </p>
              <div className="evidence-files">
                <span>
                  ▤ evaluation-report.pdf <b>Проверено</b>
                </span>
                <span>
                  ⌘ repository / ranking <b>Доступен</b>
                </span>
                <span>
                  ◇ demo-video.mp4 <b>Просмотрено</b>
                </span>
              </div>
            </article>
            <article>
              <p className="eyebrow">Проверка критериев</p>
              <div className="rubric-row">
                <span>Качество решения</span>
                <strong>92%</strong>
                <i>
                  <b style={{ width: "92%" }} />
                </i>
              </div>
              <div className="rubric-row">
                <span>Воспроизводимость</span>
                <strong>88%</strong>
                <i>
                  <b style={{ width: "88%" }} />
                </i>
              </div>
              <div className="rubric-row">
                <span>Документация</span>
                <strong>84%</strong>
                <i>
                  <b style={{ width: "84%" }} />
                </i>
              </div>
              <div className="rubric-row">
                <span>Личный вклад</span>
                <strong>95%</strong>
                <i>
                  <b style={{ width: "95%" }} />
                </i>
              </div>
            </article>
          </div>
          <aside className="ai-review-suggestion">
            <div>
              <span className="ai-orb">✦</span>
              <p>
                <strong>Рекомендация AI: оценка A</strong>
                <span>Черновик по 7 подтверждённым источникам</span>
              </p>
              <Badge>Не решение</Badge>
            </div>
            <p>
              Критерии превышены по качеству и воспроизводимости. Проверьте
              авторство benchmark и влияние на итоговый результат.
            </p>
          </aside>
          <section className="human-review-box">
            <header>
              <div>
                <p className="eyebrow">Решение ментора</p>
                <h3>Оценка 5+</h3>
              </div>
              <div className="grade-buttons">
                {(["C", "B", "A"] as const).map((item) => (
                  <button
                    className={grade === item ? "active" : ""}
                    type="button"
                    key={item}
                    onClick={() => {
                      setGrade(item);
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </header>
            <label>
              Объяснение оценки
              <textarea defaultValue="Результат превышает критерии: создан воспроизводимый benchmark, качество подтверждено тестами, личный вклад прослеживается по истории артефактов." />
            </label>
            <footer>
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setDecision(
                    "Запрос на доработку отправлен участнику и добавлен в историю вклада.",
                  );
                }}
              >
                Запросить доработку
              </button>
              <button
                type="button"
                onClick={() => {
                  setDecision(
                    `Оценка ${grade} опубликована. Участник получил уведомление.`,
                  );
                }}
              >
                Подтвердить оценку {grade}
              </button>
            </footer>
            {decision && <p className="inline-success">{decision}</p>}
          </section>
        </section>
      </div>
    </div>
  );
}

export function ParticipantRewardEvidence() {
  const query = useQuery({
    queryKey: ["participant-reward-evidence"],
    queryFn: () => apiRequest<RewardItem[]>("/api/v1/me/reward-evidence"),
    refetchOnMount: "always",
  });
  if (query.isLoading) return <StatePanel kind="loading" />;
  if (query.isError || !query.data)
    return (
      <StatePanel
        kind="error"
        action="Повторить"
        onAction={() => {
          void query.refetch();
        }}
      />
    );
  return (
    <section className="feature-stack" aria-labelledby="reward-evidence-title">
      <div>
        <p className="eyebrow">Подтверждённый опыт и деньги</p>
        <h2 id="reward-evidence-title">
          Почему поставлена оценка и как улучшить результат
        </h2>
        <p className="lead">
          Здесь видны факты личного вклада, решение человека и отдельный статус
          результата. Оценка не скрывает ошибку обработки.
        </p>
      </div>
      {query.data.length ? (
        <div className="reward-grid">
          {query.data.map((item) => (
            <ReviewEvidence key={item.review.id} item={item} />
          ))}
        </div>
      ) : (
        <StatePanel kind="empty" />
      )}
    </section>
  );
}

export function MentorReviewWorkspace() {
  const client = useQueryClient();
  const [escalated, setEscalated] = useState<Set<string>>(new Set());
  const query = useQuery({
    queryKey: ["mentor-review-workspace"],
    queryFn: () => apiRequest<MentorQueueItem[]>("/api/v1/mentor/review-queue"),
    refetchOnMount: "always",
  });
  const transition = useMutation({
    mutationFn: ({
      review,
      action,
    }: {
      review: Review;
      action: "propose" | "confirm" | "publish";
    }) =>
      apiRequest(`/api/v1/mentor/reviews/${review.id}/${action}`, {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify({ expected_version: review.version }),
      }),
    onSuccess: async () =>
      client.invalidateQueries({ queryKey: ["mentor-review-workspace"] }),
  });
  if (query.isLoading) return <StatePanel kind="loading" />;
  if (query.isError || !query.data)
    return (
      <StatePanel
        kind="error"
        action="Повторить"
        onAction={() => {
          void query.refetch();
        }}
      />
    );
  if (query.data.length === 0) return <MentorDemoWorkspace />;
  return (
    <div className="feature-stack">
      <section>
        <p className="eyebrow">Ментор · human-in-the-loop</p>
        <h1 id="workspace-title">Проверяйте доказательства, а не вывод AI</h1>
        <p className="lead">
          Очередь отсортирована сервером по дедлайну. Видны только назначенные
          вам работы; AI-черновик отделён от финального решения человека.
        </p>
      </section>
      {query.data.length ? (
        <div className="mentor-queue">
          {query.data.map((item) => (
            <article className="mentor-queue-item" key={item.review.id}>
              <header>
                <div>
                  <p className="eyebrow">
                    До {new Date(item.deadline_at).toLocaleString("ru-RU")}
                  </p>
                  <h2>{item.task_title}</h2>
                </div>
                <Badge
                  tone={
                    item.authorship_conflict_open
                      ? "warning"
                      : item.contribution_accepted
                        ? "success"
                        : "neutral"
                  }
                >
                  {item.authorship_conflict_open
                    ? "Конфликт авторства"
                    : item.contribution_accepted
                      ? "Вклад принят"
                      : "Ожидает приёмки"}
                </Badge>
              </header>
              <div className="mentor-evidence">
                <div>
                  <h3>Личный вклад</h3>
                  <p>{item.personal_summary}</p>
                  <small>
                    Доказательства:{" "}
                    {item.artifact_keys.join(", ") || "не приложены"}
                  </small>
                </div>
                <ReviewEvidence item={item} mentor />
              </div>
              <div className="review-actions">
                {item.review.status === "draft" && (
                  <button
                    type="button"
                    onClick={() => {
                      transition.mutate({
                        review: item.review,
                        action: "propose",
                      });
                    }}
                  >
                    Передать на подтверждение
                  </button>
                )}
                {item.review.status === "proposed" && (
                  <button
                    type="button"
                    onClick={() => {
                      transition.mutate({
                        review: item.review,
                        action: "confirm",
                      });
                    }}
                  >
                    Подтвердить человеком
                  </button>
                )}
                {item.review.status === "human_confirmed" && (
                  <button
                    type="button"
                    disabled={
                      !item.contribution_accepted ||
                      item.authorship_conflict_open
                    }
                    onClick={() => {
                      transition.mutate({
                        review: item.review,
                        action: "publish",
                      });
                    }}
                  >
                    Опубликовать оценку
                  </button>
                )}
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    setEscalated((current) =>
                      new Set(current).add(item.review.id),
                    );
                  }}
                >
                  {escalated.has(item.review.id)
                    ? "Передано оператору (демо)"
                    : "Эскалировать оператору"}
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <StatePanel kind="empty" />
      )}
    </div>
  );
}
