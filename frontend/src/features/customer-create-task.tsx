import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Check, CheckCircle2, ChevronRight, CircleAlert, ClipboardCheck, Eye, FileText, Lightbulb, List, ListOrdered, Plus, Save, Search, Sparkles, UsersRound, X } from "lucide-react";
import "./customer-create-task.scss";

export type CreateTaskBrief = {
  title: string;
  shortSummary: string;
  skills: string[];
  department: string;
  direction: string;
  taskType: string;
  problem: string;
  deliverable: string;
  criteria: string;
  deadline: string;
  places: number;
  mode: "open" | "invitation_only";
  reward: string;
  dataTerms: string;
  ipTerms: string;
  support: string;
};
type Candidate = { id: string; name: string; direction: string; cases: { title: string }[] };
type Tip = { id: string; title: string; detail: string; patch: (brief: CreateTaskBrief) => CreateTaskBrief };
type WizardData = { step: number; brief: CreateTaskBrief; invited: string[]; applied: string[] };
type Props = { candidates: Candidate[]; onPublish: (brief: CreateTaskBrief, invited: string[]) => void; onBack?: () => void };

const draftKey = "impulse-customer-task-wizard-v2";
const stages = [
  { title: "Бриф", short: "О задаче", description: "Сформулируйте проблему, ценность и конкретный результат" },
  { title: "Критерии и сроки", short: "Оценка", description: "Определите, по каким признакам решение будет принято" },
  { title: "Формат и данные", short: "Условия", description: "Укажите доступность задачи, данные и права на результат" },
  { title: "Поддержка", short: "Команда", description: "Выберите формат сопровождения и приглашения" },
  { title: "Проверка и публикация", short: "Проверка", description: "Посмотрите на задачу глазами участника" },
] as const;
const departments = ["Розничный бизнес", "Клиентский сервис", "R&D"];
const directions = ["Аналитика данных", "AI / ML", "NLP", "Computer Vision"];
const suggestedSkills = ["Python", "LLM", "AI-агенты", "Аналитика", "Базы данных", "API", "Тестирование", "Архитектура", "RAG", "SQL", "UX/UI"];
const emptyBrief = (): CreateTaskBrief => ({
  title: "", shortSummary: "", skills: [], department: "Розничный бизнес", direction: "Аналитика данных", taskType: "MVP",
  problem: "", deliverable: "", criteria: "",
  deadline: new Date(Date.now() + 28 * 86_400_000).toISOString().slice(0, 10),
  places: 2, mode: "open", reward: "80000",
  dataTerms: "Открытые или обезличенные данные",
  ipTerms: "Условия использования результата согласуются с заказчиком",
  support: "Ментор и еженедельная встреча по прогрессу",
});
function restore(): WizardData {
  const fallback = { step: 0, brief: emptyBrief(), invited: [], applied: [] };
  try {
    const saved = JSON.parse(localStorage.getItem(draftKey) ?? "null") as Partial<WizardData> | null;
    if (!saved || !saved.brief || typeof saved.brief !== "object") return fallback;
    return {
      step: typeof saved.step === "number" && saved.step >= 0 && saved.step < stages.length ? saved.step : 0,
      brief: { ...fallback.brief, ...saved.brief, skills: Array.isArray(saved.brief.skills) ? saved.brief.skills.filter((x): x is string => typeof x === "string").slice(0, 12) : [] },
      invited: Array.isArray(saved.invited) ? saved.invited.filter((id): id is string => typeof id === "string") : [],
      applied: Array.isArray(saved.applied) ? saved.applied.filter((id): id is string => typeof id === "string") : [],
    };
  } catch { return fallback; }
}
function incomplete(brief: CreateTaskBrief, invited: string[]) {
  const result: { title: string; step: number }[] = [];
  if (!brief.title.trim()) result.push({ title: "Название", step: 0 });
  if (!brief.shortSummary.trim()) result.push({ title: "Краткое описание", step: 0 });
  if (!brief.problem.trim()) result.push({ title: "Проблема и цель", step: 0 });
  if (!brief.deliverable.trim()) result.push({ title: "Ожидаемый результат", step: 1 });
  if (!brief.criteria.trim()) result.push({ title: "Критерии приёмки", step: 1 });
  if (!brief.deadline || Number.isNaN(Date.parse(brief.deadline)) || brief.deadline < new Date().toISOString().slice(0, 10)) result.push({ title: "Будущий дедлайн", step: 1 });
  if (!Number.isInteger(brief.places) || brief.places < 1) result.push({ title: "Количество мест", step: 1 });
  if (!brief.dataTerms.trim()) result.push({ title: "Формат и ограничения данных", step: 2 });
  if (!brief.ipTerms.trim()) result.push({ title: "Права на результат", step: 2 });
  if (!brief.support.trim()) result.push({ title: "Формат поддержки", step: 3 });
  if (brief.mode === "invitation_only" && invited.length === 0) result.push({ title: "Приглашённые участники", step: 3 });
  return result;
}
const append = (old: string, text: string) => old.includes(text) ? old : [old.trim(), text].filter(Boolean).join("\n\n");
const tips: Record<number, Tip[]> = {
  0: [
    { id: "audience", title: "Для кого создаётся решение?", detail: "Добавьте аудиторию, которая будет использовать результат", patch: (b) => ({ ...b, problem: append(b.problem, "Целевая аудитория: команда, которая принимает решения по результатам задачи.") }) },
    { id: "demo", title: "Опишите финальную демонстрацию", detail: "Уточните, что участник должен показать заказчику", patch: (b) => ({ ...b, deliverable: append(b.deliverable, "Демонстрация: запуск решения на тестовых данных, показ результата и обсуждение ограничений.") }) },
  ],
  1: [
    { id: "evaluation", title: "Сделайте критерии проверяемыми", detail: "Укажите воспроизводимость и проверку результата", patch: (b) => ({ ...b, criteria: append(b.criteria, "Результат воспроизводится на согласованном тестовом наборе; приложена инструкция запуска и разбор ограничений.") }) },
  ],
  2: [
    { id: "data", title: "Уточните границы данных", detail: "Зафиксируйте формат и безопасный источник", patch: (b) => ({ ...b, dataTerms: append(b.dataTerms, "Формат входных данных: CSV/JSON; использовать только разрешённые обезличенные или тестовые данные.") }) },
  ],
  3: [
    { id: "checkpoints", title: "Добавьте регулярную обратную связь", detail: "Чтобы участник не оставался без ответов", patch: (b) => ({ ...b, support: append(b.support, "Контрольные точки: стартовое обсуждение, промежуточная демонстрация и финальная приёмка.") }) },
  ],
  4: [],
};

export function CustomerCreateTask({ candidates, onPublish, onBack }: Props) {
  const [data, setData] = useState<WizardData>(restore);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [skillSearch, setSkillSearch] = useState("");
  const { step, brief, invited, applied } = data;
  const missing = incomplete(brief, invited);
  const requiredCount = brief.mode === "invitation_only" ? 11 : 10;
  const readiness = Math.round((requiredCount - missing.length) / requiredCount * 100);
  const updateBrief = (patch: Partial<CreateTaskBrief>) => { setData((previous) => ({ ...previous, brief: { ...previous.brief, ...patch } })); setFeedback(""); };
  const goStep = (next: number) => { setData((previous) => ({ ...previous, step: Math.max(0, Math.min(4, next)) })); setFeedback(""); };
  const toggleSkill = (value: string) => {
    const skill = value.trim().slice(0, 36);
    if (!skill) return;
    const exists = brief.skills.some((entry) => entry.toLocaleLowerCase("ru") === skill.toLocaleLowerCase("ru"));
    if (!exists && brief.skills.length >= 12) { setFeedback("Можно выбрать до 12 ключевых навыков."); return; }
    updateBrief({ skills: exists ? brief.skills.filter((entry) => entry.toLocaleLowerCase("ru") !== skill.toLocaleLowerCase("ru")) : [...brief.skills, skill] });
    setSkillSearch("");
  };
  const filteredSkills = suggestedSkills.filter((skill) => skill.toLowerCase().includes(skillSearch.toLowerCase()) && !brief.skills.includes(skill));
  const addSuggestedSkill = () => { toggleSkill(skillSearch); };
  const addFormatting = (format: "bullet" | "number") => {
    updateBrief({ problem: brief.problem.trim() + (brief.problem.trim() ? "\n" : "") + (format === "bullet" ? "• " : "1. ") });
  };
  const toggleInvite = (id: string) => { setData((previous) => ({ ...previous, invited: previous.invited.includes(id) ? previous.invited.filter((value) => value !== id) : [...previous.invited, id] })); };
  const applyTip = (tip: Tip) => {
    setData((previous) => ({ ...previous, brief: tip.patch(previous.brief), applied: [...new Set([...previous.applied, tip.id])] }));
    setFeedback("Подсказка добавлена в бриф. Проверьте формулировку перед публикацией.");
  };
  useEffect(() => {
    try { localStorage.setItem(draftKey, JSON.stringify(data)); } catch { /* Storage may be unavailable. */ }
  }, [data]);
  useEffect(() => {
    if (!previewOpen) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setPreviewOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => { window.removeEventListener("keydown", onKeyDown); };
  }, [previewOpen]);
  const saveDraft = () => {
    try { localStorage.setItem(draftKey, JSON.stringify(data)); setFeedback("Черновик сохранён в этом браузере. Можно вернуться к нему позже."); }
    catch { setFeedback("Не удалось сохранить черновик в браузере. Скопируйте важные данные перед выходом."); }
  };
  const publish = () => {
    if (missing.length > 0) { goStep(missing[0]?.step ?? 0); setFeedback("Заполните обязательные поля перед публикацией."); return; }
    try { localStorage.removeItem(draftKey); } catch { /* Publishing does not depend on local storage. */ }
    onPublish(brief, invited);
  };
  const formatMode = brief.mode === "open" ? "Открытый набор" : "По приглашению";
  return <section className="create-task-workspace customer-create-v2" aria-label="Создание задачи заказчиком" data-reference="R-CUS-03">
    <div className="create-v3-intro">
      {onBack ? <button type="button" className="create-v3-back" onClick={onBack}><ArrowLeft size={14} aria-hidden="true" /> К моим задачам</button> : <span className="create-v3-back">Новая задача</span>}
      <div><span className="create-v3-intro-flag"><Sparkles size={14} /> Новый проект</span><span className="create-v3-autosave"><CheckCircle2 size={14} /> Черновик сохраняется в браузере</span></div>
    </div>
    <nav className="create-stepper" aria-label="Этапы создания задачи">
      {stages.map((stage, index) => <button type="button" key={stage.title} aria-current={step === index ? "step" : undefined} className={step === index ? "active" : index < step ? "done" : ""} onClick={() => { goStep(index); }}>
        <span className="create-v2-step-number">{index < step ? <Check size={15} /> : index + 1}</span>
        <span className="create-v2-step-name"><b>{["Бриф", "Критерии", "Формат", "Поддержка", "Публикация"][index]}</b></span>
      </button>)}
    </nav>
    <div className="create-task-grid">
      <section className="create-form-card" aria-labelledby="create-v2-step-title">
        <div className="create-v2-section-top">
          <span className="create-v2-section-icon"><ClipboardCheck size={19} /></span>
          <span className="create-v2-label">ЭТАП {step + 1} ИЗ 5</span>
          <span className="create-v3-step-pill">Шаг {step + 1} из 5</span>
        </div>
        <div className="create-v2-section-heading">
          <h2 id="create-v2-step-title">{["Основная информация", "Критерии и сроки", "Формат и данные", "Поддержка и коммуникации", "Проверка и публикация"][step]}</h2>
          <p>{["Кратко опишите задачу, чтобы участники понимали контекст и цель", "Объясните, что нужно сдать и как будет проверяться результат", "Какие материалы доступны участникам и каковы ограничения", "Кто поможет участникам во время выполнения", "Проверьте задачу глазами участника перед публикацией"][step]}</p>
        </div>
        {step === 0 && <div className="create-fields create-v3-brief-fields">
          <label className="wide">Название задачи <span className="required">*</span>
            <input value={brief.title} maxLength={120} onChange={(event) => { updateBrief({ title: event.target.value }); }} placeholder="Например, AI-агент для анализа обращений" />
            <small className="create-v3-counter">{brief.title.length}/120</small>
          </label>
          <label className="wide">Краткое описание <span className="required">*</span>
            <textarea rows={2} maxLength={300} value={brief.shortSummary} onChange={(event) => { updateBrief({ shortSummary: event.target.value }); }} placeholder="Опишите задачу в 2–3 предложениях" />
            <small className="create-v3-counter">{brief.shortSummary.length}/300</small>
          </label>
          <div className="wide create-v3-description">
            <label htmlFor="create-v3-description">Подробное описание <span className="required">*</span></label>
            <div className="create-v3-editor">
              <div className="create-v3-toolbar" role="group" aria-label="Форматирование описания">
                <button type="button" onClick={() => { addFormatting("bullet"); }} title="Добавить маркированный список" aria-label="Добавить маркированный список"><List size={16} /></button>
                <button type="button" onClick={() => { addFormatting("number"); }} title="Добавить нумерованный список" aria-label="Добавить нумерованный список"><ListOrdered size={16} /></button>
                <span>Поддерживаются списки и переносы строк</span>
              </div>
              <textarea id="create-v3-description" rows={5} maxLength={2000} value={brief.problem} onChange={(event) => { updateBrief({ problem: event.target.value }); }} placeholder="Добавьте детали, контекст, текущие ограничения и ожидаемый эффект" />
            </div>
            <small className="create-v3-counter">{brief.problem.length}/2000</small>
          </div>
          <label>Категория <span className="required">*</span><select value={brief.taskType} onChange={(event) => { updateBrief({ taskType: event.target.value }); }}>{["MVP", "R&D", "Исследование"].map((entry) => <option key={entry} value={entry}>{entry}</option>)}</select></label>
          <label>Направление <span className="required">*</span><select value={brief.direction} onChange={(event) => { updateBrief({ direction: event.target.value }); }}>{directions.map((entry) => <option key={entry} value={entry}>{entry}</option>)}</select></label>
          <label className="wide">Подразделение <select value={brief.department} onChange={(event) => { updateBrief({ department: event.target.value }); }}>{departments.map((entry) => <option key={entry} value={entry}>{entry}</option>)}</select></label>
          <div className="wide create-v3-skills">
            <label htmlFor="create-v3-skill-input">Ключевые навыки</label>
            <div className="create-v3-skill-search"><Search size={16} /><input id="create-v3-skill-input" value={skillSearch} maxLength={36} onChange={(event) => { setSkillSearch(event.target.value); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addSuggestedSkill(); } }} placeholder="Поиск или добавление навыка…" />{skillSearch.trim() && <button type="button" onClick={addSuggestedSkill} aria-label="Добавить навык"><Plus size={17} /></button>}</div>
            <p>Рекомендуемые навыки</p>
            <div className="create-v3-skill-chips" aria-label="Выберите навыки">{filteredSkills.slice(0, 9).map((skill) => <button type="button" key={skill} onClick={() => { toggleSkill(skill); }}><Plus size={13} /> {skill}</button>)}</div>
            {brief.skills.length > 0 && <div className="create-v3-selected-skills" aria-label="Выбранные навыки">{brief.skills.map((skill) => <button type="button" key={skill} onClick={() => { toggleSkill(skill); }} aria-label={`Удалить навык ${skill}`}>{skill} <X size={13} /></button>)}</div>}
          </div>
        </div>}
        {step === 1 && <div className="create-fields">
          <div className="create-v2-inline-note wide"><FileText size={18} /><span>Критерии должны позволять объективно проверить результат, а не оценивать только впечатление от презентации.</span></div>
          <label className="wide">Ожидаемый результат <span className="required">*</span><textarea rows={4} value={brief.deliverable} onChange={(event) => { updateBrief({ deliverable: event.target.value }); }} placeholder="Что нужно передать: код, API, демо, отчёт, инструкции, метрики?" /><small className="create-v2-field-help">Укажите конечные артефакты, которые проверит заказчик</small></label>
          <label className="wide">Критерии приёмки <span className="required">*</span><textarea rows={7} value={brief.criteria} onChange={(event) => { updateBrief({ criteria: event.target.value }); }} placeholder={"Каждый критерий с новой строки. Например:\n• Рабочий прототип запускается по инструкции\n• Точность не ниже согласованного порога\n• Приложен отчёт об ошибках"} /><small className="create-v2-field-help">Один критерий — одна проверяемая характеристика</small></label>
          <label>Дедлайн <span className="required">*</span><input type="date" min={new Date().toISOString().slice(0, 10)} value={brief.deadline} onChange={(event) => { updateBrief({ deadline: event.target.value }); }} /></label>
          <label>Количество мест <span className="required">*</span><input type="number" min="1" step="1" value={brief.places} onChange={(event) => { updateBrief({ places: Number(event.target.value) }); }} /><small className="create-v2-field-help">Сколько участников может выполнять задачу</small></label>
        </div>}
        {step === 2 && <div className="create-fields">
          <fieldset className="create-v2-choice-group wide"><legend>Кто может откликнуться</legend><div className="task-type-picker create-v2-mode-picker">{[["open", "Открытая задача", "Участники могут сами выбрать задачу"], ["invitation_only", "По приглашению", "Вы сами выбираете участников"]].map(([kind, title, description]) => <button type="button" key={kind} aria-pressed={brief.mode === kind} className={brief.mode === kind ? "active" : ""} onClick={() => { updateBrief({ mode: kind as CreateTaskBrief["mode"] }); }}><b>{title}</b><small>{description}</small></button>)}</div></fieldset>
          <label className="wide">Данные и ограничения <span className="required">*</span><textarea rows={4} value={brief.dataTerms} onChange={(event) => { updateBrief({ dataTerms: event.target.value }); }} placeholder="Источник и формат данных, требования к доступу и конфиденциальности" /><small className="create-v2-field-help">Не размещайте реальные конфиденциальные данные в описании задачи</small></label>
          <label className="wide">Права на результат <span className="required">*</span><textarea rows={3} value={brief.ipTerms} onChange={(event) => { updateBrief({ ipTerms: event.target.value }); }} placeholder="Кому доступны артефакты, можно ли показывать результат в портфолио" /></label>
        </div>}
        {step === 3 && <div className="create-fields">
          <label className="wide">Модель поддержки <span className="required">*</span><textarea rows={4} value={brief.support} onChange={(event) => { updateBrief({ support: event.target.value }); }} placeholder="Ментор, сроки ответа, регулярные встречи, каналы связи" /><small className="create-v2-field-help">Опишите, кто помогает исполнителю и как быстро он сможет получить ответ</small></label>
          <fieldset className="create-v2-invites wide"><legend>Пригласить участников <span>{brief.mode === "open" ? "необязательно" : "обязательно"}</span></legend>
            <p>Список участников с завершёнными кейсами. В демонстрации выбор участников сохраняется в браузере. Реальная отправка приглашений требует серверного подключения.</p>
            <div className="create-v2-candidate-list">{candidates.filter((person) => person.cases.length > 0).map((person) => <label key={person.id} className="create-v2-candidate"><input type="checkbox" checked={invited.includes(person.id)} onChange={() => { toggleInvite(person.id); }} /><span className="create-v2-avatar">{person.name.split(" ").slice(0, 2).map((part) => part[0]).join("")}</span><span><strong>{person.name}</strong><small>{person.direction === brief.direction ? "Совпадает с направлением" : person.direction} · {person.cases[0]?.title}</small></span></label>)}</div>
          </fieldset>
        </div>}
        {step === 4 && <div className="create-v2-review">
          <div className="create-v2-review-intro"><span className={missing.length ? "create-v2-review-status is-warning" : "create-v2-review-status"}>{missing.length ? <CircleAlert size={20} /> : <CheckCircle2 size={20} />}</span><div><h3>{missing.length ? "Остались обязательные поля" : "Бриф готов к публикации"}</h3><p>{missing.length ? "Заполните недостающую информацию, прежде чем открывать задачу участникам." : "Проверьте содержание и при необходимости вернитесь к любому этапу."}</p></div></div>
          <p className="create-v2-aside-sub">Демонстрационный режим: сохранённую задачу пока нельзя увидеть из аккаунта другого участника. Сквозная публикация будет подключена через API.</p><div className="create-summary">
            {[["Задача", brief.title || "Не указано", 0], ["Краткое описание", brief.shortSummary || "Не указано", 0], ["Навыки", brief.skills.join(" · ") || "Не выбраны", 0], ["Тип и направление", brief.taskType + " · " + brief.direction, 0], ["Проблема и цель", brief.problem || "Не указано", 0], ["Результат", brief.deliverable || "Не указано", 0], ["Критерии", brief.criteria || "Не указано", 1], ["Срок и команда", brief.deadline + " · " + String(brief.places) + " мест", 1], ["Доступ", formatMode, 2], ["Данные", brief.dataTerms || "Не указаны", 2], ["Сопровождение", brief.support || "Не указано", 3]].map(([title, value, target]) => <button type="button" key={String(title)} className="create-v2-summary-item" onClick={() => { goStep(Number(target)); }}><small>{title}</small><strong>{value}</strong><span>Изменить <ArrowRight size={13} /></span></button>)}
          </div>
          {missing.length > 0 && <div className="create-v2-missing" role="status"><strong>Нужно дополнить</strong><div>{missing.map((item) => <button key={item.title} type="button" onClick={() => { goStep(item.step); }}>{item.title} <ArrowRight size={13} /></button>)}</div></div>}
        </div>}
        <footer className="create-actions">
          <div className="create-v3-primary-actions">
            {step > 0 && <button type="button" className="create-v2-back" onClick={() => { goStep(step - 1); }}><ArrowLeft size={16} /> Назад</button>}
            <button type="button" onClick={saveDraft}><Save size={16} /> Сохранить черновик</button>
            {step < 4 ? <button type="button" className="primary" onClick={() => { goStep(step + 1); }}>Далее <ArrowRight size={17} /></button> : <button type="button" className="primary" disabled={missing.length > 0} onClick={publish}><CheckCircle2 size={18} /> Опубликовать</button>}
          </div>
        </footer>
      </section>
      <aside className="create-v3-right" aria-label="Предпросмотр и помощь">
        <section className="create-v3-preview-card">
          <header><div><h3>Предпросмотр</h3><p>Как увидят участники</p></div><Eye size={17} /></header>
          <div className="create-v3-preview-art" aria-hidden="true"><span className="create-v3-art-ring" /><span className="create-v3-art-layer create-v3-art-layer--back" /><span className="create-v3-art-layer create-v3-art-layer--front"><Sparkles size={38} /></span></div>
          <div className="create-v3-preview-content">
            <h4>{brief.title.trim() || "Здесь появится название задачи"}</h4>
            {brief.shortSummary.trim() && <p className="create-v3-preview-excerpt">{brief.shortSummary}</p>}
            <div className="create-v3-preview-tags"><span>{brief.taskType}</span><span>{brief.direction}</span></div>
            <dl>
              <div><dt><UsersRound size={16} /> Подразделение</dt><dd>{brief.department}</dd></div>
              <div><dt><Sparkles size={16} /> Навыки</dt><dd>{brief.skills.length ? brief.skills.slice(0, 4).join(" · ") : "Не выбраны"}</dd></div>
              <div><dt><CalendarDays size={16} /> Сроки</dt><dd>{brief.deadline ? new Date(brief.deadline + "T12:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" }) : "Не указаны"}</dd></div>
              <div><dt><ClipboardCheck size={16} /> Формат</dt><dd>{formatMode} · {brief.places} мест</dd></div>
            </dl>
            <button type="button" onClick={() => { setPreviewOpen(true); }}>Открыть полный предпросмотр <ArrowRight size={14} /></button>
          </div>
        </section>
        <section className="create-v3-advice-card">
          <div className="create-v3-advice-title"><Lightbulb size={20} /><strong>Совет по постановке</strong></div>
          <p>{step === 0 ? "Добавьте конкретный пример ожидаемого результата — это поможет участникам понять задачу и оценить сложность." : step === 1 ? "Укажите метрики и условия проверки — так участник заранее узнает, что означает успешная сдача." : step === 2 ? "Уточните формат и источник данных, чтобы участники могли оценить ограничения до начала работы." : step === 3 ? "Назовите ответственного за обратную связь и установите регулярные контрольные точки." : "Проверьте условия, которые увидит участник, до окончательной публикации."}</p>
          {(tips[step] ?? []).map((tip) => <button type="button" key={tip.id} disabled={applied.includes(tip.id)} onClick={() => { applyTip(tip); }}>{applied.includes(tip.id) ? "✓ Добавлено в бриф" : "Добавить рекомендацию"} <ArrowRight size={13} /></button>)}
        </section>
        <section className="create-v3-progress-card">
          <div><span>Заполнено обязательных полей</span><strong>{readiness}%</strong></div>
          <div className="create-v3-readiness-track" role="progressbar" aria-label="Заполненные обязательные поля" aria-valuenow={readiness} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${String(readiness)}%` }} /></div>
          {missing.length ? <button type="button" onClick={() => { goStep(missing[0]?.step ?? 0); }}><CircleAlert size={14} /> Дополнить: {missing[0]?.title}</button> : <p><CheckCircle2 size={14} /> Все обязательные поля готовы</p>}
        </section>
      </aside>
    </div>
    {feedback && <p className="create-v2-feedback" role="status">{feedback}</p>}
    <div className="create-v3-next-steps" aria-label="Другие разделы создания задачи">
      {stages.map((stage, index) => index === step ? null : <button type="button" key={stage.title} onClick={() => { goStep(index); }}>
        <span className="create-v3-card-index">{index + 1}</span>
        <span className="create-v3-card-text"><strong>{["Основная информация", "Критерии и сроки", "Формат и данные", "Поддержка и коммуникации", "Публикация"][index]}</strong><small>{stage.description}</small></span>
        <ChevronRight size={18} />
      </button>)}
    </div>
    {previewOpen && <div className="create-v2-modal-backdrop"><section className="create-v2-modal" role="dialog" aria-modal="true" aria-labelledby="create-v2-preview-title">
      <header><span className="create-v2-kicker"><Eye size={16} /> Предпросмотр участника</span><button type="button" aria-label="Закрыть предпросмотр" onClick={() => { setPreviewOpen(false); }}><X size={20} /></button></header>
      <div className="create-v2-modal-content"><span className="create-v2-mini-type">{brief.taskType} · {brief.direction}</span><h2 id="create-v2-preview-title">{brief.title || "Название ещё не задано"}</h2><p className="create-v2-modal-meta">{formatMode} · {brief.department} · {brief.deadline || "Без срока"} · {brief.places} мест</p>
        <h3>Краткое описание</h3><p>{brief.shortSummary || "Пока не заполнено"}</p><h3>Задача и цель</h3><p>{brief.problem || "Описание пока не заполнено"}</p>
        <h3>Что требуется на выходе</h3><p>{brief.deliverable || "Результат пока не описан"}</p>
        <h3>Критерии приёмки</h3><p>{brief.criteria || "Критерии пока не опубликованы"}</p>
        <h3>Данные и поддержка</h3><p>{brief.dataTerms}; {brief.support}</p>
      </div><footer><span>Это предварительный просмотр, задача ещё не опубликована</span><button type="button" onClick={() => { setPreviewOpen(false); }}>Вернуться к редактированию</button></footer>
    </section></div>}
  </section>;
}
