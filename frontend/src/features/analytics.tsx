import { useQuery } from "@tanstack/react-query";
import { useState, type CSSProperties } from "react";

import { apiRequest } from "../api/client";
import { Badge, StatePanel } from "../components/ui";

type Stage = { key: string; title: string; status: "completed" | "in_progress" | "not_started" | "unknown"; completed: boolean; count: number };
type Earnings = { calculated: string; approved: string; paid: string; failed: string; currency: string | null; unknown_items: number };
type Analytics = { stages: Stage[]; successful: boolean; next_action: string; earnings: Earnings; freshness: string; generated_at: string };
type Role = "mentor" | "customer" | "manager" | "hr" | "operator";
type Metric = { key: string; label: string; numerator: number; denominator: number; value: string | null; unit: "percent" | "count"; period_start: string; period_end: string; cohort: string; freshness: "fresh" | "stale" | "unknown"; definition: string; suppressed: boolean; suppression_reason: string | null };
type RoleAnalyticsData = { role: Role; metrics: Metric[] };
const demoAnalytics: Analytics = {
  stages: [
    { key: "learning", title: "Обучение", status: "completed", completed: true, count: 6 },
    { key: "applications", title: "Отклики", status: "completed", completed: true, count: 4 },
    { key: "work", title: "Работа", status: "completed", completed: true, count: 3 },
    { key: "accepted", title: "Принятый результат", status: "completed", completed: true, count: 2 },
  ],
  successful: true,
  next_action: "Завершить MVP рекомендательной системы и отправить артефакты до 12 октября",
  earnings: { calculated: "225000", approved: "200000", paid: "125000", failed: "0", currency: "RUB", unknown_items: 0 },
  freshness: "fresh", generated_at: "2026-09-28T12:00:00Z",
};

type CompetencyView = "technical" | "practical" | "soft";
type Competency = { title: string; level: string; score: number; delta: number; evidence: string; detail: string };

const competencyGroups: Record<CompetencyView, { label: string; eyebrow: string; competencies: Competency[] }> = {
  technical: {
    label: "Технические знания",
    eyebrow: "Курсы + проверенные задания",
    competencies: [
      { title: "Python", level: "Уверенный", score: 82, delta: 9, evidence: "2 курса · итоговый тест 91%", detail: "Синтаксис, асинхронность и структура приложений подтверждены курсами Python для R&D и 6 проверенными заданиями." },
      { title: "API и интеграции", level: "Уверенный", score: 76, delta: 14, evidence: "Checkpoint + ревью ментора", detail: "Спроектирован контракт внешних источников; ментор подтвердил пагинацию, обработку лимитов и версионирование." },
      { title: "Автотесты", level: "Развивается", score: 54, delta: 8, evidence: "Курс · не хватает project evidence", detail: "Учебные тесты пройдены, но проектный checkpoint с unit и integration coverage ещё не принят." },
      { title: "OpenSpec / SDD", level: "Уверенный", score: 71, delta: 18, evidence: "Сертификат · 4 задания", detail: "Подтверждены формализация требований, сценарии WHEN/THEN и трассировка реализации до спецификации." },
      { title: "Работа с данными", level: "Базовый+", score: 64, delta: 6, evidence: "Курс + notebook", detail: "Подтверждены подготовка выборки, валидация схемы и базовая оценка качества данных." },
    ],
  },
  practical: {
    label: "Практические навыки",
    eyebrow: "Принятые проекты + артефакты",
    competencies: [
      { title: "Декомпозиция задачи", level: "Сильный", score: 86, delta: 12, evidence: "2 проекта · оценка A", detail: "Бизнес-задача разделена на проверяемые этапы, зависимости и критерии приёмки; план принят заказчиком." },
      { title: "Качество решения", level: "Уверенный", score: 79, delta: 10, evidence: "Benchmark + оценка A", detail: "Результат сравнивался с baseline, ограничения описаны, воспроизводимый отчёт принят ментором." },
      { title: "Надёжность", level: "Развивается", score: 61, delta: 7, evidence: "2 ревью · checkpoint в работе", detail: "Обработка ошибок реализована частично; следующий шаг — автоматические тесты retry, timeout и rate limit." },
      { title: "Документация", level: "Уверенный", score: 77, delta: 11, evidence: "README + OpenAPI", detail: "Архитектурное решение, запуск и API-контракт проверены в проекте рекомендательной системы." },
      { title: "Доставка результата", level: "Подтверждён", score: 83, delta: 15, evidence: "2 принятых вклада", detail: "Два личных вклада приняты заказчиками в срок и связаны с проверяемыми версиями артефактов." },
    ],
  },
  soft: {
    label: "Гибкие навыки",
    eyebrow: "Отзывы команды + решения людей",
    competencies: [
      { title: "Командная работа", level: "Сильный", score: 88, delta: 9, evidence: "4 human feedback", detail: "Участник синхронизировал API-контракт с Data Science и помог команде подготовить финальную защиту." },
      { title: "Коммуникация", level: "Уверенный", score: 81, delta: 13, evidence: "Ментор + заказчик", detail: "Статусы и риски формулировались заранее; уточнения привели к сокращению повторных доработок." },
      { title: "Самостоятельность", level: "Уверенный", score: 78, delta: 8, evidence: "3 checkpoint без эскалации", detail: "Три этапа завершены самостоятельно с корректным запросом обратной связи в точках решения." },
      { title: "Работа с обратной связью", level: "Сильный", score: 90, delta: 16, evidence: "2 итерации · без повтора ошибок", detail: "Замечания ментора преобразованы в конкретные изменения; повторное ревью принято без возврата." },
      { title: "Презентация результата", level: "Развивается", score: 66, delta: 5, evidence: "1 защита проекта", detail: "Техническая часть убедительна; следующий рост — короче связывать метрики модели с бизнес-эффектом." },
    ],
  },
};

function CompetencyRadar({ items }: { items: Competency[] }) {
  const centerX = 170;
  const centerY = 140;
  const radius = 78;
  const point = (index: number, value: number) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / items.length;
    const scaled = radius * value / 100;
    return `${String(centerX + Math.cos(angle) * scaled)},${String(centerY + Math.sin(angle) * scaled)}`;
  };
  const labelPoint = (index: number) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / items.length;
    return { x:centerX + Math.cos(angle) * 112, y:centerY + Math.sin(angle) * 108, anchor:Math.cos(angle) > .25 ? "start" : Math.cos(angle) < -.25 ? "end" : "middle" } as const;
  };
  const rings = [25, 50, 75, 100];
  return <div className="competency-radar"><svg viewBox="0 0 340 280" role="img" aria-label="Циклограмма уровня компетенций с подписями показателей">
    {rings.map((ring) => <polygon className="radar-ring" key={ring} points={items.map((_, index) => point(index, ring)).join(" ")} />)}
    {items.map((item, index) => <line className="radar-axis" key={item.title} x1={centerX} y1={centerY} x2={point(index, 100).split(",")[0]} y2={point(index, 100).split(",")[1]} />)}
    <polygon className="radar-value" points={items.map((item, index) => point(index, item.score)).join(" ")} />
    {items.map((item, index) => { const [cx, cy] = point(index, item.score).split(","); return <circle className="radar-point" key={item.title} cx={cx} cy={cy} r="4" />; })}
    {items.map((item,index)=>{const label=labelPoint(index);return <text className="radar-axis-label" key={`label-${item.title}`} x={label.x} y={label.y} textAnchor={label.anchor}><tspan x={label.x}>{item.title}</tspan><tspan className="radar-axis-score" x={label.x} dy="13">{item.score}%</tspan></text>;})}
  </svg><div className="radar-legend">{items.map((item, index) => <span key={item.title}><i style={{ "--radar-index": index } as CSSProperties} />{item.title}<strong>{item.score}%</strong></span>)}</div></div>;
}

export function ParticipantAnalytics() {
  const [competencyView, setCompetencyView] = useState<CompetencyView>("technical");
  const [selectedSkill, setSelectedSkill] = useState<Competency | null>(null);
  const [gapExpanded, setGapExpanded] = useState(false);
  const query = useQuery({ queryKey: ["participant-analytics"], queryFn: () => apiRequest<Analytics>("/api/v1/me/analytics/journey"), refetchOnMount: "always" });
  if (query.isLoading) return <StatePanel kind="loading" />;
  const data = query.data ?? demoAnalytics;
  const activity = [42, 58, 51, 73, 66, 88, 79, 94];
  const competencyGroup = competencyGroups[competencyView];
  const competencyAverage = Math.round(competencyGroup.competencies.reduce((sum, item) => sum + item.score, 0) / competencyGroup.competencies.length);
  const confirmedCompetencies = competencyGroup.competencies.filter((item) => item.score >= 70).length;
  const evidenceCoverage = competencyView === "technical" ? 84 : competencyView === "practical" ? 76 : 71;
  return <div className="feature-stack participant-analytics analytics-dashboard">
    {query.isError && <div className="demo-fallback-note" role="status"><strong>Демонстрационная аналитика</strong><span>API временно недоступен — показана связанная mock-проекция.</span><button className="secondary-button" type="button" onClick={() => { void query.refetch(); }}>Повторить</button></div>}
    <header className="dashboard-heading"><div><p className="eyebrow">Аналитика · личный путь</p><h1 id="workspace-title">Ваш прогресс и подтверждённый результат</h1><p className="lead">Показываем, как обучение превращается в проекты, оценки и позицию в рейтинге.</p></div><div className="analytics-controls"><label>Период<select defaultValue="90"><option value="30">30 дней</option><option value="90">3 месяца</option><option value="season">Сезон</option></select></label><label>Направление<select defaultValue="all"><option value="all">Все</option><option value="python">Python</option><option value="data">Data</option></select></label><div className="freshness-chip"><span className="fresh-dot" />Обновлено сегодня</div></div></header>
    <section className="competency-overview competency-overview--expanded">
      <div className="competency-main">
        <div className="section-heading"><div><p className="eyebrow">Главный результат развития</p><h2>Расширенная матрица · Python-разработчик</h2></div><Badge tone="success">Готовность 72%</Badge></div>
        <p>Знания, применение в реальной работе и гибкие навыки разделены. Каждый уровень связан с проверяемым источником.</p>
        <div className="competency-switcher" role="tablist" aria-label="Срез матрицы компетенций">{(Object.entries(competencyGroups) as [CompetencyView, typeof competencyGroups[CompetencyView]][]).map(([key, group]) => <button className={competencyView === key ? "active" : ""} type="button" role="tab" aria-selected={competencyView === key} key={key} onClick={() => { setCompetencyView(key); setSelectedSkill(null); }}>{group.label}</button>)}</div>
        <div className="competency-stat-grid"><article><span>Средний уровень</span><strong>{competencyAverage}%</strong><small>+{Math.round(competencyGroup.competencies.reduce((sum, item) => sum + item.delta, 0) / competencyGroup.competencies.length)}% за 3 месяца</small></article><article><span>Подтверждено</span><strong>{confirmedCompetencies} из {competencyGroup.competencies.length}</strong><small>уровень 70% и выше</small></article><article><span>Покрытие доказательствами</span><strong>{evidenceCoverage}%</strong><small>{competencyView === "practical" ? "проекты и артефакты" : competencyView === "soft" ? "обратная связь людей" : "курсы и checkpoints"}</small></article><article><span>Сильнейший рост</span><strong>+{Math.max(...competencyGroup.competencies.map((item) => item.delta))}%</strong><small>за выбранный период</small></article></div>
        <div className="competency-evidence-layout">
          <div><div className="competency-matrix">{competencyGroup.competencies.map((item) => <button className={selectedSkill?.title === item.title ? "active" : ""} type="button" aria-pressed={selectedSkill?.title === item.title} key={item.title} onClick={() => { setSelectedSkill(item); }}><span><strong>{item.title}</strong><small>{item.evidence}</small></span><i><b style={{ width: `${String(item.score)}%` }} /></i><em><b>{item.score}%</b>{item.level}</em></button>)}</div>{selectedSkill && <article className="competency-detail" role="status"><header><div><p className="eyebrow">Почему такой уровень</p><h3>{selectedSkill.title} · {selectedSkill.score}%</h3></div><Badge tone={selectedSkill.score >= 70 ? "success" : "warning"}>{selectedSkill.level}</Badge></header><p>{selectedSkill.detail}</p><footer><span>Динамика <strong>+{selectedSkill.delta}%</strong></span><span>Источник <strong>{selectedSkill.evidence}</strong></span></footer></article>}</div>
          <aside className="radar-card"><div><p className="eyebrow">Циклограмма</p><h3>{competencyGroup.label}</h3><small>{competencyGroup.eyebrow}</small></div><CompetencyRadar items={competencyGroup.competencies} /></aside>
        </div>
      </div>
      <aside className="credential-summary"><p className="eyebrow">Документы</p><h2>3 подтверждения</h2><article><span>✓</span><div><strong>OpenSpec и SDD</strong><small>Сертификат курса · действителен</small></div></article><article><span>✓</span><div><strong>Python для R&amp;D</strong><small>Сертификат курса · действителен</small></div></article><article><span>◆</span><div><strong>Прогнозирование нагрузки</strong><small>Проектный опыт · оценка B</small></div></article><a className="analytics-certificate-link" href="/workspace/7">Открыть все сертификаты <span>→</span></a><button className={`readiness-gap${gapExpanded ? " readiness-gap--expanded" : ""}`} type="button" aria-expanded={gapExpanded} onClick={() => { setGapExpanded((value) => !value); }}><span className="readiness-gap__top"><strong>До следующего уровня</strong><i>{gapExpanded ? "−" : "+"}</i></span><p>Завершите проектный checkpoint по автоматическим тестам.</p><em>+12% к готовности роли</em></button>{gapExpanded && <div className="readiness-detail"><p className="eyebrow">План подтверждения</p><h3>Автоматические тесты API</h3><ul><li><span>1</span><div><strong>Добавить unit-тесты</strong><small>retry, timeout и rate limit</small></div></li><li><span>2</span><div><strong>Запустить integration suite</strong><small>минимум 80% критического пути</small></div></li><li><span>3</span><div><strong>Отправить evidence ментору</strong><small>отчёт, commit и объяснение границ</small></div></li></ul><dl><div><dt>Сейчас</dt><dd>54%</dd></div><div><dt>После принятия</dt><dd>66%</dd></div><div><dt>Дедлайн</dt><dd>12 октября</dd></div></dl><a href="/workspace/4">Открыть проектный checkpoint →</a></div>}</aside>
    </section>
    <section className="metric-grid participant-kpi-grid"><article className="metric-card metric-card--teal"><span>Прогресс траектории</span><strong>68%</strong><small>+12% за месяц</small></article><article className="metric-card metric-card--blue"><span>Активные проекты</span><strong>2</strong><small>1 результат до 12 октября</small></article><article className="metric-card metric-card--violet"><span>Подтверждённый опыт</span><strong>7</strong><small>2 оценки A · 3 оценки B</small></article><article className="metric-card metric-card--teal"><span>Принятые результаты</span><strong>3</strong><small>+1 за месяц</small></article></section>
    <div className="analytics-main-grid"><section className="analytics-panel"><div className="section-heading"><div><p className="eyebrow">Конверсия пути</p><h2>От обучения до принятого результата</h2></div><Badge tone="success">42% до результата</Badge></div><div className="analytics-funnel">{[{ label: "Обучение", value: 12, rate: "100%" }, { label: "Отклики", value: 8, rate: "67%" }, { label: "Работа", value: 5, rate: "63%" }, { label: "Принято", value: 3, rate: "60%" }, { label: "Подтверждено", value: 2, rate: "67%" }].map((stage, index) => <div key={stage.label} style={{ width: `${String(100 - index * 11)}%` }}><span>{stage.label}</span><strong>{stage.value}</strong><small>{stage.rate}</small></div>)}</div></section>
      <section className="analytics-panel activity-chart-panel"><div className="section-heading"><div><p className="eyebrow">Динамика</p><h2>Активность по неделям</h2></div><Badge>8 недель</Badge></div><div className="analytics-histogram" role="img" aria-label="Активность по восьми неделям">{activity.map((value, index) => <div key={index}><div className="histogram-bar-wrap" style={{ "--bar-height": `${String(value)}%` } as CSSProperties}><small>{value}</small><i style={{ height: `${String(value)}%` }} /></div><span>Н{index + 1}</span></div>)}</div><footer className="histogram-caption"><span><i />Учебные и проектные действия</span><strong>Среднее: 69 в неделю</strong></footer></section></div>
    <div className="analytics-main-grid"><section className="analytics-panel"><h2>Баллы и рейтинг</h2><div className="score-split"><div><span>Постоянные</span><strong>450</strong><small>Принятые проекты и подтверждённые события</small></div><div><span>Замороженные</span><strong>+5</strong><small>AI Journey 2026 · до проверки результата</small></div><div><span>Позиция</span><strong>3 → 2</strong><small>50 баллов до следующего места</small></div></div></section><section className="analytics-panel"><h2>Распределение результата</h2><div className="direction-bars"><div><span>Python / Backend</span><i><b style={{ width: "74%" }} /></i><strong>74%</strong></div><div><span>Data / ML</span><i><b style={{ width: "18%" }} /></i><strong>18%</strong></div><div><span>Product</span><i><b style={{ width: "8%" }} /></i><strong>8%</strong></div></div></section></div>
    <section className="learning-effectiveness"><div><p className="eyebrow">Эффективность обучения</p><h2>Навыки применяются в реальных проектах</h2></div><div><strong>18</strong><span>checkpoint завершено</span></div><div><strong>42 ч</strong><span>осмысленного обучения</span></div><div><strong>3</strong><span>курса подтверждено</span></div><div><strong>78%</strong><span>навыков применено</span></div></section>
    <section className="analytics-results"><div className="section-heading"><h2>Последние подтверждённые результаты</h2><Badge tone="success">Проверены человеком</Badge></div><article><strong>Рекомендательная система</strong><span>Оценка A · +150 баллов</span></article><article><strong>Прогнозирование нагрузки</strong><span>Оценка B · +90 баллов</span></article></section>
    <section className="analytics-ai-insight"><span className="ai-orb">✦</span><div><p className="eyebrow">AI insight · не решение</p><h2>{data.next_action}</h2><p>Checkpoint связан с текущим проектом и даст максимальный прирост подтверждённого опыта на этой неделе.</p></div><Badge tone={data.successful ? "success" : "warning"}>{data.successful ? "Путь подтверждён" : "Путь продолжается"}</Badge></section>
  </div>;
}

const roleTitles: Record<Role, string> = { mentor: "Качество и скорость ревью", customer: "Путь задачи до принятого результата", manager: "Результаты и повторное использование", hr: "Воронка кандидатов по решениям людей", operator: "Качество операционного контура" };

export function RoleAnalytics({ role }: { role: Role }) {
  const query = useQuery({ queryKey: ["role-analytics", role], queryFn: () => apiRequest<RoleAnalyticsData>("/api/v1/analytics/role"), refetchOnMount: "always" });
  if (query.isLoading) return <StatePanel kind="loading" />;
  if (query.isError || !query.data) return <StatePanel kind="error" action="Повторить" onAction={() => { void query.refetch(); }} />;
  const stale = query.data.metrics.some((metric) => metric.freshness !== "fresh");
  return <div className="feature-stack role-analytics"><header className="dashboard-heading"><div><p className="eyebrow">Аналитика роли · проверяемые формулы</p><h1 id="workspace-title">{roleTitles[role]}</h1><p className="lead">Каждое значение показывает период, когорту, числитель и знаменатель. Подавленные или задержанные данные не заменяются нулём.</p></div><Badge tone={stale ? "warning" : "success"}>{stale ? "Данные задерживаются" : "Данные актуальны"}</Badge></header>{stale && <div className="analytics-stale" role="status"><strong>Источник обновляется с задержкой</strong><span>Последнее доступное значение сохранено; нулевой результат не подставляется.</span></div>}<section className="role-metric-grid" aria-label="Метрики роли">{query.data.metrics.map((metric) => <article className={`role-metric-card ${metric.suppressed ? "role-metric-card--suppressed" : ""}`} key={metric.key}><header><span>{metric.label}</span><Badge tone={metric.freshness === "fresh" ? "success" : "warning"}>{metric.freshness === "fresh" ? "Актуально" : "Задержка"}</Badge></header><strong>{metric.suppressed ? "Скрыто" : metric.value === null ? "Нет данных" : metric.unit === "percent" ? `${metric.value}%` : metric.value}</strong><small>{new Date(metric.period_start).toLocaleDateString("ru-RU")} — {new Date(metric.period_end).toLocaleDateString("ru-RU")}</small><details><summary>Как рассчитано</summary><p>{metric.definition}</p><dl><div><dt>Числитель</dt><dd>{metric.suppressed ? "—" : metric.numerator}</dd></div><div><dt>Знаменатель</dt><dd>{metric.suppressed ? "—" : metric.denominator}</dd></div><div><dt>Когорта</dt><dd>{metric.cohort}</dd></div></dl>{metric.suppressed && <p className="privacy-note">Малая когорта: значение и персональная детализация скрыты.</p>}</details></article>)}</section></div>;
}
