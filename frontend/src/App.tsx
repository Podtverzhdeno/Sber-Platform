import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { PassportNextResultCard } from "./features/next-result";
import { ParticipantHomeV2 } from "./features/participant-home-v2/page";
import { TaskCatalogV2 } from "./features/task-catalog-v2/page";
import { ParticipantMetricSpark } from "./features/participant-home-spark";
import { BuddySuggestionCard } from "./features/buddy-suggestion";
import { ActivityPanel } from "./features/activity-panel";
import { MonthlyGoalCard } from "./features/monthly-goal-card";
import { KpiDetailsBody } from "./features/kpi-details";
import { TopbarEngagementIndicator } from "./features/engagement";
import {
  KPI_KEYS,
  KPI_TITLES,
  buildKpiValues,
  useKpiDataSources,
  type KpiKey,
} from "./features/kpi-data";
import { DayAgendaBody } from "./features/day-agenda";
import { todayISO } from "./features/agenda-data";
import {
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  BrowserRouter,
  Navigate,
  NavLink,
  Route,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";

import { apiRequest } from "./api/client";
import {
  applyTheme,
  storedThemeChoice,
  subscribeSystemTheme,
  type ThemeChoice,
} from "./app/theme";
import { createQueryClient } from "./app/query";
import { StatePanel } from "./components/ui";
import { Bootcamp, DevelopmentJourney, ProjectVerificationPage, PublicVerificationPage } from "./features/development";
import { BootcampCatalog } from "./features/bootcamp";
import { ParticipantEventCatalog } from "./features/participant-events";
import { CustomerWorkspace } from "./features/customer";
import { CustomerScenario } from "./features/customer-scenario";
import { CustomerPremium } from "./features/customer-premium";
import { CustomerCandidates } from "./features/customer-candidates";
import { ManagerWorkspace } from "./features/manager";
import { HrWorkspace } from "./features/hr";
import { OperatorWorkspace } from "./features/operator";
import { ManagerVisualPage, OperatorVisualPage } from "./features/visual-gap-pages";
import { ParticipantAnalytics, RoleAnalytics } from "./features/analytics";
import { ParticipantPortfolio, ParticipantRating } from "./features/portfolio";
import { MentorReviewWorkspace } from "./features/reward";
import { CustomerParticipantPreview, ParticipantTasks } from "./features/work";
import { MessagingWorkspace } from "./features/collaboration";
import { TrajectoryMapPage } from "./features/trajectory-map/trajectory-map";
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
type PublicConfig = { honor_board_enabled?: boolean; demo_mode?: boolean; task_catalog_v2_enabled?: boolean };

type SearchItem = { kind: string; meta: string; ref: string; title: string };
type SearchResults = { items: SearchItem[] };
type NotificationItem = {
  id: string;
  kind: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
  entity_type: string | null;
  entity_id: string | null;
};
type NotificationList = { items: NotificationItem[]; unread: number };
const customerSections = ["Главная", "Мои задачи", "Создать задачу", "Заявки", "Аналитика", "AI-помощник", "База участников", "Сообщения", "Настройки"];

const searchKindLabels: Record<string, string> = {
  task: "Задача",
  course: "Курс",
  event: "Событие",
  person: "Участник",
  message: "Сообщение",
  document: "Документ",
};
const taskStatusLabels: Record<string, string> = {
  draft: "черновик",
  submitted: "на проверке",
  awaiting_support: "на согласовании",
  ready_to_publish: "готова к публикации",
  published: "опубликована",
};
const courseAvailabilityLabels: Record<string, string> = {
  available: "доступна",
  unavailable: "недоступна",
};
const personaRoleLabels: Record<string, string> = {
  participant: "участник",
  mentor: "ментор",
  customer: "заказчик",
  manager: "руководитель",
  hr: "HR",
  operator: "оператор",
};
const documentStatusLabels: Record<string, string> = {
  valid: "действует",
  revoked: "отозван",
  superseded: "заменён",
};
const searchSections: Record<string, string[]> = {
  task: ["Задачи", "Мои задачи", "Мои проекты"],
  course: ["Bootcamp", "Мой путь", "Моя траектория"],
  event: ["События"],
  person: ["Сообщения"],
  message: ["Сообщения"],
  document: ["Достижения"],
};
const notificationSections: Record<string, string[]> = {
  message: ["Сообщения"],
  application: ["Заявки", "Мои задачи", "Задачи"],
  review: ["Очередь ревью", "Проверка вкладов", "Мои проекты"],
  checkpoint: ["Мои проекты"],
  certificate: ["Портфолио"],
  system: ["Главная", "Мой путь"],
};
const notificationStyles: Record<
  string,
  { symbol: string; className: string }
> = {
  message: { symbol: "▱", className: "notification-symbol--mentor" },
  application: { symbol: "◧", className: "notification-symbol--success" },
  review: { symbol: "✓", className: "notification-symbol--success" },
  checkpoint: { symbol: "✓", className: "notification-symbol--success" },
  certificate: { symbol: "◇", className: "notification-symbol--document" },
  system: { symbol: "◎", className: "notification-symbol--document" },
};

function formatRelativeTime(raw: string): string {
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  const minutes = Math.round((Date.now() - date.getTime()) / 60_000);
  if (minutes < 1) return "только что";
  if (minutes < 60) return `${String(minutes)} мин назад`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${String(hours)} ч назад`;
  const days = Math.round(hours / 24);
  if (days === 1) return "вчера";
  if (days < 7) return `${String(days)} дн назад`;
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}


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
  "База участников": "♙",
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

const participantMetricSeries = [
  [31, 39, 48, 54, 61, 68],
  [3, 2, 3, 2, 3, 2],
  [2, 3, 3, 5, 6, 7],
  [8, 10, 11, 12, 13, 14],
];

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
  const visiblePersonas = personas.filter((persona, index) => {
    const role = persona.roles[0];
    return role !== undefined && personas.findIndex((item) => item.roles[0] === role) === index;
  });
  const hasPrimaryDemoRoles = visiblePersonas.some((persona) => persona.roles[0] === "participant" || persona.roles[0] === "customer");
  return (
    <section className="login-layout" aria-labelledby="login-title">
      <div className="login-copy">
        <p className="eyebrow">Путь от интереса к подтверждённому опыту</p>
        <h1 id="login-title">Выберите роль, чтобы присоединиться</h1>
        <p className="lead">
          Выберите демо-персону. У каждой роли свой рабочий контекст и только
          разрешённая навигация. Все имена и проекты вымышлены.
        </p>
      </div>
      <div className="persona-panel" aria-live="polite">
        <h2>Демо-персоны</h2>
        {loading && <StatePanel kind="loading" />}
        <div className="persona-grid">
          {visiblePersonas.map((persona) => {
            const role = persona.roles[0];
            const enabled = !hasPrimaryDemoRoles || role === "participant" || role === "customer";
            return <button
              className={`persona-card ${enabled ? "persona-card--active" : "persona-card--inactive"}`}
              data-persona={persona.key}
              key={persona.key}
              disabled={!enabled}
              onClick={() => {
                onLogin(persona.key);
              }}
            >
              <span>{persona.display_name}</span>
              <small>
                {role ? roleLabels[role] : "Роль не назначена"}
              </small>
              {!enabled && <em>Недоступно в демо</em>}
            </button>;
          })}
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
  taskCatalogV2Enabled,
  mockCustomer,
  onSwitchRole,
}: {
  actor: Actor;
  honorBoardEnabled: boolean;
  taskCatalogV2Enabled: boolean;
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
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
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
          currentSection === "Создать задачу" ? <CustomerScenario section={currentSection} /> : currentSection === "Сообщения" ? <MessagingWorkspace role="customer" personId={actor.person_id} /> : currentSection === "Настройки" ? <ParticipantSettings actorName="Роман Воронов" consentScopes={actor.consent_scopes} role="customer" /> : <CustomerPremium section={currentSection ?? "Главная"} onCreate={() => { window.location.assign("/workspace/2"); }} />
        ) : allowed && currentSection === "Главная" ? (
          actor.active_role === "participant" ? (
            <ParticipantDashboard actor={actor} />
          ) : actor.active_role === "mentor" ? (
            <MentorDashboard mentorName={actor.display_name} />
          ) : actor.active_role === "manager" ? (
            <ManagerVisualPage section="Главная" />
          ) : actor.active_role === "operator" ? (
            <OperatorVisualPage section="Главная" />
          ) : (
            <RoleDashboard actor={actor} currentSection="Главная" />
          )
        ) : allowed &&
          actor.active_role === "participant" &&
          (currentSection === "Мой путь" ||
            currentSection === "Моя траектория") ? (
          <>
            <DevelopmentJourney />
            <TrajectoryMapPage />
          </>
        ) : allowed &&
          actor.active_role === "participant" &&
          currentSection === "Bootcamp" ? (
          searchParams.get("course") === null ? (
            <BootcampCatalog
              honorBoardEnabled={honorBoardEnabled}
              honorBoardConsent={actor.consent_scopes.includes("course_honor_board")}
            />
          ) : (
            <Bootcamp
              honorBoardEnabled={honorBoardEnabled}
              honorBoardConsent={actor.consent_scopes.includes(
                "course_honor_board",
              )}
            />
          )
        ) : allowed &&
          actor.active_role === "participant" &&
          currentSection === "События" ? (
          <ParticipantEventCatalog />
        ) : allowed &&
          actor.active_role === "participant" &&
          currentSection === "Задачи" ? (
          taskCatalogV2Enabled ? (
            <TaskCatalogV2
              onOpenWorkspace={(assignmentId) => {
                const projectIndex = navigation.indexOf("Мои проекты");
                if (projectIndex >= 0) {
                  void navigate(`/workspace/${String(projectIndex)}?project=${encodeURIComponent(assignmentId)}`);
                }
              }}
            />
          ) : (
            <ParticipantTasks view="catalog" />
          )
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
          <ParticipantAnalytics navigation={actor.navigation} />
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
          currentSection === "База участников" ? (
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
          <ManagerWorkspace section={currentSection} />
        ) : allowed && actor.active_role === "manager" ? (
          <ManagerVisualPage section={currentSection ?? "Главная"} />
        ) : allowed &&
          actor.active_role === "hr" &&
          (currentSection === "Кандидаты" || currentSection === "Воронка") ? (
          <HrWorkspace pipelineOnly={currentSection === "Воронка"} />
        ) : allowed &&
          actor.active_role === "operator" &&
          (currentSection === "Операционная очередь" ||
            currentSection === "Проверки" ||
            currentSection === "Споры") ? (
          <OperatorWorkspace section={currentSection} />
        ) : allowed &&
          actor.active_role === "operator" &&
          currentSection === "Аналитика" ? (
          <RoleAnalytics role="operator" />
        ) : allowed && actor.active_role === "operator" ? (
          <OperatorVisualPage section={currentSection ?? "Главная"} />
        ) : allowed &&
          actor.active_role !== "participant" &&
          currentSection === "Аналитика" ? (
          <RoleAnalytics role={actor.active_role} />
        ) : allowed && currentSection === "Сообщения" ? (
          <MessagingWorkspace
            role={actor.active_role}
            personId={actor.person_id}
            quickTargets={
              actor.active_role === "mentor"
                ? {
                    review: navigation.findIndex(
                      (name) => name === "Очередь ревью" || name === "Проверка вкладов",
                    ),
                    plan: navigation.indexOf("План недели"),
                  }
                : undefined
            }
          />
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [projectOpen, setProjectOpen] = useState(false);
  const goTo = (label: string, query = "") => {
    const index = actor.navigation.indexOf(label);
    if (index >= 0) void navigate(`/workspace/${String(index)}${query}`);
  };
  const kpiParam = searchParams.get("kpi");
  const kpi: KpiKey | null =
    kpiParam !== null && KPI_KEYS.includes(kpiParam as KpiKey) ? (kpiParam as KpiKey) : null;
  const agendaDateParam = searchParams.get("date");
  const evidenceRef = searchParams.get("evidence");
  const openKpi = (key: KpiKey) => {
    const next = new URLSearchParams(searchParams);
    next.set("kpi", key);
    setSearchParams(next);
  };
  const closeKpi = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("kpi");
    next.delete("evidence");
    setSearchParams(next);
  };
  const openAgenda = () => {
    const next = new URLSearchParams(searchParams);
    next.set("date", todayDate);
    setSearchParams(next);
  };
  const changeAgendaDate = (nextDate: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (nextDate === null) next.delete("date");
    else next.set("date", nextDate);
    setSearchParams(next);
  };
  const closeAgenda = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("date");
    setSearchParams(next);
  };
  const agendaOpen = searchParams.has("date");
  const todayDate = todayISO();
  const proposedAgendaDate =
    agendaDateParam !== null && /^\d{4}-\d{2}-\d{2}$/.test(agendaDateParam) ? agendaDateParam : null;
  const sources = useKpiDataSources(true);
  const kpiValues = buildKpiValues(sources);
  const metrics = dashboardMetrics.participant;
  const agendaDate = proposedAgendaDate ?? todayDate;
  const verifiedState =
    sources.anchors.isError || sources.certificates.isError
      ? ("error" as const)
      : sources.anchors.status === "success" && sources.certificates.status === "success"
        ? ("success" as const)
        : ("pending" as const);
  return (
    <div className="dashboard-shell participant-home" data-reference="R-PAR-01">
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
        <button
          type="button"
          className="date-chip date-chip--button"
          onClick={openAgenda}
          aria-haspopup="dialog"
        >
          Сегодня
        </button>
        {searchParams.get("v2") === "1" && (
          <button
            type="button"
            className="date-chip date-chip--button"
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.delete("v2");
              setSearchParams(next);
            }}
          >
            Классическая главная
          </button>
        )}
      </header>
      {searchParams.get("v2") === "1" ? (
        <ParticipantHomeV2
          onOpenTarget={(kind, key) => {
            if (kind === "course") {
              goTo("Bootcamp", `?course=${encodeURIComponent(key)}`);
            } else {
              goTo("Задачи");
            }
          }}
          onOpenWorkspace={() => {
            setProjectOpen(true);
          }}
        />
      ) : (
        <>
      <section className="metric-grid" aria-label="Ключевые показатели">
        {metrics.map((metric, metricIndex) => {
          const kpiKey = KPI_KEYS[metricIndex] ?? "streak";
          const drill = kpiValues[kpiKey];
          const value = drill?.value ?? "…";
          const delta = drill?.delta ?? "загрузка";
          const card = (
            <>
              <span className="metric-icon" aria-hidden="true">
                ◇
              </span>
              <span>{metric.label}</span>
              <strong data-testid={`kpi-card-${kpiKey}`}>{value}</strong>
              <small>{delta}</small>
              <ParticipantMetricSpark
                kpiKey={kpiKey}
                series={participantMetricSeries[metricIndex] ?? []}
                testId={`kpi-spark-${String(metricIndex)}`}
              />
            </>
          );
          return kpiKey === "streak" ? (
            <article className={`metric-card metric-card--${metric.tone}`} key={metric.label}>
              {card}
            </article>
          ) : (
            <button
              type="button"
              key={metric.label}
              className={`metric-card metric-card--${metric.tone} metric-card--drill`}
              onClick={() => {
                openKpi(kpiKey);
              }}
              aria-haspopup="dialog"
            >
              {card}
            </button>
          );
        })}
      </section>
      <div className="dashboard-columns">
        <article className="focus-panel">
          <PassportNextResultCard
            onOpenWorkspace={() => {
              setProjectOpen(true);
            }}
            onOpenTarget={(kind, key) => {
              if (kind === "course") {
                goTo("Bootcamp", `?course=${encodeURIComponent(key)}`);
              } else {
                goTo("Задачи");
              }
            }}
          />
        </article>
        <aside className="ai-panel">
          <BuddySuggestionCard
            onOpenWorkspace={() => {
              goTo("Bootcamp", "?course=python-base");
            }}
          />
        </aside>
      </div>
      <MonthlyGoalCard />
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
        <ActivityPanel
          onOpenAnalytics={() => {
            goTo("Аналитика");
          }}
        />
      </div>
      </>
      )}
      {kpi !== null && (
        <div className="overlay" role="presentation">
          <section
            className="overlay-panel overlay-panel--dialog kpi-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={KPI_TITLES[kpi]}
            data-testid="kpi-dialog"
          >
            <header>
              <h2>{KPI_TITLES[kpi]}</h2>
              <button
                type="button"
                aria-label="Закрыть"
                onClick={closeKpi}
                data-testid="kpi-close"
              >
                ×
              </button>
            </header>
            <KpiDetailsBody
              kpi={kpi}
              progressState={sources.growth.status}
              progress={sources.growth.data}
              projectsState={sources.work.status}
              projects={sources.work.data}
              verifiedState={verifiedState}
              anchors={sources.anchors.data}
              certificates={sources.certificates.data}
              evidenceRef={evidenceRef}
              onOpenProject={(assignmentId) => {
                goTo("Мои проекты", `?project=${assignmentId}`);
              }}
            />
          </section>
        </div>
      )}
      {agendaOpen && (
        <div className="overlay" role="presentation">
          <section
            className="overlay-panel overlay-panel--dialog agenda-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Агенда дня"
            data-testid="agenda-dialog"
          >
            <header>
              <h2>Агенда дня</h2>
              <button
                type="button"
                aria-label="Закрыть"
                onClick={closeAgenda}
                data-testid="agenda-dialog-close"
              >
                ×
              </button>
            </header>
            <DayAgendaBody
              state={sources.growth.status}
              snapshot={sources.growth.data}
              work={sources.work.data}
              selectedDate={agendaDate}
              onDateChange={changeAgendaDate}
              onClose={closeAgenda}
            />
          </section>
        </div>
      )}
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
                  <dt>Формат участия</dt><dd>Проектная практика</dd>
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
  const navigate = useNavigate();
  const goTo = (label: string) => {
    const index = actor.navigation.indexOf(label);
    if (index >= 0) void navigate(`/workspace/${String(index)}`);
  };
  const fallbackTarget =
    actor.navigation.find((item) => item !== "Главная") ?? "Главная";
  const focusTarget =
    actor.active_role === "customer" && actor.navigation.includes("Мои задачи")
      ? "Мои задачи"
      : fallbackTarget;
  const queueTarget = actor.navigation.includes("Аналитика")
    ? "Аналитика"
    : focusTarget;
  const aiTarget =
    actor.navigation.find((item) => item.includes("AI")) ?? queueTarget;
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
            <button
              type="button"
              onClick={() => {
                goTo(focusTarget);
              }}
            >
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
            AI не публикует решения, оценки или офферы.
          </div>
          <button
            type="button"
            onClick={() => {
              goTo(aiTarget);
            }}
          >
            Получить рекомендации →
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
                goTo(queueTarget);
              }}
            >
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
  const [rankingOpen, setRankingOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [themeChoice, setThemeChoice] = useState<ThemeChoice>(() =>
    storedThemeChoice(),
  );
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() =>
    document.documentElement.dataset.theme === "light" ? "light" : "dark",
  );

  useEffect(() => {
    setResolvedTheme(applyTheme(themeChoice));
  }, [themeChoice]);

  useEffect(() => {
    const subscription = subscribeSystemTheme((next) => {
      if (storedThemeChoice() !== "system") return;
      setResolvedTheme(next);
    });
    return () => {
      subscription();
    };
  }, []);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key && event.key !== "impulse-theme") return;
      setThemeChoice(storedThemeChoice());
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  function toggleTheme() {
    const next: ThemeChoice = resolvedTheme === "dark" ? "light" : "dark";
    setThemeChoice(next);
    setResolvedTheme(applyTheme(next));
    if (actor?.active_role === "participant") {
      void apiRequest("/api/v1/me/theme", {
        method: "PUT",
        headers: {
          "X-CSRF-Token": sessionStorage.getItem("impulse_csrf") ?? "",
        },
        body: JSON.stringify({ theme: next }),
      }).catch(() => undefined);
    }
  }

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

  const deferredSearch = useDeferredValue(search);
  const trimmedSearch = deferredSearch.trim();
  const searchQuery = useQuery({
    queryKey: ["search", trimmedSearch],
    queryFn: () =>
      apiRequest<SearchResults>(
        `/api/v1/search?q=${encodeURIComponent(trimmedSearch)}&limit=8`,
      ),
    enabled: Boolean(actor) && trimmedSearch.length > 1,
  });
  const searchItems = searchQuery.data?.items ?? [];
  const notificationsQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiRequest<NotificationList>("/api/v1/me/notifications"),
    enabled: Boolean(actor),
  });
  const notificationItems = notificationsQuery.data?.items ?? [];
  const unreadCount = notificationsQuery.data?.unread ?? 0;
  const invalidateNotifications = () => {
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };
  async function readAllNotifications() {
    setError("");
    try {
      await apiRequest("/api/v1/me/notifications/read-all", {
        method: "POST",
        headers: { "X-CSRF-Token": sessionStorage.getItem("impulse_csrf") ?? "" },
      });
      invalidateNotifications();
    } catch {
      setError("Не удалось обновить уведомления.");
    }
  }
  async function openNotification(item: NotificationItem) {
    setError("");
    setNotificationOpen(false);
    if (!item.read) {
      try {
        await apiRequest(`/api/v1/me/notifications/${item.id}/read`, {
          method: "POST",
          headers: {
            "X-CSRF-Token": sessionStorage.getItem("impulse_csrf") ?? "",
          },
        });
        invalidateNotifications();
      } catch {
        setError("Не удалось обновить уведомления.");
        return;
      }
    }
    const candidates =
      notificationSections[item.kind] ?? notificationSections.system ?? [];
    const section = candidates.find((name) =>
      actor?.navigation.includes(name),
    );
    if (section) openSearchItem(section);
  }
  const firstSection = (names: string[]) =>
    names.find((name) => actor?.navigation.includes(name)) ?? "";
  const searchItemMeta = (item: SearchItem) => {
    const kindLabel = searchKindLabels[item.kind];
    const metaLabel =
      item.kind === "task"
        ? (taskStatusLabels[item.meta] ?? item.meta)
        : item.kind === "course"
          ? (courseAvailabilityLabels[item.meta] ?? item.meta)
          : item.kind === "person"
            ? item.meta
                .split(",")
                .map((role) => personaRoleLabels[role] ?? role)
                .join(", ")
            : item.kind === "document"
              ? (documentStatusLabels[item.meta] ?? item.meta)
              : item.meta;
    return kindLabel ? `${kindLabel} · ${metaLabel}` : metaLabel;
  };
  const searchItemQuery = (item: SearchItem) => {
    if (item.kind === "task") {
      return `?task=${encodeURIComponent(item.ref)}`;
    }
    if (item.kind === "person") {
      return `?participant=${encodeURIComponent(item.ref.slice("person:".length))}`;
    }
    if (item.kind === "message") {
      return `?channel=${encodeURIComponent(item.ref.slice("message:".length).split(":")[0] ?? "")}`;
    }
    return "";
  };
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
                  {searchQuery.isFetching && !searchQuery.data ? (
                    <div>
                      <strong>Ищем…</strong>
                      <span>Подбираем задачи, курсы и события</span>
                    </div>
                  ) : searchItems.length ? (
                    searchItems.map((item) => (
                      <button
                        type="button"
                        role="option"
                        key={`${item.kind}:${item.ref}`}
                        onClick={() => {
                          const section = firstSection(
                            searchSections[item.kind] ?? [],
                          );
                          if (!section) return;
                          openSearchItem(section, searchItemQuery(item));
                        }}
                      >
                        <strong>{item.title}</strong>
                        <span>{searchItemMeta(item)}</span>
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
              <div className="theme-utility">
                <button
                  type="button"
                  className="theme-toggle"
                  aria-pressed={resolvedTheme === "dark"}
                  aria-label={
                    resolvedTheme === "dark"
                      ? "Тёмная тема включена. Переключить на светлую."
                      : "Светлая тема включена. Переключить на тёмную."
                  }
                  onClick={toggleTheme}
                >
                  <span aria-hidden="true">
                    {resolvedTheme === "dark" ? "☾" : "☀"}
                  </span>
                </button>
              </div>
              {actor.active_role === "participant" && (
                <TopbarEngagementIndicator />
              )}
              {actor.active_role === "participant" && <div className="ranking-wrapper"><button className="ranking-utility" type="button" aria-label="Рейтинг: 3 место, 450 баллов" aria-expanded={rankingOpen} onClick={()=>{setRankingOpen(value=>!value);setNotificationOpen(false);setSearchOpen(false);}}><span aria-hidden="true">♜</span><strong>3 место</strong><small>450 баллов</small></button>{rankingOpen&&<div className="ranking-popover" role="dialog" aria-label="Баллы и место в рейтинге"><header><div><span>Рейтинг сезона</span><strong>3 место</strong></div><b>ТОП 5%</b></header><div className="ranking-score-grid"><article><strong>450</strong><span>постоянных баллов</span></article><article><strong>+5</strong><span>заморожено</span></article></div><div className="ranking-next"><span>До 2 места</span><strong>50 баллов</strong><i><b/></i></div><a href={`/workspace/${String(actor.navigation.indexOf("Рейтинг"))}`} onClick={event=>{event.preventDefault();setRankingOpen(false);openSearchItem("Рейтинг");}}>Открыть рейтинг →</a></div>}</div>}
              <div className="notification-utility">
                <button
                  className="notification-button"
                  type="button"
                  aria-label={`Уведомления: ${String(unreadCount)} непрочитанных`}
                  aria-expanded={notificationOpen}
                  onClick={() => {
                    setNotificationOpen((value) => !value);
                    setRankingOpen(false);
                    setSearchOpen(false);
                  }}
                >
                  ♢
                  {unreadCount > 0 && (
                    <i aria-hidden="true">{unreadCount}</i>
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
                        <strong>
                          {unreadCount > 0
                            ? `${String(unreadCount)} новых`
                            : "Все прочитаны"}
                        </strong>
                      </div>
                      <button
                        type="button"
                        disabled={unreadCount === 0 || notificationsQuery.isPending}
                        onClick={() => {
                          void readAllNotifications();
                        }}
                      >
                        Прочитать все
                      </button>
                    </header>
                    <div className="notification-list">
                      {notificationItems.length ? (
                        notificationItems.map((item) => {
                          const style =
                            notificationStyles[item.kind] ?? {
                              symbol: "◎",
                              className: "notification-symbol--document",
                            };
                          return (
                            <button
                              className={item.read ? "read" : ""}
                              key={item.id}
                              type="button"
                              onClick={() => {
                                void openNotification(item);
                              }}
                            >
                              <span
                                className={`notification-symbol ${style.className}`}
                              >
                                {style.symbol}
                              </span>
                              <div>
                                <strong>{item.title}</strong>
                                <p>{item.body}</p>
                                <small>
                                  {formatRelativeTime(item.created_at)}
                                </small>
                              </div>
                              <i>›</i>
                            </button>
                          );
                        })
                      ) : (
                        <div className="notification-empty">
                          <strong>Пока нет уведомлений</strong>
                          <span>Здесь появятся события ваших проектов</span>
                        </div>
                      )}
                    </div>
                    <footer>
                      <button
                        type="button"
                        onClick={() => {
                          setNotificationOpen(false);
                          const section = firstSection(["Сообщения"]);
                          if (section) openSearchItem(section);
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
          <Route
            path="/verify/:verificationId"
            element={<PublicVerificationPage />}
          />
          <Route
            path="/verify/projects/:verificationId"
            element={<ProjectVerificationPage />}
          />
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
                    taskCatalogV2Enabled={
                      configQuery.data?.task_catalog_v2_enabled === true
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
