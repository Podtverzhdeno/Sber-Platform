import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, CircleAlert, ClipboardCheck, Eye, FileText, Lightbulb, Save, ShieldCheck, Sparkles, UsersRound, X } from "lucide-react";
import "./customer-create-task.scss";

export type CreateTaskBrief = {
  title: string;
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
type Props = { candidates: Candidate[]; onPublish: (brief: CreateTaskBrief, invited: string[]) => void };

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
const emptyBrief = (): CreateTaskBrief => ({
  title: "", department: "Розничный бизнес", direction: "Аналитика данных", taskType: "MVP",
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
      brief: { ...fallback.brief, ...saved.brief },
      invited: Array.isArray(saved.invited) ? saved.invited.filter((id): id is string => typeof id === "string") : [],
      applied: Array.isArray(saved.applied) ? saved.applied.filter((id): id is string => typeof id === "string") : [],
    };
  } catch { return fallback; }
}
function incomplete(brief: CreateTaskBrief, invited: string[]) {
  const result: { title: string; step: number }[] = [];
  if (!brief.title.trim()) result.push({ title: "Название", step: 0 });
  if (!brief.problem.trim()) result.push({ title: "Проблема и цель", step: 0 });
  if (!brief.deliverable.trim()) result.push({ title: "Ожидаемый результат", step: 0 });
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

export function CustomerCreateTask({ candidates, onPublish }: Props) {
  const [data, setData] = useState<WizardData>(restore);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const { step, brief, invited, applied } = data;
  const missing = incomplete(brief, invited);
  const requiredCount = brief.mode === "invitation_only" ? 10 : 9;
  const readiness = Math.round((requiredCount - missing.length) / requiredCount * 100);
  const updateBrief = (patch: Partial<CreateTaskBrief>) => { setData((previous) => ({ ...previous, brief: { ...previous.brief, ...patch } })); setFeedback(""); };
  const goStep = (next: number) => { setData((previous) => ({ ...previous, step: Math.max(0, Math.min(4, next)) })); setFeedback(""); };
  const toggleInvite = (id: string) => setData((previous) => ({ ...previous, invited: previous.invited.includes(id) ? previous.invited.filter((value) => value !== id) : [...previous.invited, id] }));
  const applyTip = (tip: Tip) => {
    setData((previous) => ({ ...previous, brief: tip.patch(previous.brief), applied: [...new Set([...previous.applied, tip.id])] }));
    setFeedback("Подсказка добавлена в бриф. Проверьте формулировку перед публикацией.");
  };
  useEffect(() => {
    try { localStorage.setItem(draftKey, JSON.stringify(data)); } catch { /* Storage may be unavailable. */ }
  }, [data]);
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
    <header className="create-v2-hero">
      <div className="create-v2-hero-top"><span className="create-v2-kicker"><Sparkles size={15} /> Конструктор задач</span><span className="create-v2-autosave"><CheckCircle2 size={15} /> Автосохранение в браузере</span></div>
      <div className="create-v2-hero-main"><div><h2>От идеи до понятной задачи</h2><p>Соберите бриф, который поможет участнику оценить сложность, подготовить решение и понять критерии приёмки.</p></div><div className="create-v2-hero-count"><strong>0{step + 1}<small>/ 05</small></strong><span>Текущий этап</span></div></div>
      <div className="create-v2-progress" role="progressbar" aria-label="Этап заполнения" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={5}><span style={{ width: String((step + 1) * 20) + "%" }} /></div>
    </header>
    <nav className="create-stepper" aria-label="Этапы создания задачи">
      {stages.map((stage, index) => <button type="button" key={stage.title} aria-current={step === index ? "step" : undefined} className={step === index ? "active" : index < step ? "done" : ""} onClick={() => goStep(index)}>
        <span className="create-v2-step-number">{index < step ? <Check size={15} /> : String(index + 1).padStart(2, "0")}</span>
        <span className="create-v2-step-name"><b>{stage.title}</b><small>{stage.short}</small></span>
      </button>)}
    </nav>
    <div className="create-task-grid">
      <section className="create-form-card" aria-labelledby="create-v2-step-title">
        <div className="create-v2-section-top"><span className="create-v2-section-icon"><ClipboardCheck size={22} /></span><span className="create-v2-label">ЭТАП {step + 1} ИЗ 5</span></div>
        <div className="create-v2-section-heading"><h2 id="create-v2-step-title">{["Расскажите о задаче", "Как понять, что задача решена", "Условия работы", "Поддержка и участники", "Всё готово к публикации?"][step]}</h2><p>{stages[step]?.description}</p></div>
        {step === 0 && <div className="create-fields">
          <label className="wide">Название задачи <span className="required">*</span><input value={brief.title} maxLength={140} onChange={(event) => updateBrief({ title: event.target.value })} placeholder="Например, AI-агент для анализа обращений" /><small className="create-v2-field-help">Конкретное название лучше привлекает релевантных участников · {brief.title.length}/140</small></label>
          <fieldset className="create-v2-choice-group wide"><legend>Тип задачи</legend><div className="task-type-picker">{[["R&D", "Проверить гипотезу", "01"], ["MVP", "Создать прототип", "02"], ["Исследование", "Разобраться в подходах", "03"]].map(([kind, description, number]) => <button key={kind} type="button" aria-pressed={brief.taskType === kind} className={brief.taskType === kind ? "active" : ""} onClick={() => updateBrief({ taskType: kind })}><span>{number}</span><b>{kind}</b><small>{description}</small></button>)}</div></fieldset>
          <label>Подразделение<select value={brief.department} onChange={(event) => updateBrief({ department: event.target.value })}>{departments.map((entry) => <option key={entry} value={entry}>{entry}</option>)}</select></label>
          <label>Направление<select value={brief.direction} onChange={(event) => updateBrief({ direction: event.target.value })}>{directions.map((entry) => <option key={entry} value={entry}>{entry}</option>)}</select></label>
          <label className="wide">Проблема и цель <span className="required">*</span><textarea rows={4} value={brief.problem} onChange={(event) => updateBrief({ problem: event.target.value })} placeholder="Что сейчас не работает, почему это важно и какое изменение нужно получить?" /><small className="create-v2-field-help">Сформулируйте проблему, а не только перечень технологий</small></label>
          <label className="wide">Ожидаемый результат <span className="required">*</span><textarea rows={4} value={brief.deliverable} onChange={(event) => updateBrief({ deliverable: event.target.value })} placeholder="Что нужно передать: код, API, демо, отчёт, инструкции, метрики?" /><small className="create-v2-field-help">Участник должен понимать, что именно нужно сдать</small></label>
        </div>}
        {step === 1 && <div className="create-fields">
          <div className="create-v2-inline-note wide"><FileText size={18} /><span>Критерии должны позволять объективно проверить результат, а не оценивать только впечатление от презентации.</span></div>
          <label className="wide">Критерии приёмки <span className="required">*</span><textarea rows={7} value={brief.criteria} onChange={(event) => updateBrief({ criteria: event.target.value })} placeholder={"Каждый критерий с новой строки. Например:\n• Рабочий прототип запускается по инструкции\n• Точность не ниже согласованного порога\n• Приложен отчёт об ошибках"} /><small className="create-v2-field-help">Один критерий — одна проверяемая характеристика. Укажите метрику и условия проверки, если они известны</small></label>
          <label>Дедлайн <span className="required">*</span><input type="date" min={new Date().toISOString().slice(0, 10)} value={brief.deadline} onChange={(event) => updateBrief({ deadline: event.target.value })} /></label>
          <label>Количество мест <span className="required">*</span><input type="number" min="1" step="1" value={brief.places} onChange={(event) => updateBrief({ places: Number(event.target.value) })} /><small className="create-v2-field-help">Сколько участников может выполнять задачу</small></label>
        </div>}
        {step === 2 && <div className="create-fields">
          <fieldset className="create-v2-choice-group wide"><legend>Кто может откликнуться</legend><div className="task-type-picker create-v2-mode-picker">{[["open", "Открытая задача", "Участники могут сами выбрать задачу"], ["invitation_only", "По приглашению", "Вы сами выбираете участников"]].map(([kind, title, description]) => <button type="button" key={kind} aria-pressed={brief.mode === kind} className={brief.mode === kind ? "active" : ""} onClick={() => updateBrief({ mode: kind as CreateTaskBrief["mode"] })}><b>{title}</b><small>{description}</small></button>)}</div></fieldset>
          <label className="wide">Данные и ограничения <span className="required">*</span><textarea rows={4} value={brief.dataTerms} onChange={(event) => updateBrief({ dataTerms: event.target.value })} placeholder="Источник и формат данных, требования к доступу и конфиденциальности" /><small className="create-v2-field-help">Не размещайте реальные конфиденциальные данные в описании задачи</small></label>
          <label className="wide">Права на результат <span className="required">*</span><textarea rows={3} value={brief.ipTerms} onChange={(event) => updateBrief({ ipTerms: event.target.value })} placeholder="Кому доступны артефакты, можно ли показывать результат в портфолио" /></label>
        </div>}
        {step === 3 && <div className="create-fields">
          <label className="wide">Модель поддержки <span className="required">*</span><textarea rows={4} value={brief.support} onChange={(event) => updateBrief({ support: event.target.value })} placeholder="Ментор, сроки ответа, регулярные встречи, каналы связи" /><small className="create-v2-field-help">Опишите, кто помогает исполнителю и как быстро он сможет получить ответ</small></label>
          <fieldset className="create-v2-invites wide"><legend>Пригласить участников <span>{brief.mode === "open" ? "необязательно" : "обязательно"}</span></legend>
            <p>Список участников с завершёнными кейсами. Адресные приглашения отправляются после публикации задачи.</p>
            <div className="create-v2-candidate-list">{candidates.filter((person) => person.cases.length > 0).map((person) => <label key={person.id} className="create-v2-candidate"><input type="checkbox" checked={invited.includes(person.id)} onChange={() => toggleInvite(person.id)} /><span className="create-v2-avatar">{person.name.split(" ").slice(0, 2).map((part) => part[0]).join("")}</span><span><strong>{person.name}</strong><small>{person.direction === brief.direction ? "Совпадает с направлением" : person.direction} · {person.cases[0]?.title}</small></span></label>)}</div>
          </fieldset>
        </div>}
        {step === 4 && <div className="create-v2-review">
          <div className="create-v2-review-intro"><span className={missing.length ? "create-v2-review-status is-warning" : "create-v2-review-status"}>{missing.length ? <CircleAlert size={20} /> : <CheckCircle2 size={20} />}</span><div><h3>{missing.length ? "Остались обязательные поля" : "Бриф готов к публикации"}</h3><p>{missing.length ? "Заполните недостающую информацию, прежде чем открывать задачу участникам." : "Проверьте содержание и при необходимости вернитесь к любому этапу."}</p></div></div>
          <div className="create-summary">
            {[["Задача", brief.title || "Не указано", 0], ["Тип и направление", brief.taskType + " · " + brief.direction, 0], ["Проблема и цель", brief.problem || "Не указано", 0], ["Результат", brief.deliverable || "Не указано", 0], ["Критерии", brief.criteria || "Не указано", 1], ["Срок и команда", brief.deadline + " · " + String(brief.places) + " мест", 1], ["Доступ", formatMode, 2], ["Данные", brief.dataTerms || "Не указаны", 2], ["Сопровождение", brief.support || "Не указано", 3]].map(([title, value, target]) => <button type="button" key={String(title)} className="create-v2-summary-item" onClick={() => goStep(Number(target))}><small>{title}</small><strong>{value}</strong><span>Изменить <ArrowRight size={13} /></span></button>)}
          </div>
          {missing.length > 0 && <div className="create-v2-missing" role="status"><strong>Нужно дополнить</strong><div>{missing.map((item) => <button key={item.title} type="button" onClick={() => goStep(item.step)}>{item.title} <ArrowRight size={13} /></button>)}</div></div>}
        </div>}
      </section>
      <aside className="create-ai-panel" aria-label="Помощь при создании задачи">
        <div className="create-v2-readiness-head"><span className="create-v2-assistant-icon"><Sparkles size={20} /></span><span className="create-v2-readiness-label">КАЧЕСТВО ПОСТАНОВКИ</span></div>
        <h3>Бриф под контролем</h3>
        <p className="create-v2-aside-sub">Заполнение обязательных полей</p>
        <div className="create-v2-readiness-value"><strong>{readiness}%</strong><span>{requiredCount - missing.length} из {requiredCount}</span></div>
        <div className="create-v2-readiness-track" role="progressbar" aria-label="Заполненные обязательные поля" aria-valuemin={0} aria-valuemax={100} aria-valuenow={readiness}><span style={{ width: String(readiness) + "%" }} /></div>
        {missing.length === 0 ? <p className="create-v2-checked"><Check size={16} /> Все обязательные поля заполнены</p> : <button type="button" className="create-v2-next-missing" onClick={() => goStep(missing[0]?.step ?? 0)}><CircleAlert size={16} /> Дополнить: {missing[0]?.title} <ArrowRight size={14} /></button>}
        <div className="create-v2-aside-divider" />
        <div className="create-v2-aside-heading"><Lightbulb size={17} /><h4>Подсказки по этапу</h4></div>
        {(tips[step] ?? []).length > 0 ? <div className="create-v2-tips">{(tips[step] ?? []).map((tip) => <div className="create-v2-tip" key={tip.id}><strong>{tip.title}</strong><p>{tip.detail}</p><button type="button" disabled={applied.includes(tip.id)} onClick={() => applyTip(tip)}>{applied.includes(tip.id) ? "✓ Добавлено" : "Добавить в бриф"} <ArrowRight size={14} /></button></div>)}</div> : <p className="create-v2-aside-sub">На этом этапе проверьте итоговое описание и доступность данных.</p>}
        <div className="create-v2-aside-divider" />
        <div className="create-v2-aside-heading"><Eye size={17} /><h4>Как увидит участник</h4></div>
        <div className="create-v2-mini-preview"><span className="create-v2-mini-type">{brief.taskType} · {brief.direction}</span><strong>{brief.title.trim() || "Название вашей задачи"}</strong><p>{brief.deliverable.trim() || "Здесь появится ожидаемый результат"}</p><span><UsersRound size={14} /> {brief.places > 0 ? brief.places : "—"} мест · {formatMode}</span></div>
        <p className="create-v2-aside-foot"><ShieldCheck size={16} /> Подсказки добавляются только по вашему нажатию. Окончательную постановку утверждает заказчик.</p>
      </aside>
    </div>
    {feedback && <p className="create-v2-feedback" role="status">{feedback}</p>}
    <footer className="create-actions">
      <span className="create-v2-footer-save"><CheckCircle2 size={16} /> Сохраняется при заполнении</span>
      <div className="create-v2-footer-buttons">
        {step > 0 && <button type="button" className="create-v2-back" onClick={() => goStep(step - 1)}><ArrowLeft size={16} /> Назад</button>}
        <button type="button" onClick={saveDraft}><Save size={16} /> Сохранить черновик</button>
        <button type="button" onClick={() => setPreviewOpen(true)}><Eye size={16} /> Предпросмотр</button>
        {step < 4 ? <button type="button" className="primary" onClick={() => goStep(step + 1)}>Продолжить <ArrowRight size={17} /></button> : <button type="button" className="primary" disabled={missing.length > 0} onClick={publish}><CheckCircle2 size={18} /> Опубликовать</button>}
      </div>
    </footer>
    {previewOpen && <div className="create-v2-modal-backdrop"><section className="create-v2-modal" role="dialog" aria-modal="true" aria-labelledby="create-v2-preview-title">
      <header><span className="create-v2-kicker"><Eye size={16} /> Предпросмотр участника</span><button type="button" aria-label="Закрыть предпросмотр" onClick={() => setPreviewOpen(false)}><X size={20} /></button></header>
      <div className="create-v2-modal-content"><span className="create-v2-mini-type">{brief.taskType} · {brief.direction}</span><h2 id="create-v2-preview-title">{brief.title || "Название ещё не задано"}</h2><p className="create-v2-modal-meta">{formatMode} · {brief.department} · {brief.deadline || "Без срока"} · {brief.places} мест</p>
        <h3>Задача и цель</h3><p>{brief.problem || "Описание пока не заполнено"}</p>
        <h3>Что требуется на выходе</h3><p>{brief.deliverable || "Результат пока не описан"}</p>
        <h3>Критерии приёмки</h3><p>{brief.criteria || "Критерии пока не опубликованы"}</p>
        <h3>Данные и поддержка</h3><p>{brief.dataTerms}; {brief.support}</p>
      </div><footer><span>Это предварительный просмотр, задача ещё не опубликована</span><button type="button" onClick={() => setPreviewOpen(false)}>Вернуться к редактированию</button></footer>
    </section></div>}
  </section>;
}
