import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, NavLink, Route, Routes, useParams } from "react-router-dom";

import { apiRequest } from "./api/client";
import { createQueryClient } from "./app/query";
import { StatePanel } from "./components/ui";
import { Bootcamp, DevelopmentJourney } from "./features/development";
import { EventCatalog } from "./features/ecosystem";
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
  return (
    <section className="workspace" aria-labelledby="workspace-title">
      <aside className="sidebar">
        <div className="profile-card"><span className="avatar" aria-hidden="true">{actor.display_name.slice(0, 1)}</span><div><strong>{actor.display_name}</strong><span>{roleLabels[actor.active_role]}</span></div></div>
        {actor.assigned_roles.length > 1 && (
          <label className="role-switcher">Рабочая роль<select aria-label="Рабочая роль" value={actor.active_role} onChange={(event) => { onSwitchRole(event.target.value as Role); }}>
            {actor.assigned_roles.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
          </select></label>
        )}
        <nav aria-label="Навигация роли">
          {actor.navigation.map((item, index) => <NavLink to={`/workspace/${String(index)}`} key={item}>{item}</NavLink>)}
        </nav>
      </aside>
      <div className="workspace-content">
        {allowed && actor.active_role === "participant" && currentSection === "Мой путь" ? (
          <DevelopmentJourney />
        ) : allowed && actor.active_role === "participant" && currentSection === "Bootcamp" ? (
          <Bootcamp honorBoardEnabled={honorBoardEnabled} honorBoardConsent={actor.consent_scopes.includes("course_honor_board")} />
        ) : allowed && actor.active_role === "participant" && currentSection === "События" ? (
          <EventCatalog />
        ) : allowed && actor.active_role === "participant" && currentSection === "Задачи" ? (
          <div className="feature-stack"><ParticipantTasks /><ParticipantRewardEvidence /></div>
        ) : allowed && actor.active_role === "customer" && (currentSection === "Кандидаты" || currentSection === "Приёмка") ? (
          <CustomerParticipantPreview />
        ) : allowed && actor.active_role === "mentor" && sectionIndex === 0 ? (
          <MentorReviewWorkspace />
        ) : allowed ? (
          <>
            <p className="eyebrow">{roleLabels[actor.active_role]} · рабочее пространство</p>
            <h1 id="workspace-title">Здравствуйте, {actor.display_name}</h1>
            <p className="lead">Здесь появятся ваши актуальные действия, понятная цель каждого шага и аналитика продвижения к реальному результату.</p>
            <article className="next-action"><span>Текущий раздел</span><h2>{currentSection}</h2><p>Демо-данные позволяют пройти сценарий без риска изменить реальные записи.</p></article>
          </>
        ) : (
          <StatePanel kind="restricted" action="Вернуться в рабочее пространство" onAction={() => { window.location.assign("/workspace/0"); }} />
        )}
      </div>
    </section>
  );
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
      <header className="topbar"><a className="brand" href="/" aria-label="Impulse — на главную"><span className="brand-mark" aria-hidden="true">I</span><span>Impulse</span></a><div className="header-actions"><span className="demo-badge">Демо-режим · синтетические данные</span>{actor && <button className="ghost-button" onClick={() => { void logout(); }}>Выйти</button>}</div></header>
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
    </main>
  );
}

export function App() {
  return <QueryClientProvider client={queryClient}><BrowserRouter><ImpulseApp /></BrowserRouter></QueryClientProvider>;
}
