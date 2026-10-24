import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { apiRequest } from "../api/client";
import { Modal } from "../components/ui";
import type { AgenticServerProfile } from "./agentic-coding-profile";
import "./analytics-reference.scss";

type RoleKey = "developer" | "analyst" | "qa";
type LayoutKey = "passport" | "path" | "evidence";
type ChartKey = "radar" | "histogram" | "trend";
type EventView = { occurred_at: string; kind: string; title: string; source_kind: string; source_ref: string };
type Snapshot = {
  snapshot_id: string; generated_at: string; actor_timezone: string;
  events?: EventView[]; freshness: { known: boolean; latest_observed_at: string | null };
  trajectories: { track_key: string; track_title: string }[];
};
type Stage = { key: string; title: string; count: number; status: string };
type Journey = { stages: Stage[]; generated_at: string; successful: boolean; next_action: string };
type Skill = { key: string; title: string; target_level: number | null; current_level: number | null; evidence_count: number; data_state: string; unresolved_methodology: boolean };

const ROLES: Record<RoleKey, string> = { developer: "Разработчик", analyst: "Аналитик", qa: "Тестировщик" };
const LAYOUTS: { key: LayoutKey; name: string; heading: string; description: string; eyebrow: string }[] = [
  { key: "passport", name: "Skill Passport", heading: "Ваш Skill Passport", description: "Подтверждённые навыки, реальные доказательства и понятный путь к L1", eyebrow: "АНАЛИТИКА / SKILL PASSPORT" },
  { key: "path", name: "Мой маршрут", heading: "Маршрут к вашей следующей цели", description: "Что уже доказано, какие навыки нужно развить и какое действие принесёт результат", eyebrow: "АНАЛИТИКА / ПЕРСОНАЛЬНЫЙ РОСТ" },
  { key: "evidence", name: "Результаты", heading: "Результаты, которым можно доверять", description: "Какие действия подтвердили навыки, как растёт профиль и где это приносит практическую пользу", eyebrow: "АНАЛИТИКА / ДОКАЗАТЕЛЬСТВА И РЕЗУЛЬТАТ" },
];
const SKILL_KEYS = ["prompting", "prompt_engineering", "context_management", "tools_mcp", "creating_skills", "agents_team"] as const;
const LABELS = ["Постановка задач агенту", "Правила работы агента", "Формирование контекста", "Tools / MCP", "Создание и применение Skills", "Команда агентов"];
const SHORT_LABELS = ["Постановка задач", "Правила агента", "Контекст", "Инструменты MCP", "Skills", "Команда агентов"];
const TARGETS: Record<RoleKey, (number | null)[]> = {
  developer: [3, 4, 3, 2, 3, 2], analyst: [3, null, 3, 2, 2, 2], qa: [3, 2, 2, 2, 2, 2],
};
const PRACTICES: Record<string, string> = {
  prompting: "Поставьте агенту задачу и сохраните проверяемый результат",
  prompt_engineering: "Примените правила и зафиксируйте подтверждённое выполнение",
  context_management: "Подготовьте контекстный пакет и проверьте обращение агента к файлам",
  tools_mcp: "Подключите разрешённый MCP-инструмент и подтвердите вызов",
  creating_skills: "Создайте skill с воспроизводимым цифровым следом",
  agents_team: "Вызовите субагента и проверьте отдельный результат его работы",
};
const monthShort = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];
function skillSource(profile: AgenticServerProfile | undefined, role: RoleKey): Skill[] {
  const trusted = profile?.role_key === role
    && profile.profile_scope === "impulse_learning"
    && profile.scale_key === "agentic_coding_1_4"
    && profile.framework_version === "agentic-coding-source-map-2026-10-23";
  return SKILL_KEYS.map((key, index) => {
    const record = trusted ? profile.skills.find((item) => item.key === key) : undefined;
    return {
      key, title: LABELS[index] ?? key,
      target_level: record?.target_level ?? TARGETS[role][index] ?? null,
      current_level: record?.data_state === "verified" && typeof record.current_level === "number" ? record.current_level : null,
      evidence_count: record?.data_state === "verified" ? record.evidence_count : 0,
      data_state: record?.data_state ?? "unknown",
      unresolved_methodology: record?.unresolved_methodology ?? (role === "analyst" && index === 1),
    };
  });
}
function trustedProfile(profile: AgenticServerProfile | undefined, role: RoleKey): boolean {
  return profile?.role_key === role && profile.profile_scope === "impulse_learning"
    && profile.scale_key === "agentic_coding_1_4"
    && profile.framework_version === "agentic-coding-source-map-2026-10-23";
}
function pString(level: number | null): string { return level === null ? "—" : String(level); }
function monthSeries(snapshot: Snapshot | undefined, period: number): { name: string; total: number; verified: number }[] | null {
  if (!snapshot?.freshness.known || !snapshot.events?.length) return null;
  let dateParts: Intl.DateTimeFormat;
  try {
    dateParts = new Intl.DateTimeFormat("en-US", { timeZone: snapshot.actor_timezone, year: "numeric", month: "numeric" });
  } catch {
    return null;
  }
  const localYearMonth = (dateString: string): { year: number; month: number } | null => {
    const date = new Date(dateString);
    if (!Number.isFinite(date.getTime())) return null;
    const parts = dateParts.formatToParts(date);
    const year = Number(parts.find((part) => part.type === "year")?.value ?? NaN);
    const month = Number(parts.find((part) => part.type === "month")?.value ?? NaN);
    return Number.isFinite(year) && Number.isFinite(month) ? { year, month } : null;
  };
  const current = localYearMonth(snapshot.generated_at);
  if (current === null) return null;
  const result = Array.from({ length: period }, (_, i) => {
    const d = new Date(Date.UTC(current.year, current.month - period + i, 1));
    return { name: monthShort[d.getUTCMonth()] ?? "", year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, total: 0, verified: 0 };
  });
  for (const event of snapshot.events) {
    const recorded = localYearMonth(event.occurred_at);
    if (recorded === null) continue;
    const bucket = result.find((item) => item.year === recorded.year && item.month === recorded.month);
    if (bucket) {
      bucket.total += 1;
      if (event.source_ref && event.source_kind) bucket.verified += 1;
    }
  }
  return result.map(({ name, total, verified }) => ({ name, total, verified }));
}
function Radar({ skills }: { skills: Skill[] }) {
  const center = 260, radius = 118;
  const xy = (index: number, level: number) => {
    const a = (-Math.PI / 2) + index * (2 * Math.PI / skills.length);
    return { x: center + Math.cos(a) * radius * level / 4, y: 175 + Math.sin(a) * radius * level / 4 };
  };
  const points = (levels: number[]) => levels.map((level, index) => {
    const pos = xy(index, level);
    return String(pos.x) + "," + String(pos.y);
  }).join(" ");
  const known = skills.map((skill) => skill.current_level);
  return <div className="ref-radar" data-testid="reference-radar">
    <svg viewBox="0 0 520 350" role="img" aria-label="Циклограмма: бирюзовая линия — подтверждённый уровень, оранжевая пунктирная — целевой">
      {[1, 2, 3, 4].map((level) => <polygon key={level} points={points(skills.map(() => level))} stroke="#244760" strokeWidth="1" fill="none" />)}
      {skills.map((_, i) => { const p = xy(i, 4); return <line key={i} x1={center} y1="175" x2={p.x} y2={p.y} stroke="#244760" />; })}
      {[1, 2, 3, 4].map((n) => <text x="266" y={175 - radius * n / 4 + 10} key={n} fill="#7397aa" fontSize="11">{n}</text>)}
      {skills.map((_, i) => {
        const next = (i + 1) % skills.length;
        const a = skills[i]?.target_level, b = skills[next]?.target_level;
        if (a === null || a === undefined || b === null || b === undefined) return null;
        const first = xy(i, a), second = xy(next, b);
        return <line key={"t" + String(i)} x1={first.x} y1={first.y} x2={second.x} y2={second.y} stroke="#ffae2b" strokeWidth="2.6" strokeDasharray="6 5" />;
      })}
      {skills.map((_, i) => {
        const next = (i + 1) % skills.length;
        const a = known[i], b = known[next];
        if (a === null || a === undefined || b === null || b === undefined) return null;
        const first = xy(i, a), second = xy(next, b);
        return <line key={"c" + String(i)} x1={first.x} y1={first.y} x2={second.x} y2={second.y} stroke="#2ce8b5" strokeWidth="3" />;
      })}
      {skills.map((skill, i) => {
        const aim = skill.target_level, current = skill.current_level;
        const t = xy(i, aim ?? 0), c = xy(i, current ?? 0);
        const label = xy(i, 4.8);
        return <g key={skill.key}>
          {aim !== null && <circle cx={t.x} cy={t.y} r="3" fill="#ffb844" />}
          {current !== null && <circle cx={c.x} cy={c.y} r="4.3" fill="#31eaba" stroke="#092e2d" strokeWidth="1.5" />}
          <text x={label.x} y={label.y} fill="#bfd8e7" fontSize="11" fontWeight="600" textAnchor={i === 0 || i === 3 ? "middle" : i < 3 ? "start" : "end"}>{SHORT_LABELS[i]}</text>
        </g>;
      })}
    </svg>
    <div className="ref-legend"><span><i className="ref-dot" />Текущий уровень</span><span><i className="ref-dot amber" />Цель по методологии L1</span></div>
    {known.every((level) => level === null) && <p className="ref-chart-note">Подтверждённых уровней пока нет — бирюзовый контур появится после проверки цифровых следов.</p>}
  </div>;
}
function HistoryChart({ series, mode = "bars" }: { series: ReturnType<typeof monthSeries>; mode?: "bars" | "line" }) {
  if (!series) return <div className="ref-no-series" role="status">Нет достаточной истории цифровых следов для построения динамики. Неизвестные данные не заменяются нулями.</div>;
  const max = Math.max(1, ...series.map((m) => m.total));
  if (mode === "line") {
    const coords = series.map((m, i) => String(16 + i * (468 / Math.max(series.length - 1, 1))) + "," + String(130 - (m.total / max * 95))).join(" ");
    return <div className="ref-trend"><svg viewBox="0 0 500 170" role="img" aria-label="Динамика цифровых событий за выбранный период">
      {[40, 75, 110, 140].map((y) => <line key={y} x1="15" x2="485" y1={y} y2={y} stroke="#183a4e" />)}
      <polyline points={coords} fill="none" stroke="#28e9cc" strokeWidth="3" />
      {series.map((m, i) => <g key={i}><circle cx={16 + i * (468 / Math.max(series.length - 1, 1))} cy={130 - (m.total / max * 95)} r="3.5" fill="#28e9cc" /><text x={16 + i * (468 / Math.max(series.length - 1, 1))} y="162" fontSize="11" textAnchor="middle" fill="#8caabe">{m.name}</text></g>)}
    </svg></div>;
  }
  return <div className="ref-history-bars" role="img" aria-label="Количество событий и цифровых следов за выбранный период">{series.map((m, i) =>
    <div className="ref-month-bar" key={i}><div className="ref-bar-pair"><i style={{ height: String(m.total / max * 140) + "px" }} /><b style={{ height: String(m.verified / max * 140) + "px" }} /></div><span>{m.name}</span></div>)}</div>;
}
function Controls({ role, setRole, chart, setChart }: { role: RoleKey; setRole: (role: RoleKey) => void; chart: ChartKey; setChart: (chart: ChartKey) => void }) {
  return <div className="ref-controls">
    <div className="ref-switch" role="group" aria-label="Профессиональная группа">{(Object.entries(ROLES) as [RoleKey, string][]).map(([key, label]) => <button type="button" className={role === key ? "active" : ""} aria-pressed={role === key} key={key} onClick={() => { setRole(key); }}>{label}</button>)}</div>
    <div className="ref-switch" role="group" aria-label="Вид диаграммы">{([["radar", "Циклограмма"], ["histogram", "Гистограмма"], ["trend", "Тренд"]] as [ChartKey, string][]).map(([key, label]) => <button type="button" className={chart === key ? "active" : ""} aria-pressed={chart === key} key={key} onClick={() => { setChart(key); }}>{label}</button>)}</div>
  </div>;
}
function SkillsVisual({ skills, chart, series }: { skills: Skill[]; chart: ChartKey; series: ReturnType<typeof monthSeries> }) {
  if (chart === "radar") return <Radar skills={skills} />;
  if (chart === "trend") return <HistoryChart series={series} mode="line" />;
  return <div className="ref-skill-bars" aria-label="Уровни навыков по шкале 1–4">{skills.map((skill) =>
    <div className="ref-skill-bar" key={skill.key}><span>{skill.title}</span><div className="ref-meter"><div style={{ width: String((skill.current_level ?? 0) * 25) + "%" }} /><i style={{ left: String((skill.target_level ?? 0) * 25) + "%" }} /></div><strong>{pString(skill.current_level)} / {pString(skill.target_level)}</strong></div>)}</div>;
}
function SkillRows({ skills, openSkill }: { skills: Skill[]; openSkill: (key: string) => void }) {
  return <div className="ref-skill-list">{skills.map((skill, index) =>
    <button type="button" className="ref-skill-row" key={skill.key} onClick={() => { openSkill(skill.key); }}>
      <span className="ref-skill-no">{index + 1}</span><span className="ref-skill-title">{skill.title}</span>
      <span className="ref-meter"><span style={{ width: String((skill.current_level ?? 0) * 25) + "%" }} /><i style={{ left: String((skill.target_level ?? 0) * 25) + "%" }} /></span>
      <strong>{pString(skill.current_level)} / {pString(skill.target_level)}</strong>
      <small className={skill.current_level !== null && skill.target_level !== null && skill.current_level >= skill.target_level ? "done" : "pending"}>
        {skill.target_level === null ? "Цель уточняется" : skill.current_level === null ? "Нет данных" : skill.current_level >= skill.target_level ? "Цель достигнута" : "Требует проверки"}
      </small>
    </button>)}</div>;
}
function EvidenceList({ events, emptyText = "Подтверждённые цифровые следы пока не поступили", limit = 3 }: { events: EventView[]; emptyText?: string; limit?: number }) {
  if (events.length === 0) return <div className="ref-evidence-empty" role="status">{emptyText}</div>;
  return <div className="ref-evidence-list">{events.slice(0, limit).map((event, index) => <div className="ref-evidence-row" key={event.source_ref + String(index)}>
    <span className="ref-evidence-icon">✓</span><div><b>{event.title || "Зарегистрированное действие"}</b><small>{event.source_kind} · {new Date(event.occurred_at).toLocaleDateString("ru-RU")}</small></div><em>Активность</em>
  </div>)}</div>;
}
function QualifiedEvidenceList({ skills, limit = 3 }: { skills: Skill[]; limit?: number }) {
  const qualified = skills.filter((skill) => skill.current_level !== null && skill.evidence_count > 0);
  if (qualified.length === 0) return <div className="ref-evidence-empty" role="status">Проверенных цифровых следов для уровней Agentic Coding пока нет. Проектная активность не является их заменой.</div>;
  return <div className="ref-evidence-list">{qualified.slice(0, limit).map((skill) => <div className="ref-evidence-row" key={skill.key}>
    <span className="ref-evidence-icon">✓</span><div><b>{skill.title}</b><small>Подтверждённый уровень {pString(skill.current_level)} · квалифицированных источников: {skill.evidence_count}</small></div><em>Проверено</em>
  </div>)}</div>;
}
function Kpis({ skills, ready, sourceCount, accepted, variant }: { skills: Skill[]; ready: number | null; sourceCount: number | null; accepted: number | null; variant: LayoutKey }) {
  const required = skills.filter((skill) => skill.target_level !== null);
  const met = required.filter((skill) => skill.current_level !== null && skill.current_level >= (skill.target_level ?? 5)).length;
  const cards = variant === "evidence"
    ? [["Подтверждённые навыки", required.some((skill) => skill.current_level !== null) ? String(met) + " / " + String(required.length) : "—", "По методологии L1", "✓"],
       ["Основания профиля", sourceCount === null ? "—" : String(sourceCount), "Квалифицированные Agentic источники", "▤"],
       ["Результаты в проектах", accepted === null ? "—" : String(accepted), "Принятые результаты", "◉"],
       ["Готовность профиля", ready === null ? "—" : String(ready) + "%", "Только подтверждённые уровни", "↗"]]
    : [["Готовность профиля", ready === null ? "—" : String(ready) + "%", "На основе проверенных требований", "◉"],
       ["Требования выполнены", required.some((skill) => skill.current_level !== null) ? String(met) + " / " + String(required.length) : "—", "Нет данных ≠ нулевой уровень", "◎"],
       ["Подтверждённый опыт", sourceCount === null ? "—" : String(sourceCount), "Источник Agentic Coding", "▤"],
       ["Принятые результаты", accepted === null ? "—" : String(accepted), "С проверенным вкладом", "✓"]];
  return <div className="ref-kpis">{cards.map(([label, value, detail, icon], i) => <article className={"ref-kpi ref-kpi-" + String(i)} key={label}><span>{label}</span><b>{value}</b><small>{detail}</small><i aria-hidden="true">{icon}</i></article>)}</div>;
}
function Matrix({ title, subtitle, skills, role, setRole, chart, setChart, series, openSkill, className = "" }: {
  title: string; subtitle?: string; skills: Skill[]; role: RoleKey; setRole: (role: RoleKey) => void;
  chart: ChartKey; setChart: (chart: ChartKey) => void; series: ReturnType<typeof monthSeries>;
  openSkill: (key: string) => void; className?: string;
}) {
  return <section className={"ref-panel ref-matrix " + className}>
    <div className="ref-card-title"><div><span className="ref-cap">ГЛАВНЫЙ РЕЗУЛЬТАТ</span><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div></div>
    <Controls role={role} setRole={setRole} chart={chart} setChart={setChart} />
    <div className="ref-matrix-grid"><SkillsVisual skills={skills} chart={chart} series={series} /><div className="ref-matrix-list"><h3>Что уже подтверждено</h3><p>Текущий / целевой уровень</p><SkillRows skills={skills} openSkill={openSkill} /></div></div>
  </section>;
}
export function AnalyticsReference({ navigation = [] }: { navigation?: string[] }) {
  const [params, setParams] = useSearchParams();
  const requested = params.get("view");
  const layout: LayoutKey = requested === "path" || requested === "evidence" ? requested : "passport";
  const setLayout = (key: LayoutKey) => { setParams((previous) => { const next = new URLSearchParams(previous); next.set("view", key); return next; }); };
  const [role, setRole] = useState<RoleKey>("developer");
  const [chart, setChart] = useState<ChartKey>("radar");
  const [period, setPeriod] = useState(3);
  const [openDetail, setOpenDetail] = useState<string | null>(null);
  const [showCriteria, setShowCriteria] = useState(false);
  const profileQuery = useQuery({ queryKey: ["agentic-coding-profile", role], queryFn: () => apiRequest<AgenticServerProfile>(("/api/v1/me/agentic-coding/profile?role_key=" + role) as `/api/v1/me/agentic-coding/profile?${string}`) });
  const growthQuery = useQuery({ queryKey: ["participant-growth-analytics"], queryFn: () => apiRequest<Snapshot>("/api/v1/me/growth/snapshot") });
  const journeyQuery = useQuery({ queryKey: ["participant-analytics"], queryFn: () => apiRequest<Journey>("/api/v1/me/analytics/journey") });
  const skills = useMemo(() => skillSource(profileQuery.data, role), [profileQuery.data, role]);
  const verified = trustedProfile(profileQuery.data, role);
  const required = skills.filter((skill) => skill.target_level !== null);
  const known = required.filter((skill) => skill.current_level !== null);
  const met = known.filter((skill) => skill.current_level !== null && skill.current_level >= (skill.target_level ?? 5));
  const ready = verified && known.length === required.length && required.length > 0
    ? Math.round(required.reduce((sum, skill) => sum + Math.min((skill.current_level ?? 0) / (skill.target_level ?? 1), 1), 0) / required.length * 100) : null;
  const accepted = journeyQuery.data?.stages.find((stage) => stage.key === "verified_experience")?.count ?? null;
  const qualifiedSourceCount = trustedProfile(profileQuery.data, role) ? profileQuery.data?.known_evidence_count ?? null : null;
  const events = growthQuery.data?.freshness.known ? (growthQuery.data.events ?? []).filter((event) => Boolean(event.source_kind && event.source_ref)) : [];
  const series = monthSeries(growthQuery.data, period);
  const gap = skills.filter((skill) => skill.target_level !== null && (skill.current_level === null || skill.current_level < skill.target_level));
  const focus = gap.find((skill) => skill.current_level !== null) ?? gap[0];
  const focusTitle = focus?.title ?? "Все требования требуют подтверждения";
  const tasksAt = navigation.indexOf("Задачи");
  const tasksUrl = "/workspace/" + String(tasksAt >= 0 ? tasksAt : 2);
  const current = LAYOUTS.find((item) => item.key === layout) ?? { eyebrow: "АНАЛИТИКА / SKILL PASSPORT", heading: "Ваш Skill Passport", description: "Подтверждённые навыки и результаты" };
  const detailed = skills.find((skill) => skill.key === openDetail);
  return <main className={"analytics-reference ref-layout-" + layout} data-testid="analytics-reference" data-reference="ANALYTICS-REF-20261024">
    <nav className="ref-pages" aria-label="Представление аналитики">
      {LAYOUTS.map((item) => <button type="button" key={item.key} aria-current={layout === item.key ? "page" : undefined} className={layout === item.key ? "selected" : ""} onClick={() => { setLayout(item.key); }}>{item.name}</button>)}
    </nav>
    <header className="ref-page-header">
      <div><span className="ref-cap">{current.eyebrow}</span><h1 id="workspace-title">{current.heading}</h1><p>{current.description}</p></div>
      <div className="ref-filters"><label>Период<select aria-label="Период аналитики" value={period} onChange={(event) => { setPeriod(Number(event.target.value)); }}><option value={3}>3 месяца</option><option value={8}>8 месяцев</option></select></label>
        <label>Направление<select aria-label="Направление аналитики" value={role} onChange={(event) => { setRole(event.target.value as RoleKey); }}>{(Object.entries(ROLES) as [RoleKey, string][]).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
        <span className="ref-fresh">{profileQuery.data ? "● Данные " + new Date(profileQuery.data.as_of).toLocaleDateString("ru-RU") : "● Источник недоступен"}</span>
      </div>
    </header>
    {profileQuery.isError && <div className="ref-alert" role="status">Источник Skill Passport недоступен. Уровни не считаются нулём. <button type="button" onClick={() => { void profileQuery.refetch(); }}>Повторить</button></div>}
    {profileQuery.isPending && <p className="ref-loading" role="status">Загружается подтверждённый профиль навыков…</p>}
    {growthQuery.isPending && <p className="ref-loading" role="status">Загружается история цифровых следов…</p>}
    {growthQuery.isError && <div className="ref-alert" role="alert">Историю цифровых следов загрузить не удалось. Это не означает отсутствие подтверждений. <button type="button" onClick={() => { void growthQuery.refetch(); }}>Повторить</button></div>}
    {journeyQuery.isPending && <p className="ref-loading" role="status">Загружаются принятые результаты и путь участника…</p>}
    {journeyQuery.isError && <div className="ref-alert" role="alert">Источник принятых результатов недоступен. Отсутствующее значение не является нулём. <button type="button" onClick={() => { void journeyQuery.refetch(); }}>Повторить</button></div>}
    {layout !== "path" && <Kpis skills={skills} ready={ready} sourceCount={qualifiedSourceCount} accepted={accepted} variant={layout} />}
    {layout === "passport" && <>
      <div className="ref-v1-middle">
        <Matrix className="ref-primary-matrix" title="Матрица навыков Agentic Coding" subtitle="Сравнение вашего профиля с требованиями L1 · 6 компетенций" skills={skills} role={role} setRole={setRole} chart={chart} setChart={setChart} series={series} openSkill={setOpenDetail} />
        <aside className="ref-panel ref-passport"><span className="ref-cap">ВАШ ЦИФРОВОЙ ПРОФИЛЬ</span><div className="ref-passport-top"><span className="ref-passport-crest">◇</span><div><h2>Skill Passport</h2><p>{ROLES[role]} · Agentic Coding</p></div></div>
          <div className="ref-big-value">{ready === null ? "—" : String(ready) + "%"} <span>готовность к целевому профилю</span></div>
          <div className="ref-progress"><i style={{ width: String(ready ?? 0) + "%" }} /></div>
          <div className="ref-passport-info"><span>Уровень компетенций <b>1—4</b></span><span>Методология <b>Agentic Coding</b></span><span>Состояние <b>{known.length ? "Частичные данные" : "Нет подтверждений"}</b></span></div>
          <div className="ref-passport-summary"><span>Цифровые следы <b>{qualifiedSourceCount ?? "—"}</b></span><span>Требования <b>{known.length > 0 ? String(met.length) + " / " + String(required.length) : "—"}</b></span></div>
          <button className="ref-primary-cta" type="button" onClick={() => { setShowCriteria(true); }}>Открыть Skill Passport ↗</button>
          <small className="ref-disclaimer">Корпоративный L1 не выдаётся платформой Impulse</small>
        </aside>
      </div>
      <div className="ref-v1-bottom">
        <section className="ref-panel ref-action"><span className="ref-cap">ВАШ СЛЕДУЮЩИЙ ШАГ</span><h2>{focus ? "Подтвердить: " + focusTitle : "Продолжайте развитие навыков"}</h2><p>{focus ? PRACTICES[focus.key] : "Целевые уровни проверены. Дальнейший прогресс зависит от новых результатов."}</p><span className="ref-step-meta">{focus ? "Сейчас: " + pString(focus.current_level) + " / " + pString(focus.target_level) : "Нет открытых пробелов"}</span><a className="ref-primary-cta" href={tasksUrl}>Перейти к заданиям →</a></section>
        <section className="ref-panel ref-bottom-evidence"><div className="ref-card-title"><div><span className="ref-cap">ОСНОВАНИЯ УРОВНЕЙ</span><h2>Последние подтверждения</h2></div><button type="button" className="ref-small-link" onClick={() => { setLayout("evidence"); }}>Все события ↗</button></div><QualifiedEvidenceList skills={skills} /></section>
        <section className="ref-panel ref-bottom-chart"><div className="ref-card-title"><div><span className="ref-cap">ДИНАМИКА</span><h2>Развитие за {period} месяцев</h2></div></div><HistoryChart series={series} mode="line" /></section>
      </div>
    </>}
    {layout === "path" && <>
      <section className="ref-panel ref-path-hero"><div><span className="ref-cap">ПРОГРЕСС ПО ЦЕЛЕВОМУ ПРОФИЛЮ</span><h2>{gap.length ? "До учебного соответствия L1 — " + String(gap.length) + " навыка" : "Целевой профиль сформирован"}</h2><p>{known.length ? "Оценка строится только на подтверждённых навыках. Остальные требуют проверяемых действий." : "Пока не подключены подтверждённые цифровые следы. Требования методологии представлены как целевой профиль."}</p><div className="ref-path-buttons"><a className="ref-primary-cta" href={tasksUrl}>Начать следующий шаг →</a><button type="button" className="ref-ghost-cta" onClick={() => { setShowCriteria(true); }}>Показать критерии L1</button></div></div>
        <div className="ref-path-gauge"><div className="ref-donut" style={{ background: "conic-gradient(#25e2be " + String(ready ?? 0) + "%, #144355 0)" }}><div><b>{known.length > 0 ? String(met.length) + " / " + String(required.length) : "—"}</b><small>подтверждено</small></div></div><span>{ready === null ? "Готовность не рассчитана" : String(ready) + "% готовности профиля"}</span></div>
      </section>
      <section className="ref-panel ref-route"><div className="ref-route-title"><span className="ref-cap">ВАШ МАРШРУТ</span><span>От практики к проверяемому результату</span></div><div className="ref-route-steps">{["Выбрана роль", "Оценены навыки", "Закрыть пробелы", "Подтвердить L1"].map((step, i) => <div key={step} className={i === 2 ? "active" : i === 3 ? "locked" : ""}><span>{String(i + 1).padStart(2, "0")}</span><b>{step}</b><small>{[ROLES[role], String(required.length) + " по матрице", String(gap.length) + " требуют проверки", "По разрешённым цифровым следам"][i]}</small></div>)}</div></section>
      <div className="ref-v2-main">
        <section className="ref-panel ref-gaps"><div className="ref-card-title"><div><span className="ref-cap">ТОЧЕЧНЫЕ ДЕЙСТВИЯ</span><h2>{gap.length ? String(gap.length) + " навыка до целевого профиля" : "Открытые требования"}</h2><p>Каждое действие связано с правилами методологии</p></div></div>
          <div className="ref-gaps-list">{gap.length ? gap.slice(0, 3).map((skill, i) => <button className="ref-gap-row" key={skill.key} type="button" onClick={() => { setOpenDetail(skill.key); }}><span className="ref-gap-num">{i + 1}</span><div><h3>{skill.title}</h3><div className="ref-meter"><span style={{ width: String((skill.current_level ?? 0) * 25) + "%" }} /><i style={{ left: String((skill.target_level ?? 0) * 25) + "%" }} /></div><p>{PRACTICES[skill.key]}</p></div><strong>{pString(skill.current_level)} / {pString(skill.target_level)}</strong></button>) : <p className="ref-quiet">Пока нет новых пробелов для отображения.</p>}</div>
        </section>
        <Matrix className="ref-path-matrix" title={"Ваш профиль — " + ROLES[role]} skills={skills} role={role} setRole={setRole} chart={chart} setChart={setChart} series={series} openSkill={setOpenDetail} />
      </div>
      <div className="ref-v2-bottom">
        <section className="ref-panel ref-history"><div className="ref-card-title"><div><span className="ref-cap">ПРОВЕРЯЕМЫЙ РЕЗУЛЬТАТ</span><h2>История подтверждения</h2></div></div><QualifiedEvidenceList skills={skills} /></section>
        <section className="ref-panel ref-practice"><span className="ref-cap">ПОДХОДЯЩАЯ ПРАКТИКА</span><h2>{focusTitle}</h2><p>{focus ? PRACTICES[focus.key] : "Сверьте текущие навыки с требованиями целевого профиля"}</p><div className="ref-practice-steps"><span>① Подготовьте результат</span><span>② Выполните действие</span><span>③ Передайте evidence на проверку</span></div><a className="ref-primary-cta" href={tasksUrl}>Открыть практику →</a></section>
      </div>
    </>}
    {layout === "evidence" && <>
      <div className="ref-v3-main">
        <section className="ref-panel ref-v3-chart"><div className="ref-card-title"><div><span className="ref-cap">ВАШ ПРОФИЛЬ</span><h2>Компетенции Agentic Coding</h2></div></div><Controls role={role} setRole={setRole} chart={chart} setChart={setChart} /><SkillsVisual skills={skills} chart={chart} series={series} /></section>
        <section className="ref-panel ref-v3-evidence"><div className="ref-card-title"><div><span className="ref-cap">ПОДТВЕРЖДЕНИЕ</span><h2>Каждый уровень — с доказательством</h2><p>Откуда взялась оценка и какой источник её подтверждает</p></div></div>
          <div className="ref-evidence-count"><div><b>{qualifiedSourceCount ?? "—"}</b><span>квалифицированных источников</span></div><div><b>{known.length ? met.length : "—"}</b><span>компетенции достигли цели</span></div></div><div className="ref-all-evidence"><QualifiedEvidenceList skills={skills} limit={skills.length} /></div><div className="ref-warning"><strong>Как определяется уровень?</strong><p>По разрешённым цифровым следам и утверждённым требованиям роли. Курсы и тесты сами по себе не присваивают L1.</p></div>
        </section>
      </div>
      <div className="ref-section-intro"><div><span className="ref-cap">ОТ ДЕЙСТВИЙ К РЕЗУЛЬТАТУ</span><h2>Не только баллы: что изменилось в вашей работе</h2></div><span>Период: {period} месяцев</span></div>
      <div className="ref-v3-bottom">
        <section className="ref-panel ref-evidence-bars"><div className="ref-card-title"><div><span className="ref-cap">ДИНАМИКА</span><h2>Как копятся цифровые доказательства</h2></div></div><HistoryChart series={series} /></section>
        <section className="ref-panel ref-projects"><div className="ref-card-title"><div><span className="ref-cap">ПРАКТИКА</span><h2>Результаты и навыки</h2></div></div><p className="ref-project-disclaimer">Учебные и проектные действия. Они не подтверждают уровень Agentic Coding без отдельной квалификации.</p><EvidenceList events={events} emptyText="Нет зарегистрированной проектной активности" /></section>
        <section className="ref-panel ref-growth"><span className="ref-cap">ТОЧКА РОСТА</span><span className="ref-growth-icon">◎</span><h2>{focus ? "Следующее подтверждение — " + focusTitle : "Следующий шаг развития"}</h2><p>{focus ? "Сейчас " + pString(focus.current_level) + " / " + pString(focus.target_level) + ". Нужно дополнительное подтверждение." : "Продолжайте документировать результаты."}</p><div className="ref-progress"><i style={{ width: String(focus && focus.current_level !== null && focus.target_level !== null && focus.target_level > 0 ? focus.current_level / focus.target_level * 100 : 0) + "%" }} /></div><a className="ref-primary-cta" href={tasksUrl}>Посмотреть план →</a></section>
      </div>
    </>}
    <p className="ref-footer-note">Данные берутся из текущих источников Impulse. Неизвестные уровни не заменяются нулём. Официальный корпоративный L1 здесь не выдаётся.</p>
    <Modal title={detailed ? "Подтверждение навыка " + detailed.title : "Подтверждение навыка"} open={detailed !== undefined} onClose={() => { setOpenDetail(null); }}>
      {detailed && <div className="ref-modal-content"><span className="ref-cap">SKILL PASSPORT · КОМПЕТЕНЦИЯ</span>
        <h3>{detailed.title}</h3>
        <p>Подтверждённый уровень: <strong>{pString(detailed.current_level)}</strong> · Цель: <strong>{pString(detailed.target_level)}</strong></p>
        <p>{PRACTICES[detailed.key]}</p>
        <p>Событий из разрешённого источника: {detailed.evidence_count}. {detailed.unresolved_methodology ? "Есть нерешённое расхождение методологии." : "Неподтверждённый уровень не является нулём."}</p>
        <a className="ref-primary-cta" href={tasksUrl}>Перейти к задачам →</a>
      </div>}
    </Modal>
    <Modal title="Условия Agentic Coding L1" open={showCriteria} onClose={() => { setShowCriteria(false); }}>
      <div className="ref-modal-content"><span className="ref-cap">СЕРТИФИКАЦИЯ</span>
        <p>Требуется утверждённая матрица роли, разрешённые цифровые следы и авторизованное решение корпоративного источника.</p>
        <p>Прогресс на платформе Impulse — учебная проекция, не официальный сертификат Сбера.</p>
      </div>
    </Modal>
  </main>;
}
