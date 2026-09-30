import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  BrowserRouter,
  Navigate,
  NavLink,
  Route,
  Routes,
  useNavigate,
  useParams,
} from "react-router-dom";

import { apiRequest } from "./api/client";
import { createQueryClient } from "./app/query";
import { Badge, StatePanel } from "./components/ui";
import { Bootcamp, DevelopmentJourney } from "./features/development";
import { EventCatalog } from "./features/ecosystem";
import { CustomerWorkspace } from "./features/customer";
import { CustomerScenario } from "./features/customer-scenario";
import { CustomerPremium } from "./features/customer-premium";
import { CustomerCandidates } from "./features/customer-candidates";
import { ManagerWorkspace } from "./features/manager";
import { HrWorkspace } from "./features/hr";
import { OperatorWorkspace } from "./features/operator";
import { ParticipantAnalytics, RoleAnalytics } from "./features/analytics";
import { ParticipantPortfolio, ParticipantRating } from "./features/portfolio";
import { MentorReviewWorkspace } from "./features/reward";
import { CustomerParticipantPreview, ParticipantTasks } from "./features/work";
import { MessagingWorkspace } from "./features/collaboration";
import {
  ParticipantAchievements,
  ParticipantBuddy,
  ParticipantSettings,
} from "./features/participant";
import {
  MentorAnalytics,
  MentorAssistant,
  MentorDashboard,
  MentorParticipants,
  MentorProjects,
  MentorWeekPlan,
} from "./features/mentor";

type Role =
  "participant" | "mentor" | "customer" | "manager" | "hr" | "operator";

type Persona = { key: string; display_name: string; roles: Role[] };
type Actor = {
  person_id: string;
  display_name: string;
  active_role: Role;
  assigned_roles: Role[];
  scopes: string[];
  consent_scopes: string[];
  navigation: string[];
  csrf_token?: string | null;
};
type PublicConfig = { honor_board_enabled?: boolean; demo_mode?: boolean };
const customerSections = ["Главная", "Мои задачи", "Создать задачу", "Заявки", "Приёмка", "Аналитика", "AI-помощник", "Кандидаты", "Сообщения"];

const roleLabels: Record<Role, string> = {
  participant: "Участник",
  mentor: "Ментор",
  customer: "Заказчик",
  manager: "Руководитель",
  hr: "HR",
  operator: "Оператор",
};

const navigationIcons: Record<string, string> = {
  Главная: "⌂",
  "Мой путь": "⌂",
  "Моя траектория": "⌁",
  Bootcamp: "◇",
  Задачи: "▤",
  "Мои проекты": "▣",
  События: "✦",
  Рейтинг: "♜",
  Портфолио: "◈",
  Аналитика: "▥",
  "Очередь ревью": "✓",
  "Проверка вкладов": "✓",
  Назначения: "▣",
  Участники: "♙",
  "AI-помощник": "✧",
  "План недели": "▦",
  "Мои задачи": "▤",
  "Создать задачу": "+",
  Заявки: "◧",
  Кандидаты: "♙",
  Приёмка: "✓",
  Инициативы: "◆",
  Результаты: "◎",
  Воронка: "▽",
  "Операционная очередь": "☷",
  Проверки: "◉",
  Споры: "⚑",
  Сообщения: "▱",
  Достижения: "◆",
  "AI-Buddy": "✧",
  Настройки: "⚙",
};

const dashboardMetrics: Record<
  Role,
  { label: string; value: string; delta: string; tone: string }[]
> = {
  participant: [
    {
      label: "Прогресс маршрута",
      value: "68%",
      delta: "+12% за месяц",
      tone: "teal",
    },
    {
      label: "Проектов в работе",
      value: "2",
      delta: "1 требует действия",
      tone: "blue",
    },
    {
      label: "Подтверждено",
      value: "7",
      delta: "+2 достижения",
      tone: "violet",
    },
    { label: "Текущий стрик", value: "14", delta: "дней подряд", tone: "teal" },
  ],
  mentor: [
    { label: "В очереди", value: "8", delta: "3 новых", tone: "blue" },
    { label: "На проверке", value: "4", delta: "в срок", tone: "violet" },
    {
      label: "Просрочено",
      value: "1",
      delta: "нужно действие",
      tone: "warning",
    },
    { label: "Среднее ревью", value: "1,8 дн.", delta: "−14%", tone: "teal" },
  ],
  customer: [
    { label: "Опубликовано", value: "12", delta: "+3 за месяц", tone: "teal" },
    { label: "В работе", value: "7", delta: "+2 за месяц", tone: "blue" },
    { label: "На проверке", value: "4", delta: "+1 за месяц", tone: "violet" },
    { label: "Принято", value: "5", delta: "+2 за месяц", tone: "teal" },
  ],
  manager: [
    { label: "Инициативы", value: "9", delta: "6 активных", tone: "blue" },
    {
      label: "Принято результатов",
      value: "18",
      delta: "+4 за месяц",
      tone: "teal",
    },
    {
      label: "Повторно использовано",
      value: "6",
      delta: "33% результатов",
      tone: "violet",
    },
    { label: "Средний цикл", value: "21 дн.", delta: "−8%", tone: "teal" },
  ],
  hr: [
    { label: "Доступно профилей", value: "346", delta: "+28%", tone: "teal" },
    { label: "Приглашено", value: "28", delta: "+6 за месяц", tone: "blue" },
    {
      label: "Интервью",
      value: "11",
      delta: "39% приглашений",
      tone: "violet",
    },
    {
      label: "Подтверждено офферов",
      value: "4",
      delta: "только human event",
      tone: "teal",
    },
  ],
  operator: [
    {
      label: "Новые обращения",
      value: "24",
      delta: "+5 сегодня",
      tone: "blue",
    },
    {
      label: "На проверке",
      value: "17",
      delta: "6 приоритетных",
      tone: "violet",
    },
    {
      label: "Нарушен SLA",
      value: "3",
      delta: "требует действия",
      tone: "warning",
    },
    { label: "Решено", value: "42", delta: "+18% за неделю", tone: "teal" },
  ],
};

const queryClient = createQueryClient();

function LoginScreen({
  personas,
  loading,
  error,
  onLogin,
}: {
  personas: Persona[];
  loading: boolean;
  error: string;
  onLogin: (key: string) => void;
}) {
  return (
    <section className="login-layout" aria-labelledby="login-title">
      <div className="login-copy">
        <p className="eyebrow">Путь от интереса к подтверждённому опыту</p>
        <h1 id="login-title">Выберите роль, чтобы присоединиться</h1>
        <p className="lead">
          Выберите демо-персону. У каждой роли свой рабочий контекст и только
          разрешённая навигация. Все имена, проекты и выплаты вымышлены.
        </p>
      </div>
      <div className="persona-panel" aria-live="polite">
        <h2>Демо-персоны</h2>
        {loading && <StatePanel kind="loading" />}
        <div className="persona-grid">
          {personas.map((persona) => (
            <button
              className="persona-card"
              data-persona={persona.key}
              key={persona.key}
              onClick={() => {
                onLogin(persona.key);
              }}
            >
              <span>{persona.display_name}</span>
              <small>
                {persona.roles.map((role) => roleLabels[role]).join(" · ")}
              </small>
            </button>
          ))}
        </div>
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

function Workspace({
  actor,
  honorBoardEnabled,
  mockCustomer,
  onSwitchRole,
}: {
  actor: Actor;
  honorBoardEnabled: boolean;
  mockCustomer: boolean;
  onSwitchRole: (role: Role) => void;
}) {
  const { section = "0" } = useParams();
  const sectionIndex = Number(section);
  const navigation = actor.active_role === "customer" && mockCustomer ? customerSections : actor.navigation;
  const allowed =
    Number.isInteger(sectionIndex) &&
    sectionIndex >= 0 &&
    sectionIndex < navigation.length;
  const currentSection = allowed ? navigation[sectionIndex] : null;
  const [navigationOpen, setNavigationOpen] = useState(false);
  return (
    <section
      className={`workspace${navigationOpen ? " workspace--nav-open" : ""}`}
      aria-labelledby="workspace-title"
    >
      <aside className="sidebar" aria-label="Боковая панель">
        <div className="sidebar-brand">
          <span className="brand-mark" aria-hidden="true">
            ϟ
          </span>
          <strong>Impulse</strong>
          <button
            className="sidebar-close"
            type="button"
            aria-label="Закрыть меню"
            onClick={() => {
              setNavigationOpen(false);
            }}
          >
            ×
          </button>
        </div>
        {actor.assigned_roles.length > 1 && (
          <label className="role-switcher">
            Рабочая роль
            <select
              aria-label="Рабочая роль"
              value={actor.active_role}
              onChange={(event) => {
                onSwitchRole(event.target.value as Role);
              }}
            >
              {actor.assigned_roles.map((role) => (
                <option key={role} value={role}>
                  {roleLabels[role]}
                </option>
              ))}
            </select>
          </label>
        )}
        <nav aria-label="Навигация роли">
          {navigation.map((item, index) => (
            <NavLink
              to={`/workspace/${String(index)}`}
              key={item}
              onClick={() => {
                setNavigationOpen(false);
              }}
            >
              <span className="nav-icon" aria-hidden="true">
                {navigationIcons[item] ?? "•"}
              </span>
              <span>{item}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-message">
          <span className="sidebar-art" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <strong>Развиваем технологии вместе</strong>
          <span>Реальные задачи, обучение и подтверждённый опыт</span>
          <small>СБЕР</small>
        </div>
      </aside>
      <div className="workspace-content">
        <button
          className="mobile-menu"
          type="button"
          aria-expanded={navigationOpen}
          onClick={() => {
            setNavigationOpen(true);
          }}
        >
          <span aria-hidden="true">☰</span> Меню
        </button>
        {allowed && actor.active_role === "customer" && mockCustomer ? (
          currentSection === "Создать задачу" ? <CustomerScenario section={currentSection} /> : <CustomerPremium section={currentSection ?? "Главная"} onCreate={() => { window.location.assign("/workspace/2"); }} />
        ) : allowed && currentSection === "Главная" ? (
          actor.active_role === "participant" ? (
            <ParticipantDashboard actor={actor} />
          ) : actor.active_role === "mentor" ? (
            <MentorDashboard mentorName={actor.display_name} />
          ) : (
            <RoleDashboard actor={actor} currentSection="Главная" />
          )
        ) : allowed &&
          actor.active_role === "participant" &&
          (currentSection === "Мой путь" ||
            currentSection === "Моя траектория") ? (
          <DevelopmentJourney />
        ) : allowed &&
          actor.active_role === "participant" &&
          currentSection === "Bootcamp" ? (
          <Bootcamp
            honorBoardEnabled={honorBoardEnabled}
            honorBoardConsent={actor.consent_scopes.includes(
              "course_honor_board",
            )}
          />
        ) : allowed &&
          actor.active_role === "participant" &&
          currentSection === "События" ? (
          <EventCatalog />
        ) : allowed &&
          actor.active_role === "participant" &&
          currentSection === "Задачи" ? (
          <ParticipantTasks view="catalog" />
        ) : allowed &&
          actor.active_role === "participant" &&
          currentSection === "Мои проекты" ? (
          <ParticipantTasks view="projects" />
        ) : allowed &&
          actor.active_role === "participant" &&
          currentSection === "Портфолио" ? (
          <ParticipantPortfolio />
        ) : allowed &&
          actor.active_role === "participant" &&
          currentSection === "Рейтинг" ? (
          <ParticipantRating />
        ) : allowed &&
          actor.active_role === "participant" &&
          currentSection === "Аналитика" ? (
          <ParticipantAnalytics />
        ) : allowed &&
          actor.active_role === "participant" &&
          currentSection === "Достижения" ? (
          <ParticipantAchievements />
        ) : allowed &&
          actor.active_role === "participant" &&
          currentSection === "AI-Buddy" ? (
          <ParticipantBuddy />
        ) : allowed &&
          actor.active_role === "participant" &&
          currentSection === "Настройки" ? (
          <ParticipantSettings actorName={actor.display_name} consentScopes={actor.consent_scopes} />
        ) : allowed &&
          actor.active_role === "customer" &&
          currentSection === "Кандидаты" ? (
          <CustomerCandidates />
        ) : allowed &&
          actor.active_role === "customer" &&
          currentSection === "Приёмка" ? (
          <CustomerParticipantPreview />
        ) : allowed &&
          actor.active_role === "customer" &&
          currentSection === "Мои задачи" ? (
          <CustomerWorkspace />
        ) : allowed &&
          actor.active_role === "mentor" &&
          (currentSection === "Очередь ревью" ||
            currentSection === "Проверка вкладов") ? (
          <MentorReviewWorkspace />
        ) : allowed &&
          actor.active_role === "mentor" &&
          currentSection === "Мои проекты" ? (
          <MentorProjects />
        ) : allowed &&
          actor.active_role === "mentor" &&
          currentSection === "Участники" ? (
          <MentorParticipants />
        ) : allowed &&
          actor.active_role === "mentor" &&
          currentSection === "AI-помощник" ? (
          <MentorAssistant />
        ) : allowed &&
          actor.active_role === "mentor" &&
          currentSection === "План недели" ? (
          <MentorWeekPlan />
        ) : allowed &&
          actor.active_role === "mentor" &&
          currentSection === "Аналитика" ? (
          <MentorAnalytics />
        ) : allowed &&
          actor.active_role === "manager" &&
          (currentSection === "Инициативы" ||
            currentSection === "Результаты") ? (
          <ManagerWorkspace />
        ) : allowed &&
          actor.active_role === "hr" &&
          (currentSection === "Кандидаты" || currentSection === "Воронка") ? (
          <HrWorkspace pipelineOnly={currentSection === "Воронка"} />
        ) : allowed &&
          actor.active_role === "operator" &&
          (currentSection === "Операционная очередь" ||
            currentSection === "Проверки" ||
            currentSection === "Споры") ? (
          <OperatorWorkspace />
        ) : allowed &&
          actor.active_role !== "participant" &&
          currentSection === "Аналитика" ? (
          <RoleAnalytics role={actor.active_role} />
        ) : allowed && currentSection === "Сообщения" ? (
          <MessagingWorkspace role={actor.active_role} />
        ) : allowed ? (
          <RoleDashboard
            actor={actor}
            currentSection={currentSection ?? "Главная"}
          />
        ) : (
          <StatePanel
            kind="restricted"
            action="Вернуться в рабочее пространство"
            onAction={() => {
              window.location.assign("/workspace/0");
            }}
          />
        )}
      </div>
    </section>
  );
}

function ParticipantDashboard({ actor }: { actor: Actor }) {
  const navigate = useNavigate();
  const [projectOpen, setProjectOpen] = useState(false);
  const [buddyOpen, setBuddyOpen] = useState(false);
  const goTo = (label: string, query = "") => {
    const index = actor.navigation.indexOf(label);
    if (index >= 0) void navigate(`/workspace/${String(index)}${query}`);
  };
  const metrics = dashboardMetrics.participant;
  return (
    <div className="dashboard-shell participant-home">
      <header className="dashboard-heading">
        <div>
          <p className="eyebrow">Участник · персональный маршрут</p>
          <h1 id="workspace-title">
            Добро пожаловать, {actor.display_name.split(" ")[0]}!
          </h1>
          <p className="lead">
            Следующий шаг связан с реальным результатом: курс готовит к проекту,
            проект подтверждает опыт, а проверенный опыт усиливает резюме.
          </p>
        </div>
        <span className="date-chip">Сегодня · 28 сентября</span>
      </header>
      <section className="metric-grid" aria-label="Ключевые показатели">
        {metrics.map((metric, metricIndex) => (
          <article
            className={`metric-card metric-card--${metric.tone}`}
            key={metric.label}
          >
            <span className="metric-icon" aria-hidden="true">
              ◇
            </span>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.delta}</small>
            <div
              className="metric-histogram"
              role="img"
              aria-label={`Гистограмма «${metric.label}» за шесть недель`}
            >
              {[34, 52, 43, 68, 59, 82].map((value, index) => (
                <i
                  key={index}
                  style={{ height: `${String(value - metricIndex * 3)}%` }}
                />
              ))}
            </div>
          </article>
        ))}
      </section>
      <div className="dashboard-columns">
        <article className="focus-panel">
          <div>
            <p className="eyebrow">Следующий результат</p>
            <span className="ui-badge ui-badge--info">MVP · 70%</span>
            <h2>Прототип рекомендательной системы</h2>
            <p>
              Подключите API научных источников, измерьте качество выдачи и
              загрузите воспроизводимый отчёт до 12 октября.
            </p>
            <button
              type="button"
              onClick={() => {
                setProjectOpen(true);
              }}
            >
              Открыть рабочую область →
            </button>
          </div>
          <div className="focus-visual" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </article>
        <aside className="ai-panel">
          <div>
            <span className="ai-orb" aria-hidden="true">
              ✦
            </span>
            <div>
              <h2>AI Buddy</h2>
              <span className="ui-badge ui-badge--ai">Бета</span>
            </div>
          </div>
          <p>
            Подсказывает полезный следующий шаг на основе курса, проекта и
            подтверждённых результатов.
          </p>
          <div className="ai-boundary">
            Рекомендация — черновик. Решения об оценке и выплате принимает
            человек.
          </div>
          <button
            type="button"
            onClick={() => {
              setBuddyOpen(true);
            }}
          >
            Получить рекомендацию →
          </button>
        </aside>
      </div>
      <div className="dashboard-lower-grid">
        <section className="activity-panel">
          <header>
            <div>
              <p className="eyebrow">Рабочая очередь</p>
              <h2>Актуальные действия</h2>
            </div>
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                goTo("Задачи");
              }}
            >
              Все действия →
            </button>
          </header>
          <button
            className="activity-row"
            type="button"
            onClick={() => {
              setProjectOpen(true);
            }}
          >
            <span className="activity-symbol">▤</span>
            <div>
              <strong>Завершить интеграцию API</strong>
              <small>Проект · дедлайн 12 октября · прогресс 70%</small>
            </div>
            <span className="ui-badge ui-badge--info">В работе</span>
            <strong>Сегодня</strong>
            <span>›</span>
          </button>
          <button
            className="activity-row"
            type="button"
            onClick={() => {
              goTo("Bootcamp", "?course=python-base");
            }}
          >
            <span className="activity-symbol">✓</span>
            <div>
              <strong>Практика в рабочем окружении</strong>
              <small>Курс Python · +20 постоянных баллов после проверки</small>
            </div>
            <span className="ui-badge ui-badge--ai">Checkpoint</span>
            <strong>45 мин</strong>
            <span>›</span>
          </button>
          <button
            className="activity-row"
            type="button"
            onClick={() => {
              goTo("События");
            }}
          >
            <span className="activity-symbol">✦</span>
            <div>
              <strong>AI Journey 2026</strong>
              <small>Регистрация открыта · +5 замороженных баллов</small>
            </div>
            <span className="ui-badge ui-badge--warning">Событие</span>
            <strong>3 дня</strong>
            <span>›</span>
          </button>
        </section>
        <aside className="insight-panel">
          <header>
            <h2>Активность</h2>
            <span>6 недель</span>
          </header>
          <div
            className="home-histogram"
            role="img"
            aria-label="Учебная и проектная активность по неделям"
          >
            {[42, 64, 55, 78, 69, 91].map((value, index) => (
              <i key={index} style={{ height: `${String(value)}%` }}>
                <span>Н{index + 1}</span>
              </i>
            ))}
          </div>
          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              goTo("Аналитика");
            }}
          >
            Открыть аналитику →
          </button>
        </aside>
      </div>
      {projectOpen && (
        <div className="overlay" role="presentation">
          <section
            className="overlay-panel overlay-panel--dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Рабочая область проекта"
          >
            <header>
              <h2>Прототип рекомендательной системы</h2>
              <button
                type="button"
                aria-label="Закрыть"
                onClick={() => {
                  setProjectOpen(false);
                }}
              >
                ×
              </button>
            </header>
            <div className="mock-project">
              <div className="project-stage-strip">
                <strong>Исследование ✓</strong>
                <strong>Прототип · 70%</strong>
                <span>Проверка</span>
                <span>Приёмка</span>
              </div>
              <p>
                Подключите Semantic Scholar API, сравните baseline и гибридное
                ранжирование, приложите отчёт и видео демонстрации.
              </p>
              <dl>
                <div>
                  <dt>Команда</dt>
                  <dd>Алекс · Анна · ментор Елена</dd>
                </div>
                <div>
                  <dt>Дедлайн</dt>
                  <dd>12 октября 2026</dd>
                </div>
                <div>
                  <dt>Вознаграждение</dt>
                  <dd>База 50 000 ₽ · A 125 000 ₽</dd>
                </div>
              </dl>
              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => {
                    setProjectOpen(false);
                    goTo("Мои проекты");
                  }}
                >
                  Перейти к проекту
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    setProjectOpen(false);
                  }}
                >
                  Закрыть
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
      {buddyOpen && (
        <div className="overlay" role="presentation">
          <section
            className="overlay-panel overlay-panel--drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Рекомендация AI Buddy"
          >
            <header>
              <h2>Рекомендация AI Buddy</h2>
              <button
                type="button"
                aria-label="Закрыть"
                onClick={() => {
                  setBuddyOpen(false);
                }}
              >
                ×
              </button>
            </header>
            <div className="buddy-recommendation">
              <Badge tone="warning">Черновик AI</Badge>
              <h3>Сначала завершите checkpoint API</h3>
              <p>
                Он напрямую связан с текущим проектом, добавит доказательство
                навыка Python и откроет этап проверки MVP.
              </p>
              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => {
                    setBuddyOpen(false);
                    goTo("Bootcamp", "?course=python-base");
                  }}
                >
                  Открыть траекторию
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    setBuddyOpen(false);
                  }}
                >
                  Понятно
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function RoleDashboard({
  actor,
  currentSection,
}: {
  actor: Actor;
  currentSection: string;
}) {
  return (
    <div className="dashboard-shell">
      <header className="dashboard-heading">
        <div>
          <p className="eyebrow">
            {roleLabels[actor.active_role]} · рабочее пространство
          </p>
          <h1 id="workspace-title">
            Добро пожаловать, {actor.display_name.split(" ")[0]}!
          </h1>
          <p className="lead">
            Все важные действия, результаты и показатели собраны в одном рабочем
            пространстве.
          </p>
        </div>
        <span className="date-chip">▣ Сегодня</span>
      </header>
      <section className="metric-grid" aria-label="Ключевые показатели">
        {dashboardMetrics[actor.active_role].map((metric) => (
          <article
            className={`metric-card metric-card--${metric.tone}`}
            key={metric.label}
          >
            <span className="metric-icon" aria-hidden="true">
              ◇
            </span>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.delta}</small>
            <i aria-hidden="true" />
          </article>
        ))}
      </section>
      <div className="dashboard-columns">
        <article className="focus-panel">
          <div>
            <p className="eyebrow">Следующее важное действие</p>
            <span className="ui-badge ui-badge--info">{currentSection}</span>
            <h2>Продолжите работу с ближайшим результатом</h2>
            <p>
              Откройте раздел, проверьте факты и зафиксируйте следующий шаг. Все
              записи в текущем окружении являются демонстрационными.
            </p>
            <button type="button">
              Открыть рабочую область <span aria-hidden="true">→</span>
            </button>
          </div>
          <div className="focus-visual" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </article>
        <aside className="ai-panel">
          <div>
            <span className="ai-orb" aria-hidden="true">
              ✦
            </span>
            <div>
              <h2>AI-помощник</h2>
              <span className="ui-badge ui-badge--ai">Бета</span>
            </div>
          </div>
          <p>
            Поможет структурировать следующий шаг и объяснит данные.
            Рекомендация остаётся черновиком до решения человека.
          </p>
          <div className="ai-boundary">
            AI не публикует решения, оценки, выплаты или офферы.
          </div>
          <button type="button">Получить рекомендации →</button>
        </aside>
      </div>
      <div className="dashboard-lower-grid">
        <section className="activity-panel">
          <header>
            <div>
              <p className="eyebrow">Рабочая очередь</p>
              <h2>Актуальные действия</h2>
            </div>
            <button className="secondary-button" type="button">
              Все действия →
            </button>
          </header>
          <div className="activity-row">
            <span className="activity-symbol">▤</span>
            <div>
              <strong>Проверьте ближайший этап</strong>
              <small>Обновлено сегодня · демо-данные</small>
            </div>
            <span className="ui-badge ui-badge--info">В работе</span>
            <strong>Сегодня</strong>
            <span aria-hidden="true">›</span>
          </div>
          <div className="activity-row">
            <span className="activity-symbol">✓</span>
            <div>
              <strong>Подтверждённый результат</strong>
              <small>История решения и доказательства доступны</small>
            </div>
            <span className="ui-badge ui-badge--success">Принято</span>
            <strong>Вчера</strong>
            <span aria-hidden="true">›</span>
          </div>
          <div className="activity-row">
            <span className="activity-symbol">◎</span>
            <div>
              <strong>Запланируйте следующий шаг</strong>
              <small>Рекомендация сформирована по вашему контексту</small>
            </div>
            <span className="ui-badge ui-badge--ai">AI</span>
            <strong>Завтра</strong>
            <span aria-hidden="true">›</span>
          </div>
        </section>
        <aside className="insight-panel">
          <header>
            <h2>Ключевая аналитика</h2>
            <span>30 дней</span>
          </header>
          <div className="insight-metric">
            <span>До результата</span>
            <strong>18 дней</strong>
            <small>↓ 22%</small>
          </div>
          <div className="insight-metric">
            <span>Завершено в срок</span>
            <strong>78%</strong>
            <small>↑ 12%</small>
          </div>
          <div className="mini-bars" aria-label="Динамика за четыре недели">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
        </aside>
      </div>
    </div>
  );
}

function ImpulseApp() {
  const navigate = useNavigate();
  const configQuery = useQuery({
    queryKey: ["public-config"],
    queryFn: () => apiRequest<PublicConfig>("/api/v1/config"),
  });
  const personasQuery = useQuery({
    queryKey: ["demo-personas"],
    queryFn: () => apiRequest<Persona[]>("/api/v1/auth/personas"),
  });
  const [signedOut, setSignedOut] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const explicitSignOut = useRef(false);
  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: () => apiRequest<Actor>("/api/v1/me"),
    enabled: !signedOut,
  });
  const [actor, setActor] = useState<Actor | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [streakOpen, setStreakOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [readNotifications, setReadNotifications] = useState<string[]>([]);

  useEffect(() => {
    if (meQuery.data && !explicitSignOut.current) setActor(meQuery.data);
  }, [meQuery.data]);

  async function login(personaKey: string) {
    setError("");
    try {
      const nextActor = await apiRequest<Actor>("/api/v1/auth/demo-login", {
        method: "POST",
        body: JSON.stringify({ persona_key: personaKey }),
      });
      if (nextActor.csrf_token)
        sessionStorage.setItem("impulse_csrf", nextActor.csrf_token);
      explicitSignOut.current = false;
      setSignedOut(false);
      setActor(nextActor);
    } catch {
      setError("Не удалось войти. Проверьте, что backend запущен.");
    }
  }

  async function switchRole(role: Role) {
    const nextActor = await apiRequest<Actor>("/api/v1/me/active-role", {
      method: "POST",
      headers: { "X-CSRF-Token": sessionStorage.getItem("impulse_csrf") ?? "" },
      body: JSON.stringify({ role }),
    });
    setActor(nextActor);
  }

  async function logout() {
    if (loggingOut) return;
    const csrfToken = sessionStorage.getItem("impulse_csrf") ?? "";
    explicitSignOut.current = true;
    setSignedOut(true);
    setLoggingOut(true);
    setActor(null);
    sessionStorage.removeItem("impulse_csrf");
    await queryClient.cancelQueries({ queryKey: ["me"] });
    queryClient.removeQueries({
      predicate: (query) =>
        !["public-config", "demo-personas"].includes(String(query.queryKey[0])),
    });
    window.history.replaceState(null, "", "/");
    try {
      await apiRequest<unknown>("/api/v1/auth/logout", {
        method: "POST",
        headers: { "X-CSRF-Token": csrfToken },
      });
    } catch {
      // The local demo session is deliberately closed even when the server is
      // unavailable. A subsequent login creates a fresh server session.
    } finally {
      setLoggingOut(false);
    }
  }

  const searchItems = actor
    ? [
        {
          title: "Прототип рекомендательной системы",
          meta: "Задача · в работе",
          section: "Задачи",
          query: "",
        },
        {
          title: "Python для R&D",
          meta: "Bootcamp · текущий курс",
          section: "Bootcamp",
          query: "?course=python-base",
        },
        {
          title: "AI Journey 2026",
          meta: "Событие · регистрация",
          section: "События",
          query: "",
        },
        {
          title: "Елена Наставник",
          meta: "Сообщения · ментор",
          section: "Сообщения",
          query: "",
        },
        {
          title: "Сертификат OpenSpec",
          meta: "Документ · подтверждён",
          section: "Портфолио",
          query: "",
        },
      ].filter(
        (item) =>
          item.title.toLowerCase().includes(search.trim().toLowerCase()) ||
          item.meta.toLowerCase().includes(search.trim().toLowerCase()),
      )
    : [];
  const openSearchItem = (section: string, query = "") => {
    if (!actor) return;
    const index = actor.navigation.indexOf(section);
    if (index >= 0) {
      void navigate(`/workspace/${String(index)}${query}`);
      setSearch("");
      setSearchOpen(false);
    }
  };

  return (
    <main className="page-shell">
      <a className="skip-link" href="#workspace-main">
        Перейти к содержимому
      </a>
      <header className="topbar">
        {actor ? (
          <>
            <div className="global-search">
              <span aria-hidden="true">⌕</span>
              <label className="sr-only" htmlFor="global-search">
                Глобальный поиск
              </label>
              <input
                id="global-search"
                type="search"
                value={search}
                onFocus={() => {
                  setSearchOpen(true);
                  setStreakOpen(false);
                  setNotificationOpen(false);
                }}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setSearchOpen(true);
                }}
                placeholder="Поиск по задачам, курсам, людям и сообщениям…"
                autoComplete="off"
              />
              {searchOpen && search.trim().length > 1 && (
                <div
                  className="global-search-results"
                  role="listbox"
                  aria-label="Результаты поиска"
                >
                  {searchItems.length ? (
                    searchItems.map((item) => (
                      <button
                        type="button"
                        role="option"
                        key={item.title}
                        onClick={() => {
                          openSearchItem(item.section, item.query);
                        }}
                      >
                        <strong>{item.title}</strong>
                        <span>{item.meta}</span>
                      </button>
                    ))
                  ) : (
                    <div>
                      <strong>Ничего не найдено</strong>
                      <span>Попробуйте изменить запрос</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="header-actions">
              <div className="streak-utility">
                <button
                  className="streak-button"
                  type="button"
                  aria-label="Учебный стрик: 14 дней"
                  aria-expanded={streakOpen}
                  onClick={() => {
                    setStreakOpen((value) => !value);
                    setNotificationOpen(false);
                    setSearchOpen(false);
                  }}
                >
                  🔥 <strong>14</strong>
                </button>
                {streakOpen && (
                  <div
                    className="streak-popover"
                    role="dialog"
                    aria-label="Учебный стрик"
                  >
                    <header>
                      <span>Текущая серия</span>
                      <strong>14 дней подряд</strong>
                    </header>
                    <div className="streak-week">
                      {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map(
                        (day, index) => (
                          <span
                            className={index < 6 ? "done" : "today"}
                            key={day}
                          >
                            <i>{index < 6 ? "✓" : "·"}</i>
                            {day}
                          </span>
                        ),
                      )}
                    </div>
                    <p>
                      <strong>Сегодня:</strong> завершите checkpoint «Практика
                      API», чтобы сохранить серию.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setStreakOpen(false);
                        openSearchItem("Bootcamp", "?course=python-base");
                      }}
                    >
                      Продолжить курс →
                    </button>
                    <small>Лучшая серия: 21 день</small>
                  </div>
                )}
              </div>
              {actor.active_role === "participant" && (
                <button
                  className="ranking-utility"
                  type="button"
                  aria-label="Рейтинг: 3 место, 450 баллов"
                  onClick={() => {
                    openSearchItem("Рейтинг");
                  }}
                >
                  <span aria-hidden="true">♜</span>
                  <strong>3 место</strong>
                  <small>450 баллов</small>
                </button>
              )}
              <div className="notification-utility">
                <button
                  className="notification-button"
                  type="button"
                  aria-label={`Уведомления: ${String(3 - readNotifications.length)} непрочитанных`}
                  aria-expanded={notificationOpen}
                  onClick={() => {
                    setNotificationOpen((value) => !value);
                    setStreakOpen(false);
                  }}
                >
                  ♢
                  {readNotifications.length < 3 && (
                    <i aria-hidden="true">{3 - readNotifications.length}</i>
                  )}
                </button>
                {notificationOpen && (
                  <section
                    className="notification-popover"
                    role="dialog"
                    aria-label="Центр уведомлений"
                  >
                    <header>
                      <div>
                        <span>Уведомления</span>
                        <strong>{3 - readNotifications.length} новых</strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setReadNotifications([
                            "feedback",
                            "checkpoint",
                            "certificate",
                          ]);
                        }}
                      >
                        Прочитать все
                      </button>
                    </header>
                    <div className="notification-list">
                      <button
                        className={
                          readNotifications.includes("feedback") ? "read" : ""
                        }
                        type="button"
                        onClick={() => {
                          setReadNotifications((items) =>
                            Array.from(new Set([...items, "feedback"])),
                          );
                          setNotificationOpen(false);
                          openSearchItem("Сообщения");
                        }}
                      >
                        <span className="notification-symbol notification-symbol--mentor">
                          ЕН
                        </span>
                        <div>
                          <strong>Новый комментарий ментора</strong>
                          <p>
                            Елена попросила уточнить обработку rate limit в
                            проекте.
                          </p>
                          <small>12 минут назад</small>
                        </div>
                        <i>›</i>
                      </button>
                      <button
                        className={
                          readNotifications.includes("checkpoint") ? "read" : ""
                        }
                        type="button"
                        onClick={() => {
                          setReadNotifications((items) =>
                            Array.from(new Set([...items, "checkpoint"])),
                          );
                          setNotificationOpen(false);
                          openSearchItem("Мои проекты");
                        }}
                      >
                        <span className="notification-symbol notification-symbol--success">
                          ✓
                        </span>
                        <div>
                          <strong>Checkpoint принят</strong>
                          <p>
                            «Контракт API» подтверждён и добавлен в ваш
                            прогресс.
                          </p>
                          <small>Сегодня, 10:14</small>
                        </div>
                        <i>›</i>
                      </button>
                      <button
                        className={
                          readNotifications.includes("certificate")
                            ? "read"
                            : ""
                        }
                        type="button"
                        onClick={() => {
                          setReadNotifications((items) =>
                            Array.from(new Set([...items, "certificate"])),
                          );
                          setNotificationOpen(false);
                          openSearchItem("Портфолио");
                        }}
                      >
                        <span className="notification-symbol notification-symbol--document">
                          ◇
                        </span>
                        <div>
                          <strong>Сертификат готов</strong>
                          <p>Документ «OpenSpec и SDD» доступен в портфолио.</p>
                          <small>Вчера</small>
                        </div>
                        <i>›</i>
                      </button>
                    </div>
                    <footer>
                      <button
                        type="button"
                        onClick={() => {
                          setNotificationOpen(false);
                          openSearchItem("Сообщения");
                        }}
                      >
                        Открыть сообщения →
                      </button>
                    </footer>
                  </section>
                )}
              </div>
              <div className="top-persona">
                <span className="mini-avatar" aria-hidden="true">
                  {actor.display_name.slice(0, 1)}
                </span>
                <span>
                  <strong>{actor.display_name}</strong>
                  <small>{roleLabels[actor.active_role]}</small>
                </span>
              </div>
              <button
                className="ghost-button"
                disabled={loggingOut}
                onClick={() => {
                  void logout();
                }}
              >
                {loggingOut ? "Выходим…" : "Выйти"}
              </button>
            </div>
          </>
        ) : (
          <a className="brand" href="/" aria-label="Impulse — на главную">
            <span className="brand-mark" aria-hidden="true">
              ϟ
            </span>
            <span>Impulse</span>
          </a>
        )}
      </header>
      <div id="workspace-main">
        <Routes>
          {!actor ? (
            <Route
              path="*"
              element={
                <LoginScreen
                  personas={personasQuery.data ?? []}
                  loading={personasQuery.isLoading}
                  error={error}
                  onLogin={(key) => {
                    void login(key);
                  }}
                />
              }
            />
          ) : (
            <>
              <Route
                path="/"
                element={<Navigate replace to="/workspace/0" />}
              />
              <Route
                path="/workspace/:section"
                element={
                  <Workspace
                    actor={actor}
                    mockCustomer={configQuery.data?.demo_mode === true}
                    honorBoardEnabled={
                      configQuery.data?.honor_board_enabled === true
                    }
                    onSwitchRole={(role) => {
                      void switchRole(role);
                    }}
                  />
                }
              />
              <Route
                path="*"
                element={
                  <StatePanel
                    kind="restricted"
                    action="На главную"
                    onAction={() => {
                      window.location.assign("/workspace/0");
                    }}
                  />
                }
              />
            </>
          )}
        </Routes>
      </div>
    </main>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ImpulseApp />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
