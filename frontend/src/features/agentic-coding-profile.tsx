import { useState } from "react";
import "./agentic-coding-profile.scss";

/**
 * Source: openspec/changes/impulse-ecosystem/docs/analytics-agentic-coding/
 * role_targets.source_map.json (PDF §4.2–4.4, TXT §§1.9/2.9/3.9).
 * This is a read-only METHODOLOGY PREVIEW, never an evidence evaluation.
 * Do not equate these targets with an actual student certification.
 */
const AGENTIC_SKILLS = [
  { key: "prompting", label: "Постановка задач агенту" },
  { key: "prompt_engineering", label: "Правила работы агента" },
  { key: "context_management", label: "Формирование контекста" },
  { key: "tools_mcp", label: "Инструменты и MCP" },
  { key: "creating_skills", label: "Создание и применение Skills" },
  { key: "agents_team", label: "Команда агентов" },
] as const;

type Role = "developer" | "analyst" | "qa";
type ChartView = "radar" | "bars" | "table";

const AGENTIC_ROLE_PROFILES: Record<Role, {
  name: string;
  target: readonly (number | null)[];
  unresolved: readonly number[];
}> = {
  developer: { name: "Разработчик", target: [3, 4, 3, 2, 3, 2], unresolved: [4] },
  analyst: { name: "Аналитик", target: [3, null, 3, 2, 2, 2], unresolved: [1, 2] },
  qa: { name: "Тестировщик", target: [3, 2, 2, 2, 2, 2], unresolved: [1] },
};

const axes = Array.from({ length: AGENTIC_SKILLS.length }, (_, index) => -Math.PI / 2 + index * Math.PI * 2 / AGENTIC_SKILLS.length);

function polarPoint(index: number, level: number): { x: number; y: number } {
  const r = level * 33;
  const angle = axes[index] ?? (-Math.PI / 2);
  return { x: 170 + Math.cos(angle) * r, y: 170 + Math.sin(angle) * r };
}

function Radar({ target }: { target: readonly (number | null)[] }) {
  const segments: { from: number; to: number; a: number; b: number }[] = [];
  for (let index = 0; index < target.length; index++) {
    const following = (index + 1) % target.length;
    const a = target[index], b = target[following];
    if (typeof a === "number" && typeof b === "number") segments.push({ from: index, to: following, a, b });
  }
  return (
    <svg viewBox="0 0 340 340" role="img"
      aria-label="Циклограмма целевых уровней Agentic Coding. Оранжевый пунктир — цель по методологии. Зелёный текущий уровень не показан: подтверждённых цифровых следов пока нет.">
      {[1, 2, 3, 4].map((level) => (
        <polygon className="agentic-ring" key={level}
          points={axes.map((_, i) => { const p = polarPoint(i, level); return `${String(p.x)},${String(p.y)}`; }).join(" ")} />
      ))}
      {axes.map((_, index) => { const to = polarPoint(index, 4); return (
        <line className="agentic-axis" key={index} x1="170" y1="170" x2={to.x} y2={to.y} />
      ); })}
      {segments.map(({ from, to, a, b }) => {
        const start = polarPoint(from, a), end = polarPoint(to, b);
        return <line className="agentic-target-line" key={from}
          x1={start.x} y1={start.y} x2={end.x} y2={end.y} />;
      })}
      {target.map((level, index) => {
        if (typeof level !== "number") return null;
        const pt = polarPoint(index, level);
        return <circle key={index} className="agentic-target-dot" cx={pt.x} cy={pt.y} r="4" />;
      })}
      {[1, 2, 3, 4].map((level) => <text key={level} className="agentic-ring-label"
        x="174" y={170 - 33 * level + 13}>{level}</text>)}
    </svg>
  );
}

export function AgenticCodingProfile() {
  const [role, setRole] = useState<Role>("developer");
  const [view, setView] = useState<ChartView>("radar");
  const profile = AGENTIC_ROLE_PROFILES[role];
  const unresolvedCount = profile.unresolved.length;
  return (
    <section className="agentic-profile" aria-labelledby="agentic-profile-title" data-testid="agentic-profile">
      <header className="agentic-profile-heading">
        <div>
          <p className="eyebrow">Skill Passport · Agentic Coding</p>
          <h2 id="agentic-profile-title">Матрица компетенций</h2>
          <p>Целевой профиль по методологии. Фактические уровни появятся после проверки цифровых следов.</p>
        </div>
        <label className="agentic-role-picker">
          Профессиональная группа
          <select value={role} onChange={(event) => { setRole(event.target.value as Role); }}>
            <option value="developer">Разработчик</option>
            <option value="analyst">Аналитик</option>
            <option value="qa">Тестировщик</option>
          </select>
        </label>
      </header>
      <div className="agentic-profile-main">
        <section className="agentic-profile-chart" aria-label="Профиль навыков">
          <div className="agentic-chart-title">
            <h3>{profile.name} · 6 навыков</h3>
            <div role="group" aria-label="Вид диаграммы" className="agentic-chart-modes">
              <button type="button" aria-pressed={view === "radar"} onClick={() => { setView("radar"); }}>Циклограмма</button>
              <button type="button" aria-pressed={view === "bars"} onClick={() => { setView("bars"); }}>Гистограмма</button>
              <button type="button" aria-pressed={view === "table"} onClick={() => { setView("table"); }}>Таблица</button>
            </div>
          </div>
          <div className="agentic-legend" aria-label="Легенда диаграммы">
            <span className="agentic-legend-target">Цель по методологии</span>
            <span className="agentic-legend-current">Текущий уровень: нет подтверждённых данных</span>
          </div>
          {view === "radar" && <div className="agentic-radar"><Radar target={profile.target} /></div>}
          {view === "bars" && <div className="agentic-bars" aria-label="Целевые уровни по навыкам">
            {AGENTIC_SKILLS.map((skill, index) => (
              <div key={skill.key} className="agentic-bar-row">
                <span>{skill.label}</span>
                <div className="agentic-bar-track">
                  {profile.target[index] !== null && <i style={{ width: `${String((profile.target[index] ?? 0) * 25)}%` }} />}
                </div>
                <strong>{profile.target[index] === null ? "—" : `${String(profile.target[index])}/4`}</strong>
              </div>
            ))}
          </div>}
          {view === "table" && <table className="agentic-table">
            <thead><tr><th scope="col">Навык</th><th scope="col">Текущий</th><th scope="col">Цель</th></tr></thead>
            <tbody>{AGENTIC_SKILLS.map((skill, index) => <tr key={skill.key}>
              <th scope="row">{skill.label}</th><td>Нет данных</td><td>{profile.target[index] ?? "Не задана"}</td>
            </tr>)}</tbody>
          </table>}
          {view === "radar" && <div className="agentic-axis-list" aria-label="Числовые уровни, альтернатива циклограмме">
            {AGENTIC_SKILLS.map((skill, index) => <div key={skill.key}>
              <span>{skill.label}</span>
              <strong>{profile.target[index] === null ? "Не задана" : `${String(profile.target[index])}/4`}</strong>
            </div>)}
          </div>}
          <p className="agentic-methodology-note">
            Шкала: 1 — теория, 2 — средний, 3 — продвинутый, 4 — эксперт. Отсутствие данных не считается уровнем 0.
          </p>
        </section>
        <aside className="agentic-certification" aria-label="Состояние сертификации">
          <p className="eyebrow">Сертификация</p>
          <h3>Agentic Coding L1</h3>
          <strong>Учебная оценка пока не рассчитана</strong>
          <p>Для присвоения результата нужны проверенные цифровые следы, опубликованная версия правил и авторизованный источник сертификации.</p>
          {unresolvedCount > 0 && <p role="status" className="agentic-conflict">
            {unresolvedCount} {unresolvedCount === 1 ? "положение" : "положения"} методологии требуют согласования. Спорные цели не используются для автоматического решения.
          </p>}
          <div className="agentic-certification-separator" />
          <h4>Skill Passport</h4>
          <p>Статус компетенций — недостаточно данных. Целевые уровни — методологический ориентир, а не подтверждённое достижение участника.</p>
          <small>Источник: итоговая методология §4.2–4.4 и ролевая матрица §§1.9–3.9. SDD учитывается отдельно и не входит в L1.</small>
        </aside>
      </div>
    </section>
  );
}
