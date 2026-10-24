import { useEffect, useRef, useState } from "react";
import "./agentic-coding-profile.scss";

/**
 * Methodology preview only. Evidence/issuer integrations are not available.
 * Targets: openspec/changes/impulse-ecosystem/docs/analytics-agentic-coding/
 * role_targets.source_map.json and competency_anchors.md.
 * Unknown is null, never a competency level 0 or a certification failure.
 */
type Role = "developer" | "analyst" | "qa";
type ChartView = "radar" | "bars" | "table";
type SkillSlice = "practical" | "technical" | "soft";
type SkillDefinition = {
  key: string;
  label: string;
  short: string;
  summary: string;
  intermediate: string;
  advanced: string;
  expert: string;
  traces: string[];
  practice: string;
  expertPending?: boolean;
};

const SKILLS: readonly SkillDefinition[] = [
  {
    key: "prompting", label: "Постановка задач агенту", short: "Задачи агенту",
    summary: "Формулирование намерения, уточнение задачи и принятие результата работы агента",
    intermediate: "Применяет AI-ассистента и формулирует простые запросы",
    advanced: "Ставит задачу в агентном режиме, проверяет результат и уточняет требования",
    expert: "Систематизирует сценарии в библиотеке промптов для повторного использования",
    traces: ["chat_window.message.agent.sent", "cli.message.sent", "settings_ide.prompt_library.new_prompt"],
    practice: "Поставить агенту задачу в GigaCode, проверить ответ и уточнить запрос по результату"
  },
  {
    key: "prompt_engineering", label: "Правила работы агента", short: "Правила агента",
    summary: "Rules, plan mode и управляемые ограничения работы агента",
    intermediate: "Задаёт правила и ограничения для работы агента",
    advanced: "Использует plan mode для подготовки и проверки плана комплексной задачи",
    expert: "Разрабатывает командные rules и системные промпты, поддерживает их актуальность",
    traces: ["chat_window.rules.applied", "chat_window.plan.confirmed", "settings.rules.new_rule"],
    practice: "Составить rules и согласовать план реализации с агентом в GigaCode"
  },
  {
    key: "context_management", label: "Управление контекстом", short: "Контекст",
    summary: "Подготовка релевантного, безопасного и воспроизводимого контекста",
    intermediate: "Дополняет контекст файлами, ссылками и ответами на уточняющие вопросы",
    advanced: "Готовит структурированный контекст до запуска агента и контролирует его актуальность",
    expert: "Выстраивает командный контекстный слой и правила его сопровождения",
    traces: ["chat_window.message.attach_file", "cli_chat_message_attach_file_count", "rep.lists__v_tdatahub_engin_prompt_metrics.mdfile_appeal"],
    practice: "Подготовить релевантный GIGACODE.md и проверить обращение агента к файлу",
    expertPending: true
  },
  {
    key: "tools_mcp", label: "Инструменты и MCP", short: "Tools / MCP",
    summary: "Вызов инструментов агентом и безопасная интеграция внешних систем",
    intermediate: "Подключает доступный инструмент и получает реальный результат его вызова",
    advanced: "Создаёт или обновляет инструмент, который успешно использует агент",
    expert: "Формирует командную библиотеку инструментов",
    traces: ["chat_window.agent.tool_call", "rep.lists__v_tdatahub_engin_prompt_metrics.mcp_tool_call", "rep.lists__v_tdatahub_cli_metrics.cli_mcp_tool_create_count"],
    practice: "Подключить разрешённый MCP-инструмент и проверить фактический вызов",
    expertPending: true
  },
  {
    key: "creating_skills", label: "Skills агента", short: "Skills",
    summary: "Подключение, создание и воспроизводимое использование специализированных skills",
    intermediate: "Подключает существующий skill для решения задачи",
    advanced: "Создаёт skill с успешным вызовом или выполняет нормативное условие регулярных вызовов",
    expert: "Создаваемые skills регулярно переиспользуются коллегами",
    traces: ["chat_window.skill.invoked", "rep.lists__v_tdatahub_engin_prompt_metrics.skill_create", "rep.lists__v_tdatahub_cli_metrics.cli_skill_create_count"],
    practice: "Создать skill, поместить в поддерживаемый каталог GigaCode и проверить вызов",
    expertPending: true
  },
  {
    key: "agents_team", label: "Субагенты и Agent Teams", short: "Agent Teams",
    summary: "Использование субагентов и координация параллельного выполнения",
    intermediate: "Использует субагентов для решения комплексной задачи",
    advanced: "Распределяет работу между субагентами и управляет параллельным исполнением",
    expert: "Создаёт специализированных субагентов",
    traces: ["cli.message.answer.subagent_execution", "agent.parallel.work", "rep.lists__v_tdatahub_cli_metrics.cli_subagent_create_count"],
    practice: "Вызвать подходящего субагента и проверить отдельный результат его работы"
  }
];

const ROLE_PROFILES: Record<Role, { name: string; target: readonly (number | null)[]; conflicts: readonly number[] }> = {
  developer: { name: "Разработчик", target: [3, 4, 3, 2, 3, 2], conflicts: [4] },
  analyst: { name: "Аналитик", target: [3, null, 3, 2, 2, 2], conflicts: [1, 2] },
  qa: { name: "Тестировщик", target: [3, 2, 2, 2, 2, 2], conflicts: [1] }
};
const LEVEL_NAMES = ["", "Теория", "Применение", "Управление", "Экспертиза"];
const CENTER = 183;
const ANGLES = SKILLS.map((_, index) => (-Math.PI / 2) + index * Math.PI * 2 / SKILLS.length);
function point(index: number, level: number) {
  const radius = level * 30;
  return { x: CENTER + Math.cos(ANGLES[index] ?? 0) * radius, y: CENTER + Math.sin(ANGLES[index] ?? 0) * radius };
}
function polygonAt(level: number) {
  return SKILLS.map((_, index) => {
    const p = point(index, level);
    return String(p.x) + "," + String(p.y);
  }).join(" ");
}
function targetSegments(target: readonly (number | null)[]) {
  return target.flatMap((level, index) => {
    const next = (index + 1) % target.length;
    const other = target[next];
    if (level === null || other === null || other === undefined) return [];
    return [{ start: point(index, level), end: point(next, other), key: index }];
  });
}

function TargetRadar({ targets, onSelect }: { targets: readonly (number | null)[]; onSelect: (key: string) => void }) {
  return <div className="agentic-radar" data-testid="agentic-target-radar">
    <svg viewBox="0 0 366 366" role="img" aria-label="Циклограмма целевых навыков Agentic Coding по шкале от 1 до 4. Подтверждённые уровни отсутствуют. Все точные значения представлены в списке навыков справа.">
      {[1, 2, 3, 4].map((level) => <polygon key={level} className="agentic-ring" points={polygonAt(level)} />)}
      {SKILLS.map((skill, index) => {
        const end = point(index, 4);
        const label = point(index, 5.12);
        return <g key={skill.key}>
          <line className="agentic-axis" x1={CENTER} y1={CENTER} x2={end.x} y2={end.y} />
          <text className="agentic-radar-label" x={label.x} y={label.y}
            textAnchor={label.x > CENTER + 15 ? "start" : label.x < CENTER - 15 ? "end" : "middle"}>{skill.short}</text>
        </g>;
      })}
      {targetSegments(targets).map(({ start, end, key }) =>
        <line key={key} className="agentic-target-line" x1={start.x} y1={start.y} x2={end.x} y2={end.y} />)}
      {targets.map((level, index) => {
        if (level === null) return null;
        const pos = point(index, level);
        const skill = SKILLS[index];
        if (!skill) return null;
        return <g key={skill.key} className="agentic-radar-control" role="button" tabIndex={0}
          aria-label={skill.label + ". Цель " + String(level) + " из 4. Подробнее"}
          onClick={() => onSelect(skill.key)}
          onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(skill.key); } }}>
          <circle className="agentic-radar-hit" cx={pos.x} cy={pos.y} r="16" />
          <circle className="agentic-target-dot" cx={pos.x} cy={pos.y} r="5" />
        </g>;
      })}
      {[1, 2, 3, 4].map((level) =>
        <text key={level} className="agentic-ring-label" x={CENTER + 5} y={CENTER - level * 30 + 12}>{level}</text>)}
    </svg>
  </div>;
}

function SkillDetail({ skill, target, roleName, conflict, onClose }: {
  skill: SkillDefinition; target: number | null; roleName: string; conflict: boolean; onClose: () => void;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButton.current?.focus();
    const handleKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("keydown", handleKey); previous?.focus(); };
  }, [onClose]);
  const levelDescriptions = [
    "Базовая теория: курс «Введение в GigaCode». В учебном Skill Passport хранится отдельно от практических следов L1.",
    skill.intermediate, skill.advanced, skill.expert
  ];
  return <div className="agentic-detail-overlay" data-testid="agentic-skill-detail">
    <button type="button" className="agentic-detail-scrim" onClick={onClose} aria-label="Закрыть подробности навыка" tabIndex={-1} />
    <aside role="dialog" aria-modal="true" aria-labelledby="agentic-detail-heading" className="agentic-detail-sheet">
      <header className="agentic-detail-header">
        <div><span className="agentic-overline">Skill Passport / {roleName}</span><h2 id="agentic-detail-heading">{skill.label}</h2></div>
        <button ref={closeButton} type="button" className="agentic-close" onClick={onClose} aria-label="Закрыть">×</button>
      </header>
      <p>{skill.summary}</p>
      <div className="agentic-detail-stats">
        <div><span>Подтверждено</span><strong>Нет данных</strong></div>
        <div><span>Цель</span><strong>{target === null ? "Не задана" : String(target) + " / 4"}</strong></div>
        <div><span>Прогноз</span><strong>Нет данных</strong></div>
      </div>
      {conflict && <p className="agentic-detail-warning" role="status">Методология содержит расхождение источников для этой компетенции. Указанная цель справочная — до утверждения версии автоматический вывод о соответствии запрещён.</p>}
      <h3>Как оценивается навык</h3>
      <div className="agentic-levels">
        {[1, 2, 3, 4].map((level) =>
          <details key={level} open={level === target ? true : undefined}>
            <summary><span className="agentic-level-number">{level}</span><strong>{LEVEL_NAMES[level]}</strong>
              {level === target && <span className="agentic-level-target">Цель</span>}</summary>
            <p>{levelDescriptions[level - 1]}</p>
            {level === 4 && skill.expertPending && <small>Автоматическая проверка уровня находится в проработке.</small>}
          </details>)}
      </div>
      <h3>Цифровые следы из методологии</h3>
      <ul className="agentic-evidence-list">{skill.traces.map((trace) => <li key={trace}><code>{trace}</code></li>)}</ul>
      <p className="agentic-detail-note">Примеры событий не означают, что они получены от участника. Применимость правил и пороги определяются версией методологии и профессиональной группой.</p>
      <div className="agentic-detail-action"><h3>Следующая практика</h3><p>{skill.practice}</p><span>Учебная рекомендация · подтверждение по цифровым следам не подключено</span></div>
      <div className="agentic-detail-empty"><strong>История и подтверждения</strong><p>Проверенные события, исключённые сигналы и даты оценки появятся после подключения разрешённого источника. Отсутствие данных не означает уровень 0.</p></div>
    </aside>
  </div>;
}

function CertificationPanel({ role, targets, conflicts }: {
  role: { name: string }; targets: readonly (number | null)[]; conflicts: readonly number[];
}) {
  const [expanded, setExpanded] = useState(false);
  const required = targets.filter((value) => value !== null).length;
  return <aside className="agentic-certification" aria-label="Сертификация Agentic Coding">
    <div className="agentic-cert-top"><span className="agentic-overline">Сертификация</span><span className="agentic-status-mark">Не подключена</span></div>
    <h3>Agentic Coding <em>L1</em></h3>
    <p className="agentic-cert-lead">Соответствие профилю L1: учебная оценка</p>
    <div className="agentic-cert-count">
      <div><span>Подтверждено</span><strong>— <small>/ {required}</small></strong></div>
      <span>обязательных навыков</span>
    </div>
    <p className="agentic-cert-foot">Источники цифровых следов не подключены. Рассчитать соответствие нельзя.</p>
    <div className="agentic-cert-checks" aria-label="Состояние источников">
      <div><span className="agentic-check-dot agentic-check-dot--known" /><span>Целевая матрица</span><strong>{required} требований</strong></div>
      <div><span className="agentic-check-dot" /><span>Цифровые следы</span><strong>Нет подключения</strong></div>
      <div><span className="agentic-check-dot" /><span>Решение о L1</span><strong>Не выдавалось</strong></div>
    </div>
    {conflicts.length > 0 && <p className="agentic-cert-conflict" role="status">
      <strong>Есть спорные требования: {conflicts.length}</strong>
      <span>Нужна утверждённая версия правил для роли «{role.name}»</span>
    </p>}
    <button className="agentic-cert-button" type="button" aria-expanded={expanded} aria-controls="agentic-cert-details"
      onClick={() => setExpanded((value) => !value)}>{expanded ? "Скрыть условия" : "Посмотреть условия сертификации"} <span aria-hidden="true">↗</span></button>
    {expanded && <div id="agentic-cert-details" className="agentic-cert-details">
      <strong>Что требуется</strong>
      <ol>
        <li>Опубликованные правила профессиональной группы и периода</li>
        <li>Проверенные цифровые следы по обязательным навыкам</li>
        <li>Авторизованное решение корпоративного источника</li>
      </ol>
      <p>Курс и тест сами по себе не подтверждают корпоративный L1. Отдельные сертификаты Impulse доступны ниже в документах.</p>
    </div>}
    <p className="agentic-cert-disclaimer">Официальный бейдж L1 не выдаётся платформой Impulse</p>
  </aside>;
}

export function AgenticCodingProfile() {
  const [role, setRole] = useState<Role>("developer");
  const [view, setView] = useState<ChartView>("radar");
  const [slice, setSlice] = useState<SkillSlice>("practical");
  const [activeSkill, setActiveSkill] = useState<string | null>(null);
  const profile = ROLE_PROFILES[role];
  const skill = SKILLS.find((item) => item.key === activeSkill) ?? null;
  const activeIndex = SKILLS.findIndex((item) => item.key === activeSkill);
  const target = activeIndex >= 0 ? profile.target[activeIndex] ?? null : null;
  const hasConflict = profile.conflicts.includes(activeIndex);
  const closeDetail = () => setActiveSkill(null);

  return <section className="agentic-profile" aria-labelledby="agentic-profile-title" data-testid="agentic-profile">
    <header className="agentic-profile-heading">
      <div className="agentic-profile-title">
        <p className="agentic-overline">SKILL PASSPORT <span> / </span> AGENTIC CODING</p>
        <h2 id="agentic-profile-title">Матрица компетенций</h2>
        <p>Ваш профиль навыков: что требуется для роли и какие данные ещё нужно подтвердить</p>
      </div>
      <label className="agentic-role-picker">Профессиональная группа
        <select value={role} onChange={(event) => { setRole(event.target.value as Role); setActiveSkill(null); }}>
          <option value="developer">Разработчик</option><option value="analyst">Аналитик</option><option value="qa">Тестировщик</option>
        </select>
      </label>
    </header>
    <div className="agentic-slice-tabs" role="group" aria-label="Тип компетенций">
      <button type="button" aria-pressed={slice === "practical"} onClick={() => setSlice("practical")}>AI-навыки · практика <span>6</span></button>
      <button type="button" aria-pressed={slice === "technical"} onClick={() => setSlice("technical")}>Технические</button>
      <button type="button" aria-pressed={slice === "soft"} onClick={() => setSlice("soft")}>Гибкие</button>
    </div>
    {slice !== "practical" ? <div className="agentic-slice-empty" role="status">
      <strong>{slice === "technical" ? "Технические компетенции" : "Гибкие навыки"}</strong>
      <p>{slice === "technical" ? "Проверенные технические навыки по выбранной траектории доступны в блоке «Аналитика траектории» ниже. Они не являются частью сертификации Agentic Coding." : "Отдельная модель оценки гибких навыков пока не подключена. События работы ИИ-агентов не используются для их автоматического подтверждения."}</p>
      <button type="button" onClick={() => setSlice("practical")}>Вернуться к AI-навыкам</button>
    </div> : <>
      <div className="agentic-profile-main">
        <div className="agentic-profile-chart">
          <div className="agentic-chart-title">
            <div><span className="agentic-overline">Целевой профиль · {profile.name}</span><h3>6 компетенций <span className="agentic-chart-subtitle">/ шкала 1–4</span></h3></div>
            <div role="group" aria-label="Вид диаграммы" className="agentic-chart-modes">
              <button type="button" aria-pressed={view === "radar"} onClick={() => setView("radar")}>Циклограмма</button>
              <button type="button" aria-pressed={view === "bars"} onClick={() => setView("bars")}>Полосы</button>
              <button type="button" aria-pressed={view === "table"} onClick={() => setView("table")}>Таблица</button>
            </div>
          </div>
          <div className="agentic-legend" aria-label="Обозначения">
            <span className="agentic-legend-target">Цель</span>
            <span className="agentic-legend-current">Подтверждено: нет данных</span>
            <span className="agentic-legend-forecast">Прогноз: нет данных</span>
          </div>
          {view === "radar" && <div className="agentic-visual-layout">
            <TargetRadar targets={profile.target} onSelect={setActiveSkill} />
            <div className="agentic-axis-list" aria-label="Значения целевого профиля">
              {SKILLS.map((item, index) => <button type="button" key={item.key} onClick={() => setActiveSkill(item.key)}
                className="agentic-skill-row" data-testid={"agentic-skill-" + item.key}>
                <span className="agentic-skill-label">{String(index + 1).padStart(2, "0")} <strong>{item.label}</strong></span>
                <span className="agentic-skill-current">Подтверждено: нет данных</span>
                <span className="agentic-skill-target">Цель <b>{profile.target[index] === null ? "—" : String(profile.target[index]) + "/4"}</b><span aria-hidden="true">›</span></span>
                {profile.conflicts.includes(index) && <small>Требуется уточнение методологии</small>}
              </button>)}
            </div>
          </div>}
          {view === "bars" && <div className="agentic-bars" aria-label="Целевые уровни по навыкам">
            {SKILLS.map((item, index) => <button type="button" key={item.key} className="agentic-bar-row" onClick={() => setActiveSkill(item.key)}>
              <span>{item.label}</span><span className="agentic-bar-track">
                {profile.target[index] !== null && <i style={{ width: String((profile.target[index] ?? 0) * 25) + "%" }} />}
              </span><strong>{profile.target[index] === null ? "—" : String(profile.target[index]) + "/4"}</strong><small>Подтверждено: нет данных</small>
            </button>)}
          </div>}
          {view === "table" && <div className="agentic-table-scroll"><table className="agentic-table">
            <thead><tr><th scope="col">Навык</th><th scope="col">Подтверждено</th><th scope="col">Цель</th><th scope="col">Детали</th></tr></thead>
            <tbody>{SKILLS.map((item, index) => <tr key={item.key}><th scope="row">{item.label}</th><td>Нет данных</td><td>{profile.target[index] === null ? "Не задана" : String(profile.target[index]) + "/4"}</td><td><button type="button" onClick={() => setActiveSkill(item.key)} aria-label={"Подробнее: " + item.label}>Открыть ↗</button></td></tr>)}</tbody>
          </table></div>}
          <div className="agentic-methodology-note"><span>i</span>
            <p>Цели приведены по методологии Agentic Coding. Отсутствие цифровых следов — не уровень 0 и не провал сертификации.</p></div>
        </div>
        <CertificationPanel role={profile} targets={profile.target} conflicts={profile.conflicts} />
      </div>
      <div className="agentic-footer-strip">
        <div><strong>Шкала 1–4</strong><span>Теория · применение · управление · экспертиза</span></div>
        <div><strong>Источник</strong><span>Методология Agentic Coding · версия целевого профиля требует утверждения</span></div>
        <div><strong>SDD · наблюдение</strong><span>Дополнительная компетенция, не входит в 6 осей L1</span></div>
      </div>
    </>}
    {skill !== null && <SkillDetail skill={skill} target={target} roleName={profile.name} conflict={hasConflict} onClose={closeDetail} />}
  </section>;
}
