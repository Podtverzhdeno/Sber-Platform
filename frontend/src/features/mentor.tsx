import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Badge, Card } from "../components/ui";

const reviews = [
  {
    person: "Анна Смирнова",
    project: "Рекомендательная система",
    contribution: "Гибридное ранжирование · v3",
    due: "сегодня, 18:00",
    state: "Просрочено",
    tone: "warning" as const,
  },
  {
    person: "Илья Кузнецов",
    project: "Ассистент базы знаний",
    contribution: "Контур RAG · v2",
    due: "завтра, 12:00",
    state: "На проверке",
    tone: "neutral" as const,
  },
  {
    person: "Мария Волкова",
    project: "Сжатие изображений",
    contribution: "Benchmark кодеков · v1",
    due: "30 сентября",
    state: "AI-черновик",
    tone: "neutral" as const,
  },
];

const projects = [
  {
    name: "Рекомендательная система",
    customer: "Роман Воронов · R&D",
    team: 4,
    progress: 72,
    status: "В разработке",
    risk: "Демо через 4 дня",
    stage: "Гибридный прототип",
    deadline: "12 октября",
    direction: "ML / Backend",
  },
  {
    name: "Ассистент базы знаний",
    customer: "Дарья Соколова · Platform",
    team: 3,
    progress: 58,
    status: "Активен",
    risk: "1 вклад ждёт ревью",
    stage: "RAG evaluation",
    deadline: "18 октября",
    direction: "LLM / Data",
  },
  {
    name: "Сжатие изображений",
    customer: "Павел Миронов · Mobile",
    team: 5,
    progress: 84,
    status: "На проверке",
    risk: "В норме",
    stage: "Финальный benchmark",
    deadline: "6 октября",
    direction: "CV / Research",
  },
];

const participants = [
  {
    name: "Анна Смирнова",
    role: "ML-инженер",
    project: "Рекомендательная система",
    progress: 78,
    status: "Требует внимания",
    activity: "2 часа назад",
    risk: "Нет A/B-результатов для финального checkpoint",
    courses: ["Python для R&D · 100%", "ML evaluation · 82%"],
  },
  {
    name: "Алекс Речной",
    role: "Backend-разработчик",
    project: "Рекомендательная система",
    progress: 70,
    status: "Активно",
    activity: "сегодня, 10:27",
    risk: "Обновить retry и rate limit до 12 октября",
    courses: ["FastAPI · 100%", "OpenSpec и SDD · 100%"],
  },
  {
    name: "Илья Кузнецов",
    role: "Data-инженер",
    project: "Ассистент базы знаний",
    progress: 54,
    status: "На доработке",
    activity: "вчера",
    risk: "Нет активности по исправлению 3 дня",
    courses: ["SQL · 94%", "RAG systems · 64%"],
  },
  {
    name: "Мария Волкова",
    role: "CV-инженер",
    project: "Сжатие изображений",
    progress: 86,
    status: "Активно",
    activity: "34 минуты назад",
    risk: "Рисков нет",
    courses: ["Computer Vision · 100%", "Эксперименты · 88%"],
  },
];

function MentorMetrics() {
  return (
    <section
      className="metric-grid mentor-metrics"
      aria-label="Показатели ментора"
    >
      {[
        ["На проверке", "8", "3 новых сегодня", "blue"],
        ["Просрочено", "2", "нужно действие", "warning"],
        ["Средний ответ", "14 ч", "−20% за месяц", "teal"],
        ["Нагрузка", "3 / 12", "проекта / участников", "violet"],
      ].map(([label, value, detail, tone]) => (
        <article
          className={`metric-card metric-card--${tone ?? "blue"}`}
          key={label}
        >
          <span className="metric-icon">◇</span>
          <span>{label}</span>
          <strong>{value}</strong>
          <small>{detail}</small>
          <i />
        </article>
      ))}
    </section>
  );
}

export function MentorDashboard({ mentorName }: { mentorName: string }) {
  const navigate = useNavigate();
  return (
    <div className="feature-stack mentor-dashboard">
      <header className="dashboard-heading">
        <div>
          <p className="eyebrow">Рабочий command center</p>
          <h1 id="workspace-title">
            Добро пожаловать, {mentorName.split(" ")[0]}!
          </h1>
          <p className="lead">
            Сначала просроченные проверки и участники риска, затем плановые
            ревью и встречи.
          </p>
        </div>
        <span className="date-chip">Сегодня · 29 сентября</span>
      </header>
      <MentorMetrics />
      <div className="mentor-command-grid">
        <article className="mentor-priority-card">
          <div>
            <p className="eyebrow">
              Ближайшая проверка · SLA нарушен на 2 часа
            </p>
            <Badge tone="warning">Приоритет 1</Badge>
            <h2>Гибридное ранжирование · версия 3</h2>
            <p>
              Анна Смирнова · «Рекомендательная система». Нужна проверка
              benchmark, авторства и A/B-результатов до передачи заказчику.
            </p>
            <div className="mentor-card-meta">
              <span>7 доказательств</span>
              <span>AI-черновик готов</span>
              <span>Демо через 4 дня</span>
            </div>
            <button type="button" onClick={() => void navigate("/workspace/1")}>
              Перейти к проверке →
            </button>
          </div>
          <div className="mentor-priority-visual" aria-hidden="true">
            ✓
          </div>
        </article>
        <aside className="mentor-ai-card">
          <span className="ai-orb">✦</span>
          <p className="eyebrow">AI-помощник · черновик</p>
          <h2>Сократите рутину ревью</h2>
          <p>
            Сравнит версии, найдёт пробелы в evidence и подготовит развивающую
            обратную связь. Оценку публикуете только вы.
          </p>
          <button type="button" onClick={() => void navigate("/workspace/6")}>
            Открыть AI-помощник →
          </button>
        </aside>
      </div>
      <div className="mentor-dashboard-grid">
        <section className="mentor-home-list">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Рабочая очередь</p>
              <h2>Ближайшие вклады</h2>
            </div>
            <button
              className="secondary-button"
              type="button"
              onClick={() => void navigate("/workspace/1")}
            >
              Вся очередь
            </button>
          </div>
          {reviews.map((item) => (
            <button
              type="button"
              key={item.person}
              onClick={() => void navigate("/workspace/1")}
            >
              <span className="candidate-avatar">{item.person[0]}</span>
              <div>
                <strong>{item.contribution}</strong>
                <small>
                  {item.person} · {item.project}
                </small>
              </div>
              <span>{item.due}</span>
              <Badge tone={item.tone}>{item.state}</Badge>
              <i>›</i>
            </button>
          ))}
        </section>
        <section className="mentor-home-list">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Люди</p>
              <h2>Требуют внимания</h2>
            </div>
            <button
              className="secondary-button"
              type="button"
              onClick={() => void navigate("/workspace/3")}
            >
              Все участники
            </button>
          </div>
          {participants.slice(0, 3).map((person) => (
            <button
              type="button"
              key={person.name}
              onClick={() => void navigate("/workspace/3")}
            >
              <span className="candidate-avatar">{person.name[0]}</span>
              <div>
                <strong>{person.name}</strong>
                <small>
                  {person.project} · {person.risk}
                </small>
              </div>
              <strong>{person.progress}%</strong>
              <Badge tone={person.status === "Активно" ? "success" : "warning"}>
                {person.status}
              </Badge>
              <i>›</i>
            </button>
          ))}
        </section>
      </div>
      <section className="mentor-efficiency">
        <div>
          <p className="eyebrow">Моя эффективность · 30 дней</p>
          <h2>Ревью становятся быстрее без потери качества</h2>
        </div>
        <div>
          <strong>14 ч</strong>
          <span>медиана ответа</span>
        </div>
        <div>
          <strong>71%</strong>
          <span>принято с первого раза</span>
        </div>
        <div>
          <strong>18</strong>
          <span>проверок завершено</span>
        </div>
        <button type="button" onClick={() => void navigate("/workspace/5")}>
          Открыть аналитику →
        </button>
      </section>
    </div>
  );
}

export function MentorProjects() {
  const [selected, setSelected] = useState<(typeof projects)[number]>(
    projects[0] as (typeof projects)[number],
  );
  const [filter, setFilter] = useState("");
  const visible = projects.filter((project) =>
    project.name.toLowerCase().includes(filter.toLowerCase()),
  );
  return (
    <div className="feature-stack mentor-portfolio">
      <header className="dashboard-heading">
        <div>
          <p className="eyebrow">Портфель сопровождения</p>
          <h1 id="workspace-title">Мои проекты</h1>
          <p className="lead">
            Контролируйте этапы, сроки и очередь ревью, не теряя бизнес-контекст
            заказчика.
          </p>
        </div>
        <Badge tone="success">3 активных</Badge>
      </header>
      <section className="mentor-project-kpis">
        {[
          ["Участников", "12"],
          ["Проверок на неделе", "8"],
          ["Среднее завершение", "71%"],
          ["Риск перегрузки", "Средний"],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </section>
      <div className="mentor-master-detail">
        <section className="mentor-master">
          <label className="mentor-search">
            Поиск проекта
            <input
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value);
              }}
              placeholder="Название или заказчик"
            />
          </label>
          {visible.map((project) => (
            <button
              className={selected.name === project.name ? "active" : ""}
              type="button"
              key={project.name}
              onClick={() => {
                setSelected(project);
              }}
            >
              <div>
                <strong>{project.name}</strong>
                <small>
                  {project.customer} · {project.direction}
                </small>
              </div>
              <Badge tone={project.risk === "В норме" ? "success" : "warning"}>
                {project.status}
              </Badge>
              <span>
                <i>
                  <b style={{ width: `${String(project.progress)}%` }} />
                </i>
                {project.progress}%
              </span>
              <em>{project.risk}</em>
            </button>
          ))}
        </section>
        <aside className="mentor-inspector">
          <p className="eyebrow">Проект · выбран</p>
          <h2>{selected.name}</h2>
          <Badge tone="warning">{selected.risk}</Badge>
          <p>
            Разработка проверяемого MVP с личными версиями вкладов и финальной
            защитой результата перед заказчиком.
          </p>
          <dl>
            <div>
              <dt>Заказчик</dt>
              <dd>{selected.customer}</dd>
            </div>
            <div>
              <dt>Команда</dt>
              <dd>{selected.team} участника</dd>
            </div>
            <div>
              <dt>Текущий этап</dt>
              <dd>{selected.stage}</dd>
            </div>
            <div>
              <dt>Дедлайн</dt>
              <dd>{selected.deadline}</dd>
            </div>
          </dl>
          <h3>Этапы</h3>
          <div className="mentor-stage-list">
            <span className="done">Исследование ✓</span>
            <span className="done">Прототип ✓</span>
            <strong>{selected.stage}</strong>
            <span>Защита</span>
          </div>
          <h3>Ближайшие действия</h3>
          <button
            type="button"
            onClick={() => {
              window.location.assign("/workspace/1");
            }}
          >
            Открыть 2 вклада на проверке
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              window.location.assign("/workspace/4");
            }}
          >
            Открыть чат проекта
          </button>
        </aside>
      </div>
    </div>
  );
}

export function MentorParticipants() {
  const [selected, setSelected] = useState<(typeof participants)[number]>(
    participants[0] as (typeof participants)[number],
  );
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const visible = participants.filter((person) =>
    person.name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="feature-stack mentor-people">
      <header className="dashboard-heading">
        <div>
          <p className="eyebrow">People contour</p>
          <h1 id="workspace-title">Участники</h1>
          <p className="lead">
            Следите за развитием людей, объяснимыми рисками и следующими
            coaching actions.
          </p>
        </div>
        <Badge>12 подопечных</Badge>
      </header>
      <div className="mentor-master-detail">
        <section className="mentor-master">
          <label className="mentor-search">
            Поиск участника
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
              }}
              placeholder="Имя, проект или направление"
            />
          </label>
          {visible.map((person) => (
            <button
              className={selected.name === person.name ? "active" : ""}
              type="button"
              key={person.name}
              onClick={() => {
                setSelected(person);
              }}
            >
              <span className="candidate-avatar">{person.name[0]}</span>
              <div>
                <strong>{person.name}</strong>
                <small>
                  {person.role} · {person.project}
                </small>
                <em>Активность: {person.activity}</em>
              </div>
              <strong>{person.progress}%</strong>
              <Badge tone={person.status === "Активно" ? "success" : "warning"}>
                {person.status}
              </Badge>
            </button>
          ))}
        </section>
        <aside className="mentor-inspector participant-inspector">
          <header>
            <span className="large-avatar">
              {selected.name
                .split(" ")
                .map((part) => part[0])
                .join("")}
            </span>
            <div>
              <p className="eyebrow">Подопечный участник</p>
              <h2>{selected.name}</h2>
              <span>{selected.role} · Москва</span>
            </div>
          </header>
          <div className="participant-progress">
            <span>Прогресс в проекте</span>
            <strong>{selected.progress}%</strong>
            <i>
              <b style={{ width: `${String(selected.progress)}%` }} />
            </i>
          </div>
          <dl>
            <div>
              <dt>Проект</dt>
              <dd>{selected.project}</dd>
            </div>
            <div>
              <dt>Последняя активность</dt>
              <dd>{selected.activity}</dd>
            </div>
          </dl>
          <section className="attention-card">
            <Badge
              tone={selected.risk === "Рисков нет" ? "success" : "warning"}
            >
              Требует внимания
            </Badge>
            <strong>{selected.risk}</strong>
            <p>
              Сигнал помогает выбрать действие и сам по себе не влияет на
              рейтинг участника.
            </p>
          </section>
          <h3>Пройденные курсы</h3>
          <ul className="mentor-course-list">
            {selected.courses.map((course) => (
              <li key={course}>✓ {course}</li>
            ))}
          </ul>
          <div className="mentor-inspector-actions">
            <button
              type="button"
              onClick={() => {
                void navigate("/workspace/4");
              }}
            >
              Написать участнику
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                void navigate("/workspace/1");
              }}
            >
              Открыть вклад
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                void navigate("/workspace/7");
              }}
            >
              Назначить 1:1
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

const assistantScenarios = [
  "Подготовь черновик ревью",
  "Сравни версии",
  "Чего не хватает для оценки?",
  "Сформулируй мягкую обратную связь",
];
export function MentorAssistant() {
  const [scenario, setScenario] = useState(assistantScenarios[0]);
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState(
    "Критерии результата выполнены частично. Benchmark воспроизводится, однако нет A/B-сравнения и подтверждения авторства финальной конфигурации. Рекомендую запросить два уточнения до решения.",
  );
  const [sourceNotice, setSourceNotice] = useState("");
  return (
    <div className="feature-stack mentor-assistant">
      <header className="dashboard-heading">
        <div>
          <p className="eyebrow">AI-помощник · human-in-the-loop</p>
          <h1 id="workspace-title">Разберите вклад быстрее</h1>
          <p className="lead">
            AI анализирует только выбранные источники и готовит редактируемый
            черновик. Финальная оценка остаётся за вами.
          </p>
        </div>
        <Badge tone="warning">Не принимает решений</Badge>
      </header>
      <div className="assistant-scenarios">
        {assistantScenarios.map((item) => (
          <button
            className={scenario === item ? "active" : ""}
            type="button"
            key={item}
            onClick={() => {
              setScenario(item);
            }}
          >
            <span>✦</span>
            <strong>{item}</strong>
            <small>По текущему вкладу и rubric</small>
          </button>
        ))}
      </div>
      <div className="mentor-ai-workspace">
        <section className="mentor-ai-chat">
          <div className="ai-context-line">
            <Badge>Анна Смирнова · вклад v3</Badge>
            <span>7 источников · rubric v2</span>
          </div>
          <article className="ai-answer">
            <span className="ai-orb">✦</span>
            <div>
              <p className="eyebrow">{scenario} · черновик</p>
              <textarea
                aria-label="Редактируемый AI-черновик"
                value={answer}
                onChange={(event) => {
                  setAnswer(event.target.value);
                }}
              />
              <div className="ai-citations">
                {[
                  "evaluation-report.pdf",
                  "repository/ranking",
                  "rubric v2",
                ].map((source, index) => (
                  <button
                    type="button"
                    key={source}
                    onClick={() => {
                      setSourceNotice(
                        `Источник ${String(index + 1)} открыт: ${source}`,
                      );
                    }}
                  >
                    [{index + 1}] {source}
                  </button>
                ))}
              </div>
              {sourceNotice && (
                <small className="source-notice">{sourceNotice}</small>
              )}
              <small>
                Уверенность: средняя · обновлено сейчас. Проверьте ссылки перед
                использованием.
              </small>
            </div>
          </article>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (prompt.trim()) {
                setAnswer(`${answer}\n\nУточнение ментора: ${prompt.trim()}`);
                setPrompt("");
              }
            }}
          >
            <input
              value={prompt}
              onChange={(event) => {
                setPrompt(event.target.value);
              }}
              placeholder="Уточните, что нужно проверить…"
            />
            <button type="submit">Отправить</button>
          </form>
        </section>
        <aside className="mentor-ai-context">
          <h2>Доступный контекст</h2>
          <ul>
            <li>✓ Вклад · версия 3</li>
            <li>✓ История версий 1–3</li>
            <li>✓ Rubric · версия 2</li>
            <li>✓ 7 артефактов</li>
            <li>— A/B-результаты отсутствуют</li>
          </ul>
          <h3>Границы</h3>
          <p>
            Помощник не может подтвердить оценку или
            опубликовать отзыв.
          </p>
          <button
            type="button"
            onClick={() => {
              window.location.assign("/workspace/1");
            }}
          >
            Перейти к решению ментора →
          </button>
        </aside>
      </div>
    </div>
  );
}

const weekEvents = [
  { day: 0, start: 1, span: 2, title: "Ревью · Анна", kind: "review" },
  { day: 1, start: 3, span: 1, title: "1:1 · Илья", kind: "meeting" },
  { day: 2, start: 2, span: 2, title: "Sync · заказчик", kind: "sync" },
  { day: 3, start: 4, span: 2, title: "Демо MVP", kind: "demo" },
  { day: 4, start: 1, span: 1, title: "Ревью · Мария", kind: "review" },
];

const analyticsParticipants = [
  {
    name: "Анна Смирнова",
    assigned: 5,
    accepted: 4,
    revisions: 1,
    completion: 86,
  },
  {
    name: "Алекс Речной",
    assigned: 4,
    accepted: 3,
    revisions: 1,
    completion: 78,
  },
  {
    name: "Мария Волкова",
    assigned: 4,
    accepted: 4,
    revisions: 0,
    completion: 92,
  },
  {
    name: "Илья Кузнецов",
    assigned: 3,
    accepted: 1,
    revisions: 2,
    completion: 54,
  },
];

export function MentorAnalytics() {
  const [period, setPeriod] = useState("30 дней");
  const [project, setProject] = useState("Все проекты");
  const [direction, setDirection] = useState("Все направления");
  const [detail, setDetail] = useState<string | null>(null);
  const multiplier =
    period === "7 дней" ? 0.45 : period === "90 дней" ? 1.7 : 1;
  const funnel = [
    ["Назначено", 24],
    ["Проверено", 21],
    ["Принято", 15],
    ["Доработка", 6],
  ] as const;
  return (
    <div className="feature-stack mentor-analytics">
      <header className="dashboard-heading">
        <div>
          <p className="eyebrow">
            Management contour · данные обновлены 8 минут назад
          </p>
          <h1 id="workspace-title">Качество и скорость сопровождения</h1>
          <p className="lead">
            Находите перегрузки, повторные доработки и участников, которым нужна
            поддержка. Метрики не используются для автоматических кадровых
            решений.
          </p>
        </div>
        <Badge tone="success">Актуально</Badge>
      </header>
      <div className="analytics-controls">
        <label>
          Период
          <select
            value={period}
            onChange={(event) => {
              setPeriod(event.target.value);
            }}
          >
            <option>7 дней</option>
            <option>30 дней</option>
            <option>90 дней</option>
          </select>
        </label>
        <label>
          Проект
          <select
            value={project}
            onChange={(event) => {
              setProject(event.target.value);
            }}
          >
            <option>Все проекты</option>
            {projects.map((item) => (
              <option key={item.name}>{item.name}</option>
            ))}
          </select>
        </label>
        <label>
          Направление
          <select
            value={direction}
            onChange={(event) => {
              setDirection(event.target.value);
            }}
          >
            <option>Все направления</option>
            <option>ML / Backend</option>
            <option>LLM / Data</option>
            <option>CV / Research</option>
          </select>
        </label>
        <span className="analytics-filter-summary">
          {project} · {direction}
        </span>
      </div>
      <section className="mentor-analytics-kpis">
        {[
          ["Медиана ответа", "14 ч", "цель ≤ 18 ч", "response"],
          ["Принято с первого раза", "71%", "15 из 21", "acceptance"],
          ["Доля доработок", "29%", "6 из 21", "revisions"],
          ["Очередь / просрочено", "8 / 2", "25% backlog", "backlog"],
          ["Баланс нагрузки", "82%", "3 проекта · 12 участников", "capacity"],
          ["Завершили участие", "9", "из 12 активных", "completion"],
        ].map(([label, value, note, key]) => (
          <button
            type="button"
            key={key}
            onClick={() => {
              setDetail(label ?? null);
            }}
          >
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{note}</small>
            <i>Подробнее →</i>
          </button>
        ))}
      </section>
      <div className="mentor-analytics-grid">
        <section className="analytics-panel">
          <div className="section-heading">
            <h2>Воронка вкладов</h2>
            <Badge>{period}</Badge>
          </div>
          <div className="mentor-funnel">
            {funnel.map(([label, base], index) => {
              const value = Math.round(base * multiplier);
              return (
                <button
                  type="button"
                  style={{ width: `${String(100 - index * 12)}%` }}
                  key={label}
                  onClick={() => {
                    setDetail(label);
                  }}
                >
                  <span>{label}</span>
                  <strong>{value}</strong>
                  <small>
                    {index === 0
                      ? "100%"
                      : `${String(Math.round((value / Math.max(1, Math.round(funnel[0][1] * multiplier))) * 100))}%`}
                  </small>
                </button>
              );
            })}
          </div>
        </section>
        <section className="analytics-panel">
          <div className="section-heading">
            <h2>Динамика за период</h2>
            <div className="chart-legend">
              <span>Назначено</span>
              <span>Проверено</span>
              <span>Принято</span>
            </div>
          </div>
          <div className="mentor-trend-chart">
            {[8, 12, 10, 15, 13, 18, 16, 21].map((value, index) => (
              <div key={index}>
                <i style={{ height: `${String(value * 3)}px` }} />
                <i style={{ height: `${String((value - 2) * 3)}px` }} />
                <i style={{ height: `${String((value - 5) * 3)}px` }} />
                <small>Н{index + 1}</small>
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="mentor-analytics-grid">
        <section className="analytics-panel">
          <h2>Распределение по направлениям</h2>
          <div className="direction-bars">
            {[
              ["ML / Backend", 44],
              ["LLM / Data", 31],
              ["CV / Research", 25],
            ].map(([label, value]) => (
              <button
                type="button"
                key={label}
                onClick={() => {
                  setDirection(String(label));
                }}
              >
                <span>{label}</span>
                <i>
                  <b style={{ width: `${String(value)}%` }} />
                </i>
                <strong>{value}%</strong>
              </button>
            ))}
          </div>
        </section>
        <section className="analytics-panel">
          <h2>Время ответа по дням</h2>
          <div className="response-days">
            {[
              ["Пн", 11],
              ["Вт", 14],
              ["Ср", 19],
              ["Чт", 13],
              ["Пт", 17],
              ["Сб", 8],
              ["Вс", 6],
            ].map(([day, hours]) => (
              <div key={day}>
                <strong>{hours} ч</strong>
                <i style={{ height: `${String(Number(hours) * 5)}px` }} />
                <span>{day}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="mentor-effectiveness-table">
        <div className="section-heading">
          <div>
            <p className="eyebrow">People diagnostics</p>
            <h2>Эффективность участников</h2>
          </div>
          <Badge>Не рейтинг людей</Badge>
        </div>
        <div className="effectiveness-head">
          <span>Участник</span>
          <span>Вкладов</span>
          <span>Принято</span>
          <span>Доработок</span>
          <span>Завершение</span>
        </div>
        {analyticsParticipants.map((person) => (
          <button
            type="button"
            key={person.name}
            onClick={() => {
              setDetail(person.name);
            }}
          >
            <strong>{person.name}</strong>
            <span>{person.assigned}</span>
            <span>{person.accepted}</span>
            <span>{person.revisions}</span>
            <span>
              <i>
                <b style={{ width: `${String(person.completion)}%` }} />
              </i>
              {person.completion}%
            </span>
          </button>
        ))}
      </section>
      <div className="mentor-analytics-grid">
        <section className="analytics-panel">
          <h2>Нагрузка по проектам</h2>
          {projects.map((item) => (
            <button
              className="project-load-row"
              type="button"
              key={item.name}
              onClick={() => {
                setProject(item.name);
              }}
            >
              <div>
                <strong>{item.name}</strong>
                <small>
                  {item.team} участников · {item.risk}
                </small>
              </div>
              <span>
                {item.name === "Рекомендательная система"
                  ? "86%"
                  : item.name === "Ассистент базы знаний"
                    ? "64%"
                    : "72%"}
              </span>
            </button>
          ))}
        </section>
        <section className="analytics-ai-insight">
          <span className="ai-orb">✦</span>
          <div>
            <p className="eyebrow">AI insight · рекомендация</p>
            <h2>Повторные доработки растут по критерию «Эксперимент»</h2>
            <p>
              4 из 6 доработок связаны с отсутствием baseline или A/B-сравнения.
              Добавьте общий checklist до отправки вклада.
            </p>
            <button
              type="button"
              onClick={() => {
                setDetail("AI-рекомендация");
              }}
            >
              Посмотреть основания →
            </button>
          </div>
        </section>
      </div>
      {detail && (
        <div className="overlay">
          <section className="overlay-panel overlay-panel--dialog">
            <header>
              <div>
                <p className="eyebrow">Drill-down · {period}</p>
                <h2>{detail}</h2>
              </div>
              <button
                type="button"
                aria-label="Закрыть"
                onClick={() => {
                  setDetail(null);
                }}
              >
                ×
              </button>
            </header>
            <p>
              Проекты: {project}. Направления: {direction}. Значение рассчитано
              по назначенным вам объектам; период, числитель и знаменатель
              сохранены в аналитическом событии.
            </p>
            <dl className="analytics-detail-dl">
              <div>
                <dt>Когорта</dt>
                <dd>12 назначенных участников</dd>
              </div>
              <div>
                <dt>Источник</dt>
                <dd>review decisions + assignments</dd>
              </div>
              <div>
                <dt>Свежесть</dt>
                <dd>29 сентября, 16:28</dd>
              </div>
            </dl>
            <button
              type="button"
              onClick={() => {
                setDetail(null);
              }}
            >
              Понятно
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

export function MentorWeekPlan() {
  const [view, setView] = useState("Неделя");
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [created, setCreated] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const hours = useMemo(
    () => ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00"],
    [],
  );
  return (
    <div className="feature-stack mentor-plan">
      <header className="dashboard-heading">
        <div>
          <p className="eyebrow">Календарь и приоритеты</p>
          <h1 id="workspace-title">План недели</h1>
          <p className="lead">
            Ревью, встречи и риски собраны в одной временной модели.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setMeetingOpen(true);
          }}
        >
          ＋ Назначить встречу
        </button>
      </header>
      <div className="plan-toolbar">
        <div className="view-toggle">
          {["День", "Неделя", "Месяц"].map((item) => (
            <button
              className={view === item ? "active" : ""}
              type="button"
              key={item}
              onClick={() => {
                setView(item);
              }}
            >
              {item}
            </button>
          ))}
        </div>
        <strong>{view}: 28 сентября — 4 октября · Europe/Moscow</strong>
        <button
          className="secondary-button"
          type="button"
          onClick={() => {
            setView("День");
          }}
        >
          Сегодня
        </button>
      </div>
      <div className="mentor-plan-layout">
        <section className="week-calendar">
          <header>
            <span />
            <strong>Пн 28</strong>
            <strong>Вт 29</strong>
            <strong>Ср 30</strong>
            <strong>Чт 1</strong>
            <strong>Пт 2</strong>
          </header>
          <div className="calendar-grid">
            {hours.map((hour) => (
              <span className="calendar-hour" key={hour}>
                {hour}
              </span>
            ))}
            {Array.from({ length: 30 }, (_, index) => (
              <i className="calendar-cell" key={index} />
            ))}
            {weekEvents.map((event) => (
              <button
                className={`calendar-event calendar-event--${event.kind}`}
                style={{
                  gridColumn: event.day + 2,
                  gridRow: `${String(event.start + 2)} / span ${String(event.span)}`,
                }}
                type="button"
                key={event.title}
                onClick={() => {
                  setSelectedEvent(event.title);
                }}
              >
                {event.title}
                <small>Открыть контекст</small>
              </button>
            ))}
          </div>
        </section>
        <aside className="plan-rail">
          <Card title="Сегодня">
            <p>
              <strong>10:00</strong> Ревью Анны Смирновой
            </p>
            <p>
              <strong>13:30</strong> 1:1 с Ильёй
            </p>
            <p>
              <strong>16:00</strong> Подготовить demo checklist
            </p>
          </Card>
          <Card title="Приоритеты недели">
            <ol>
              <li>Закрыть 8 ревью</li>
              <li>Подготовить команду к демо</li>
              <li>Согласовать rubric с заказчиком</li>
            </ol>
          </Card>
          <Card title="Участники риска">
            <p>
              <Badge tone="warning">Илья</Badge> Нет активности 3 дня
            </p>
            <p>
              <Badge tone="warning">Анна</Badge> Просрочено ревью
            </p>
          </Card>
        </aside>
      </div>
      {selectedEvent && (
        <div className="overlay">
          <section className="overlay-panel overlay-panel--dialog">
            <header>
              <div>
                <p className="eyebrow">Контекст события</p>
                <h2>{selectedEvent}</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedEvent(null);
                }}
              >
                ×
              </button>
            </header>
            <p>
              Проект «Рекомендательная система» · участники уведомлены ·
              материалы прикреплены.
            </p>
            <div className="context-actions">
              <button
                type="button"
                onClick={() => {
                  window.location.assign("/workspace/1");
                }}
              >
                Открыть связанное ревью
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setSelectedEvent(null);
                }}
              >
                Закрыть
              </button>
            </div>
          </section>
        </div>
      )}
      {meetingOpen && (
        <div className="overlay">
          <section className="overlay-panel overlay-panel--dialog">
            <header>
              <h2>Назначить 1:1</h2>
              <button
                type="button"
                onClick={() => {
                  setMeetingOpen(false);
                }}
              >
                ×
              </button>
            </header>
            {created ? (
              <div className="success-banner">
                <span>✓</span>
                <div>
                  <strong>Встреча создана</strong>
                  <small>Алекс получил уведомление · 30 сентября, 15:00</small>
                </div>
              </div>
            ) : (
              <form
                className="meeting-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  setCreated(true);
                }}
              >
                <label>
                  Участник
                  <select>
                    <option>Алекс Речной</option>
                    <option>Анна Смирнова</option>
                  </select>
                </label>
                <label>
                  Дата и время
                  <input
                    type="datetime-local"
                    defaultValue="2026-09-30T15:00"
                  />
                </label>
                <label>
                  Тема
                  <input defaultValue="Разбор следующего checkpoint" />
                </label>
                <p className="notice">Конфликтов в календаре не найдено.</p>
                <button type="submit">Создать и уведомить</button>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
