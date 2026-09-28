import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, NavLink, Route, Routes, useParams } from "react-router-dom";

import { apiRequest } from "./api/client";
import { createQueryClient } from "./app/query";
import { StatePanel } from "./components/ui";
import { Bootcamp, DevelopmentJourney } from "./features/development";
import { EventCatalog } from "./features/ecosystem";
import { CustomerWorkspace } from "./features/customer";
import { ManagerWorkspace } from "./features/manager";
import { HrWorkspace } from "./features/hr";
import { OperatorWorkspace } from "./features/operator";
import { ParticipantAnalytics, RoleAnalytics } from "./features/analytics";
import { ParticipantPortfolio, ParticipantRating } from "./features/portfolio";
import { MentorReviewWorkspace, ParticipantRewardEvidence } from "./features/reward";
import { CustomerParticipantPreview, ParticipantTasks } from "./features/work";

type Role = "participant" | "mentor" | "customer" | "manager" | "hr" | "operator";

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
type PublicConfig = { honor_board_enabled?: boolean };

const roleLabels: Record<Role, string> = {
  participant: "Участник",
  mentor: "Ментор",
  customer: "Заказчик",
  manager: "Руководитель",
  hr: "HR",
  operator: "Оператор",
};

const navigationIcons: Record<string, string> = {
  "Главная": "⌂",
  "Мой путь": "⌂", Bootcamp: "◇", "Задачи": "▤", "События": "✦", "Рейтинг": "♜",
  "Портфолио": "◈", "Аналитика": "▥", "Очередь ревью": "✓", "Назначения": "▣", "Мои задачи": "▤",
  "Кандидаты": "♙", "Приёмка": "✓", "Инициативы": "◆", "Результаты": "◎",
  "Воронка": "▽", "Операционная очередь": "☷", "Проверки": "◉", "Споры": "⚑",
};

const dashboardMetrics: Record<Role, { label: string; value: string; delta: string; tone: string }[]> = {
  participant: [
    { label: "Прогресс маршрута", value: "68%", delta: "+12% за месяц", tone: "teal" },
    { label: "Проектов в работе", value: "2", delta: "1 требует действия", tone: "blue" },
    { label: "Подтверждено", value: "7", delta: "+2 достижения", tone: "violet" },
    { label: "Текущий стрик", value: "14", delta: "дней подряд", tone: "teal" },
  ],
  mentor: [
    { label: "В очереди", value: "8", delta: "3 новых", tone: "blue" },
    { label: "На проверке", value: "4", delta: "в срок", tone: "violet" },
    { label: "Просрочено", value: "1", delta: "нужно действие", tone: "warning" },
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
    { label: "Принято результатов", value: "18", delta: "+4 за месяц", tone: "teal" },
    { label: "Повторно использовано", value: "6", delta: "33% результатов", tone: "violet" },
    { label: "Средний цикл", value: "21 дн.", delta: "−8%", tone: "teal" },
  ],
  hr: [
    { label: "Доступно профилей", value: "346", delta: "+28%", tone: "teal" },
    { label: "Приглашено", value: "28", delta: "+6 за месяц", tone: "blue" },
    { label: "Интервью", value: "11", delta: "39% приглашений", tone: "violet" },
    { label: "Подтверждено офферов", value: "4", delta: "только human event", tone: "teal" },
  ],
  operator: [
    { label: "Новые обращения", value: "24", delta: "+5 сегодня", tone: "blue" },
    { label: "На проверке", value: "17", delta: "6 приоритетных", tone: "violet" },
    { label: "Нарушен SLA", value: "3", delta: "требует действия", tone: "warning" },
    { label: "Решено", value: "42", delta: "+18% за неделю", tone: "teal" },
  ],
};

const queryClient = createQueryClient();

function LoginScreen({ personas, loading, error, onLogin }: { personas: Persona[]; loading: boolean; error: string; onLogin: (key: string) => void }) {
  return (
    <section className="login-layout" aria-labelledby="login-title">
      <div className="login-copy">
        <p className="eyebrow">Путь от интереса к подтверждённому опыту</p>
        <h1 id="login-title">Кем вы хотите посмотреть платформу?</h1>
        <p className="lead">Выберите демо-персону. У каждой роли свой рабочий контекст и только разрешённая навигация. Все имена, проекты и выплаты вымышлены.</p>
      </div>
      <div className="persona-panel" aria-live="polite">
        <h2>Демо-персоны</h2>
        {loading && <StatePanel kind="loading" />}
        <div className="persona-grid">
          {personas.map((persona) => (
            <button className="persona-card" data-persona={persona.key} key={persona.key} onClick={() => { onLogin(persona.key); }}>
              <span>{persona.display_name}</span>
              <small>{persona.roles.map((role) => roleLabels[role]).join(" · ")}</small>
            </button>
          ))}
        </div>
        {error && <p className="error-message" role="alert">{error}</p>}
      </div>
    </section>
  );
}

function Workspace({ actor, honorBoardEnabled, onSwitchRole }: { actor: Actor; honorBoardEnabled: boolean; onSwitchRole: (role: Role) => void }) {
  const { section = "0" } = useParams();
  const sectionIndex = Number(section);
  const allowed = Number.isInteger(sectionIndex) && sectionIndex >= 0 && sectionIndex < actor.navigation.length;
  const currentSection = allowed ? actor.navigation[sectionIndex] : null;
  const [navigationOpen, setNavigationOpen] = useState(false);
  return (
    <section className={`workspace${navigationOpen ? " workspace--nav-open" : ""}`} aria-labelledby="workspace-title">
      <aside className="sidebar" aria-label="Боковая панель">
        <div className="sidebar-brand"><span className="brand-mark" aria-hidden="true">ϟ</span><strong>Impulse</strong><button className="sidebar-close" type="button" aria-label="Закрыть меню" onClick={() => { setNavigationOpen(false); }}>×</button></div>
        {actor.assigned_roles.length > 1 && (
          <label className="role-switcher">Рабочая роль<select aria-label="Рабочая роль" value={actor.active_role} onChange={(event) => { onSwitchRole(event.target.value as Role); }}>
            {actor.assigned_roles.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
          </select></label>
        )}
        <nav aria-label="Навигация роли">
          {actor.navigation.map((item, index) => <NavLink to={`/workspace/${String(index)}`} key={item} onClick={() => { setNavigationOpen(false); }}><span className="nav-icon" aria-hidden="true">{navigationIcons[item] ?? "•"}</span><span>{item}</span></NavLink>)}
        </nav>
        <div className="sidebar-message"><span className="sidebar-art" aria-hidden="true"><i /><i /><i /></span><strong>Развиваем технологии вместе</strong><span>Реальные задачи, обучение и подтверждённый опыт</span><small>СБЕР</small></div>
      </aside>
      <div className="workspace-content">
        <button className="mobile-menu" type="button" aria-expanded={navigationOpen} onClick={() => { setNavigationOpen(true); }}><span aria-hidden="true">☰</span> Меню</button>
        {allowed && currentSection === "Главная" ? (
          <RoleDashboard actor={actor} currentSection="Главная" />
        ) : allowed && actor.active_role === "participant" && currentSection === "Мой путь" ? (
          <DevelopmentJourney />
        ) : allowed && actor.active_role === "participant" && currentSection === "Bootcamp" ? (
          <Bootcamp honorBoardEnabled={honorBoardEnabled} honorBoardConsent={actor.consent_scopes.includes("course_honor_board")} />
        ) : allowed && actor.active_role === "participant" && currentSection === "События" ? (
          <EventCatalog />
        ) : allowed && actor.active_role === "participant" && currentSection === "Задачи" ? (
          <div className="feature-stack"><ParticipantTasks /><ParticipantRewardEvidence /></div>
        ) : allowed && actor.active_role === "participant" && currentSection === "Портфолио" ? (
          <ParticipantPortfolio />
        ) : allowed && actor.active_role === "participant" && currentSection === "Рейтинг" ? (
          <ParticipantRating />
        ) : allowed && actor.active_role === "participant" && currentSection === "Аналитика" ? (
          <ParticipantAnalytics />
        ) : allowed && actor.active_role === "customer" && (currentSection === "Кандидаты" || currentSection === "Приёмка") ? (
          <CustomerParticipantPreview />
        ) : allowed && actor.active_role === "customer" && currentSection === "Мои задачи" ? (
          <CustomerWorkspace />
        ) : allowed && actor.active_role === "mentor" && currentSection === "Очередь ревью" ? (
          <MentorReviewWorkspace />
        ) : allowed && actor.active_role === "manager" && (currentSection === "Инициативы" || currentSection === "Результаты") ? (
          <ManagerWorkspace />
        ) : allowed && actor.active_role === "hr" && (currentSection === "Кандидаты" || currentSection === "Воронка") ? (
          <HrWorkspace pipelineOnly={currentSection === "Воронка"} />
        ) : allowed && actor.active_role === "operator" && (currentSection === "Операционная очередь" || currentSection === "Проверки" || currentSection === "Споры") ? (
          <OperatorWorkspace />
        ) : allowed && actor.active_role !== "participant" && currentSection === "Аналитика" ? (
          <RoleAnalytics role={actor.active_role} />
        ) : allowed ? (
          <RoleDashboard actor={actor} currentSection={currentSection ?? "Главная"} />
        ) : (
          <StatePanel kind="restricted" action="Вернуться в рабочее пространство" onAction={() => { window.location.assign("/workspace/0"); }} />
        )}
      </div>
    </section>
  );
}

function RoleDashboard({ actor, currentSection }: { actor: Actor; currentSection: string }) {
  return <div className="dashboard-shell">
    <header className="dashboard-heading"><div><p className="eyebrow">{roleLabels[actor.active_role]} · рабочее пространство</p><h1 id="workspace-title">Добро пожаловать, {actor.display_name.split(" ")[0]}!</h1><p className="lead">Все важные действия, результаты и показатели собраны в одном рабочем пространстве.</p></div><span className="date-chip">▣ Сегодня</span></header>
    <section className="metric-grid" aria-label="Ключевые показатели">{dashboardMetrics[actor.active_role].map((metric) => <article className={`metric-card metric-card--${metric.tone}`} key={metric.label}><span className="metric-icon" aria-hidden="true">◇</span><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.delta}</small><i aria-hidden="true" /></article>)}</section>
    <div className="dashboard-columns"><article className="focus-panel"><div><p className="eyebrow">Следующее важное действие</p><span className="ui-badge ui-badge--info">{currentSection}</span><h2>Продолжите работу с ближайшим результатом</h2><p>Откройте раздел, проверьте факты и зафиксируйте следующий шаг. Все записи в текущем окружении являются демонстрационными.</p><button type="button">Открыть рабочую область <span aria-hidden="true">→</span></button></div><div className="focus-visual" aria-hidden="true"><span /><span /><span /></div></article>
      <aside className="ai-panel"><div><span className="ai-orb" aria-hidden="true">✦</span><div><h2>AI-помощник</h2><span className="ui-badge ui-badge--ai">Бета</span></div></div><p>Поможет структурировать следующий шаг и объяснит данные. Рекомендация остаётся черновиком до решения человека.</p><div className="ai-boundary">AI не публикует решения, оценки, выплаты или офферы.</div><button type="button">Получить рекомендации →</button></aside>
    </div>
    <div className="dashboard-lower-grid"><section className="activity-panel"><header><div><p className="eyebrow">Рабочая очередь</p><h2>Актуальные действия</h2></div><button className="secondary-button" type="button">Все действия →</button></header><div className="activity-row"><span className="activity-symbol">▤</span><div><strong>Проверьте ближайший этап</strong><small>Обновлено сегодня · демо-данные</small></div><span className="ui-badge ui-badge--info">В работе</span><strong>Сегодня</strong><span aria-hidden="true">›</span></div><div className="activity-row"><span className="activity-symbol">✓</span><div><strong>Подтверждённый результат</strong><small>История решения и доказательства доступны</small></div><span className="ui-badge ui-badge--success">Принято</span><strong>Вчера</strong><span aria-hidden="true">›</span></div><div className="activity-row"><span className="activity-symbol">◎</span><div><strong>Запланируйте следующий шаг</strong><small>Рекомендация сформирована по вашему контексту</small></div><span className="ui-badge ui-badge--ai">AI</span><strong>Завтра</strong><span aria-hidden="true">›</span></div></section><aside className="insight-panel"><header><h2>Ключевая аналитика</h2><span>30 дней</span></header><div className="insight-metric"><span>До результата</span><strong>18 дней</strong><small>↓ 22%</small></div><div className="insight-metric"><span>Завершено в срок</span><strong>78%</strong><small>↑ 12%</small></div><div className="mini-bars" aria-label="Динамика за четыре недели"><i /><i /><i /><i /><i /><i /></div></aside></div>
  </div>;
}

function ImpulseApp() {
  const configQuery = useQuery({ queryKey: ["public-config"], queryFn: () => apiRequest<PublicConfig>("/api/v1/config") });
  const personasQuery = useQuery({ queryKey: ["demo-personas"], queryFn: () => apiRequest<Persona[]>("/api/v1/auth/personas") });
  const meQuery = useQuery({ queryKey: ["me"], queryFn: () => apiRequest<Actor>("/api/v1/me") });
  const [actor, setActor] = useState<Actor | null>(null);
  const [error, setError] = useState("");

  useEffect(() => { if (meQuery.data) setActor(meQuery.data); }, [meQuery.data]);

  async function login(personaKey: string) {
    setError("");
    try {
      const nextActor = await apiRequest<Actor>("/api/v1/auth/demo-login", { method: "POST", body: JSON.stringify({ persona_key: personaKey }) });
      if (nextActor.csrf_token) sessionStorage.setItem("impulse_csrf", nextActor.csrf_token);
      setActor(nextActor);
    } catch { setError("Не удалось войти. Проверьте, что backend запущен."); }
  }

  async function switchRole(role: Role) {
    const nextActor = await apiRequest<Actor>("/api/v1/me/active-role", { method: "POST", headers: { "X-CSRF-Token": sessionStorage.getItem("impulse_csrf") ?? "" }, body: JSON.stringify({ role }) });
    setActor(nextActor);
  }

  async function logout() {
    await apiRequest<unknown>("/api/v1/auth/logout", { method: "POST", headers: { "X-CSRF-Token": sessionStorage.getItem("impulse_csrf") ?? "" } });
    sessionStorage.removeItem("impulse_csrf");
    setActor(null);
  }

  return (
    <main className="page-shell">
      <a className="skip-link" href="#workspace-main">Перейти к содержимому</a>
      <header className="topbar">{actor ? <><div className="global-search"><span aria-hidden="true">⌕</span><label className="sr-only" htmlFor="global-search">Глобальный поиск</label><input id="global-search" type="search" placeholder="Поиск по задачам, участникам, результатам…" /></div><div className="header-actions"><span className="demo-badge">Демо-режим · синтетические данные</span><button className="notification-button" type="button" aria-label="Уведомления">♢<i aria-hidden="true" /></button><div className="top-persona"><span className="mini-avatar" aria-hidden="true">{actor.display_name.slice(0, 1)}</span><span><strong>{actor.display_name}</strong><small>{roleLabels[actor.active_role]}</small></span></div><button className="ghost-button" onClick={() => { void logout(); }}>Выйти</button></div></> : <><a className="brand" href="/" aria-label="Impulse — на главную"><span className="brand-mark" aria-hidden="true">ϟ</span><span>Impulse</span></a><span className="demo-badge">Демо-режим · синтетические данные</span></>}</header>
      <div id="workspace-main">
      <Routes>
        {!actor ? (
          <Route path="*" element={<LoginScreen personas={personasQuery.data ?? []} loading={personasQuery.isLoading} error={error} onLogin={(key) => { void login(key); }} />} />
        ) : (
          <>
            <Route path="/" element={<Navigate replace to="/workspace/0" />} />
            <Route path="/workspace/:section" element={<Workspace actor={actor} honorBoardEnabled={configQuery.data?.honor_board_enabled === true} onSwitchRole={(role) => { void switchRole(role); }} />} />
            <Route path="*" element={<StatePanel kind="restricted" action="На главную" onAction={() => { window.location.assign("/workspace/0"); }} />} />
          </>
        )}
      </Routes>
      </div>
    </main>
  );
}

export function App() {
  return <QueryClientProvider client={queryClient}><BrowserRouter><ImpulseApp /></BrowserRouter></QueryClientProvider>;
}
