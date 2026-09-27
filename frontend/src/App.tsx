import { useEffect, useState } from "react";

type Role = "participant" | "mentor" | "customer" | "manager" | "hr" | "operator";

type Persona = {
  key: string;
  display_name: string;
  roles: Role[];
};

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

const roleLabels: Record<Role, string> = {
  participant: "Участник",
  mentor: "Ментор",
  customer: "Заказчик",
  manager: "Руководитель",
  hr: "HR",
  operator: "Оператор",
};

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  headers.set("Content-Type", "application/json");
  const response = await fetch(path, {
    credentials: "include",
    ...options,
    headers,
  });
  if (!response.ok) {
    throw new Error(`API ${String(response.status)}`);
  }
  return (await response.json()) as T;
}

export function App() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [actor, setActor] = useState<Actor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void Promise.allSettled([api<Persona[]>("/api/v1/auth/personas"), api<Actor>("/api/v1/me")])
      .then(([personaResult, actorResult]) => {
        if (personaResult.status === "fulfilled") {
          setPersonas(personaResult.value);
        }
        if (actorResult.status === "fulfilled") {
          setActor(actorResult.value);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  async function login(personaKey: string) {
    setError("");
    try {
      const nextActor = await api<Actor>("/api/v1/auth/demo-login", {
        method: "POST",
        body: JSON.stringify({ persona_key: personaKey }),
      });
      if (nextActor.csrf_token) sessionStorage.setItem("impulse_csrf", nextActor.csrf_token);
      setActor(nextActor);
    } catch {
      setError("Не удалось войти. Проверьте, что backend запущен.");
    }
  }

  async function switchRole(role: Role) {
    const csrf = sessionStorage.getItem("impulse_csrf") ?? "";
    const nextActor = await api<Actor>("/api/v1/me/active-role", {
      method: "POST",
      headers: { "X-CSRF-Token": csrf },
      body: JSON.stringify({ role }),
    });
    setActor(nextActor);
  }

  async function logout() {
    const csrf = sessionStorage.getItem("impulse_csrf") ?? "";
    await fetch("/api/v1/auth/logout", {
      method: "POST",
      credentials: "include",
      headers: { "X-CSRF-Token": csrf },
    });
    sessionStorage.removeItem("impulse_csrf");
    setActor(null);
  }

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Impulse — на главную">
          <span className="brand-mark" aria-hidden="true">I</span>
          <span>Impulse</span>
        </a>
        <div className="header-actions">
          <span className="demo-badge">Демо-режим · синтетические данные</span>
          {actor && <button className="ghost-button" onClick={() => { void logout(); }}>Выйти</button>}
        </div>
      </header>

      {!actor ? (
        <section className="login-layout" aria-labelledby="login-title">
          <div className="login-copy">
            <p className="eyebrow">Путь от интереса к подтверждённому опыту</p>
            <h1 id="login-title">Кем вы хотите посмотреть платформу?</h1>
            <p className="lead">
              Выберите демо-персону. У каждой роли свой рабочий контекст и только разрешённая
              навигация. Все имена, проекты и выплаты вымышлены.
            </p>
          </div>
          <div className="persona-panel" aria-live="polite">
            <h2>Демо-персоны</h2>
            {loading && <p>Загружаем роли…</p>}
            <div className="persona-grid">
              {personas.map((persona) => (
                <button
                  className="persona-card"
                  data-persona={persona.key}
                  key={persona.key}
                  onClick={() => { void login(persona.key); }}
                >
                  <span>{persona.display_name}</span>
                  <small>{persona.roles.map((role) => roleLabels[role]).join(" · ")}</small>
                </button>
              ))}
            </div>
            {error && <p className="error-message" role="alert">{error}</p>}
          </div>
        </section>
      ) : (
        <section className="workspace" aria-labelledby="workspace-title">
          <aside className="sidebar">
            <div className="profile-card">
              <span className="avatar" aria-hidden="true">{actor.display_name.slice(0, 1)}</span>
              <div>
                <strong>{actor.display_name}</strong>
                <span>{roleLabels[actor.active_role]}</span>
              </div>
            </div>
            {actor.assigned_roles.length > 1 && (
              <label className="role-switcher">
                Рабочая роль
                <select
                  aria-label="Рабочая роль"
                  value={actor.active_role}
                  onChange={(event) => { void switchRole(event.target.value as Role); }}
                >
                  {actor.assigned_roles.map((role) => (
                    <option key={role} value={role}>{roleLabels[role]}</option>
                  ))}
                </select>
              </label>
            )}
            <nav aria-label="Навигация роли">
              {actor.navigation.map((item, index) => (
                <a className={index === 0 ? "active" : ""} href={`#${String(index)}`} key={item}>{item}</a>
              ))}
            </nav>
          </aside>
          <div className="workspace-content">
            <p className="eyebrow">{roleLabels[actor.active_role]} · рабочее пространство</p>
            <h1 id="workspace-title">Здравствуйте, {actor.display_name}</h1>
            <p className="lead">
              Здесь появятся ваши актуальные действия, понятная цель каждого шага и аналитика
              продвижения к реальному результату.
            </p>
            <article className="next-action">
              <span>Следующее действие</span>
              <h2>{actor.navigation[0]}</h2>
              <p>Демо-данные позволяют пройти сценарий без риска изменить реальные записи.</p>
            </article>
          </div>
        </section>
      )}
    </main>
  );
}
