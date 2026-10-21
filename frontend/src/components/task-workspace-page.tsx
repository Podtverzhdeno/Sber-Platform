import { useEffect, useState, type ReactNode } from "react";

import { PlatformsSection } from "../features/platforms";

type WorkspaceMode = "customer" | "participant";

type TaskWorkspacePageProps = {
  mode: WorkspaceMode;
  title: string;
  taskId: string;
  projectId?: string;
  description: string;
  deadline: string;
  tags: string[];
  onMessage: () => void;
  onPrimaryAction: () => void;
  workspace?: WorkspaceSnapshot;
  quickCard?: TeamQuickCard | null;
  quickCardLoading?: boolean;
  quickCardError?: boolean;
  onSelectMember?: (personId: string) => void;
  onCloseQuickCard?: () => void;
  onOpenProfile?: (personId: string) => void;
  onOpenDirectMessage?: (personId: string) => void;
};

export type TeamQuickCard = {
  person_id: string;
  task_id: string;
  assignment_status: string | null;
  contribution_status: string | null;
  availability: string;
  project_role: string;
  responsibility: string;
  display_name: string;
  portfolio_available: boolean;
  profile: { city: string | null; university: string | null; telegram: string | null; about: string | null; skills: { title: string; origin: string; verified: boolean }[] };
};

export type WorkspaceSnapshot = {
  team: { person_id: string; display_name: string; status: string }[];
  checkpoints: { key: string; title: string; status: string }[];
  contributions: { id: string; version: number; personal_summary: string; artifact_keys: string[]; status: string }[];
  feedback: { contribution_id: string; contribution_version: number; review_version: number; grade: string; explanation: string; status: string }[];
  freshness: string;
};

const milestones = [
  ["Исследование", "Требования и сценарии", "done"],
  ["Прототип", "Базовая модель", "done"],
  ["Интеграция", "API и интерфейс", "active"],
  ["Тестирование", "Метрики качества", "pending"],
  ["Защита", "Итоговый результат", "pending"],
] as const;

const members = [
  ["НС", "Никита Соколов", "NLP Engineer"],
  ["АМ", "Анна Морозова", "Data Scientist"],
  ["ДК", "Дмитрий Козлов", "Backend"],
  ["АК", "Анна Климова", "Ментор"],
] as const;

const sectionStorageKey = (taskId: string) => `impulse_workspace_sections_${taskId}`;

function readStoredSection(taskId: string, id: string): boolean {
  try {
    const raw = localStorage.getItem(sectionStorageKey(taskId));
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return parsed[id] === true;
  } catch {
    return false;
  }
}

const persistSection = (taskId: string, id: string, collapsed: boolean) => {
  try {
    const raw = localStorage.getItem(sectionStorageKey(taskId));
    const parsed: Record<string, boolean> = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    parsed[id] = collapsed;
    localStorage.setItem(sectionStorageKey(taskId), JSON.stringify(parsed));
  } catch {
    /* Нет доступа к localStorage — состояние остаётся только на экране */
  }
};

type WorkspaceCardProps = {
  taskId: string;
  id: string;
  eyebrow: string;
  title: string;
  aside?: ReactNode;
  hideAsideWhenCollapsed?: boolean;
  className?: string;
  children: ReactNode;
};

function WorkspaceCard({ taskId, id, eyebrow, title, aside, hideAsideWhenCollapsed = false, className, children }: WorkspaceCardProps) {
  const [collapsed, setCollapsed] = useState(() => readStoredSection(taskId, id));
  useEffect(() => {
    persistSection(taskId, id, collapsed);
  }, [collapsed, id, taskId]);
  const bodyId = `ctw-body-${id}`;
  const toggle = () => { setCollapsed((current) => !current); };
  return <section className={className === undefined ? "ctw-card" : `ctw-card ${className}`}>
    <header className="ctw-section-head">
      <div><small>{eyebrow}</small><h2><button className="ctw-section-toggle" type="button" aria-expanded={!collapsed} aria-controls={bodyId} onClick={toggle}>{title}<span className="ctw-chevron" aria-hidden="true">{collapsed ? "▸" : "▾"}</span></button></h2></div>
      {aside !== undefined && <aside className="ctw-section-aside" hidden={hideAsideWhenCollapsed && collapsed}>{aside}</aside>}
    </header>
    <div className="ctw-section-body" id={bodyId} hidden={collapsed}>{children}</div>
  </section>;
}

export function TaskWorkspacePage({ mode, title, taskId, projectId, description, deadline, tags, onMessage, onPrimaryAction, workspace, quickCard, quickCardLoading = false, quickCardError = false, onSelectMember, onCloseQuickCard, onOpenProfile, onOpenDirectMessage }: TaskWorkspacePageProps) {
  const customer = mode === "customer";
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState("Обзор");
  const [uploadedFiles, setUploadedFiles] = useState(["solution-v2.zip", "Отчёт по качеству.pdf"]);
  const [fullHistory, setFullHistory] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<"stages" | "artifacts" | "blockers" | "feedback" | null>(null);
  const completedStatuses = new Set(["done", "completed", "accepted", "verified"]);
  const completedCheckpoints = workspace?.checkpoints.filter((item) => completedStatuses.has(item.status)) ?? [];
  const remainingCheckpoints = workspace?.checkpoints.filter((item) => !completedStatuses.has(item.status)) ?? [];
  const artifacts = workspace?.contributions.flatMap((item) => item.artifact_keys.map((key) => ({ key, version: item.version, status: item.status, contributionId: item.id }))) ?? [];
  const blockers = workspace?.checkpoints.filter((item) => item.status === "blocked") ?? [];
  const pendingFeedback = workspace?.feedback.filter((item) => item.status !== "published" && item.status !== "accepted") ?? [];
  const liveMembers = workspace?.team ?? members.map(([initials, display_name, status]) => ({ person_id: display_name, display_name: `${initials} · ${display_name}`, status }));
  const openTab = (label:string,target:string) => { setTab(label); document.getElementById(target)?.scrollIntoView({ behavior:"smooth", block:"start" }); };
  return <div className="ctw-page">
    <header className="ctw-header">
      <div><div className="ctw-overline"><i/>В РАБОТЕ <span>{taskId}</span></div><h1>{title}</h1><p>{description}</p><div className="ctw-meta">{tags.map(tag=><span key={tag}>{tag}</span>)}<em/>Старт: 14 апр. <b>Дедлайн: {deadline}</b></div></div>
      <div className="ctw-header-actions"><button type="button" onClick={onMessage}>{customer ? "Написать команде" : "Открыть чат команды"}</button><button type="button" onClick={()=>{onPrimaryAction();if(!customer)setNotice("Черновик новой версии подготовлен. Добавьте файлы и отправьте результат.");}}>{customer ? "Оставить комментарий" : "Загрузить новую версию"}</button></div>
    </header>
    {notice&&<div className="ctw-notice" role="status">{notice}<button type="button" onClick={()=>{setNotice("");}}>Закрыть</button></div>}
    <nav className="ctw-tabs">{["Обзор","Материалы","Обсуждение","Оценка"].map(label=><button className={tab===label?"active":""} type="button" key={label} onClick={()=>{openTab(label,"ctw-overview");}}>{label}</button>)}</nav>
    <div className="ctw-grid"><main>
      <section className="ctw-card ctw-progress" id="ctw-overview"><header><div><small>ПРОГРЕСС ЗАДАЧИ</small><h2>68% выполнено</h2></div><strong>68%</strong></header><div className="ctw-track"><i/></div><div className="ctw-milestones">{milestones.map(([name,text,state],index)=><article className={state} key={name}><span>{state==="done"?"✓":String(index+1).padStart(2,"0")}</span><b>{name}</b><small>{text}</small></article>)}</div></section>
      <WorkspaceCard taskId={taskId} id="about" eyebrow="О ЗАДАЧЕ" title="Описание">
        <p className="ctw-copy">{description}</p><div className="ctw-description-grid"><div><small>Ожидаемый результат</small><b>Работающий прототип и API</b></div><div><small>Формат сдачи</small><b>Demo, репозиторий и документация</b></div></div><div className="ctw-tech"><small>Технологии</small>{["Python","FastAPI","PostgreSQL","Embeddings","Vector DB"].map(x=><span key={x}>{x}</span>)}</div>
      </WorkspaceCard>
      {!customer && projectId ? <WorkspaceCard taskId={taskId} id="platforms" eyebrow="ПЛАТФОРМЫ" title="Инструменты проекта">
        <PlatformsSection projectId={projectId} />
      </WorkspaceCard> : null}
      <WorkspaceCard taskId={taskId} id="results" eyebrow="РЕЗУЛЬТАТЫ" title="Промежуточные артефакты" aside={<span>4 результата</span>}>
        <div className="ctw-results">{[["◇","Архитектура решения","Схема компонентов","Проверено"],["<>" ,"API prototype","OpenAPI / Swagger","Готово"],["▦","Dataset v2","Подготовленные данные","Обновлено"],["↗","Demo build","Последняя сборка","В работе"]].map(x=><button type="button" key={x[1]} onClick={()=>{setNotice(["Артефакт",x[1],x[2],x[3]].filter(Boolean).join(" · ")+". Подробный разбор доступен в чате команды.");}}><i>{x[0]}</i><span><b>{x[1]}</b><small>{x[2]}</small></span><em>{x[3]}</em></button>)}</div>
      </WorkspaceCard>
      <WorkspaceCard taskId={taskId} id="activity" eyebrow="ПОСЛЕДНИЕ СОБЫТИЯ" title="Активность команды" aside={<button type="button" aria-pressed={fullHistory} onClick={()=>{setFullHistory(current=>!current);}}>Вся история</button>} hideAsideWhenCollapsed>
        <div className="ctw-activity">{[["Сегодня, 16:40","Обновлён прототип API","Дмитрий загрузил новую версию Swagger-спецификации."],["Сегодня, 13:15","Добавлен промежуточный результат","Команда прикрепила новую архитектурную схему."],["Вчера, 18:05","Запрошена обратная связь","Команда ждёт подтверждение формата итоговой метрики."]].map(x=><article key={x[0]}><i/><div><small>{x[0]}</small><b>{x[1]}</b><p>{x[2]}</p></div></article>)}{fullHistory&&<div className="ctw-activity-extra">{[["Сегодня, 09:05","Собрание по метрикам","Команда зафиксировала формат итоговой метрики качества."],["Вчера, 15:20","Обновлён план интеграции","Запланированы сценарии тестирования API."],["Позавчера, 19:45","Заявка на ревью ментора","Анн Климова передала вопрос о воспроизводимости данных."]].map(x=><article key={x[0]}><i/><div><small>{x[0]}</small><b>{x[1]}</b><p>{x[2]}</p></div></article>)}</div>}</div>
      </WorkspaceCard>
    </main><aside>
      <WorkspaceCard taskId={taskId} id="team" eyebrow="КОМАНДА" title={`${String(liveMembers.length)} участника`} aside={<span className="ctw-online">● online</span>}>
        <div className="ctw-team">{liveMembers.map(member=><button type="button" key={member.person_id} onClick={()=>{if (workspace && onSelectMember) onSelectMember(member.person_id); else onMessage();}}><i>{member.display_name.split(" ").slice(0,2).map(part=>part[0]).join("")}</i><span><b>{member.display_name}</b><small>{member.status}</small></span><em>●</em></button>)}</div><button className="ctw-wide-button" type="button" onClick={onMessage}>Открыть команду</button>
      </WorkspaceCard>
      <WorkspaceCard taskId={taskId} id="metrics" eyebrow="КЛЮЧЕВЫЕ МЕТРИКИ" title="Статус задачи">
        <dl className="ctw-metrics"><div><dt><button type="button" onClick={()=>{setSelectedMetric("stages");}}>Выполнено этапов</button></dt><dd>{workspace ? `${String(completedCheckpoints.length)} / ${String(workspace.checkpoints.length)}` : "2 / 5"}</dd></div><div><dt><button type="button" onClick={()=>{setSelectedMetric("artifacts");}}>Артефактов загружено</button></dt><dd>{workspace ? artifacts.length : 4}</dd></div><div><dt><button type="button" onClick={()=>{setSelectedMetric("blockers");}}>Есть блокеры</button></dt><dd className={blockers.length === 0 ? "good" : "accent"}>{workspace ? (blockers.length === 0 ? "Нет" : blockers.length) : "Нет"}</dd></div><div><dt><button type="button" onClick={()=>{setSelectedMetric("feedback");}}>Нужна обратная связь</button></dt><dd className="accent">{workspace ? pendingFeedback.length : 1}</dd></div></dl>
      </WorkspaceCard>
      <WorkspaceCard taskId={taskId} id="deadlines" eyebrow="БЛИЖАЙШИЕ ДЕДЛАЙНЫ" title={`До ${deadline}`}>
        <div className="ctw-deadlines">{[["29","АПР","Интеграция API","Завершить основной backend"],["02","МАЯ","Тестирование","Проверить качество рекомендаций"],["04","МАЯ","Финальная защита","Demo и презентация результата"]].map(x=><article key={x[2]}><span><b>{x[0]}</b><small>{x[1]}</small></span><div><b>{x[2]}</b><small>{x[3]}</small></div></article>)}</div>
      </WorkspaceCard>
      {customer ? <section className="ctw-decision"><b>Команда ждёт решение</b><p>Требуется подтвердить формат итоговой метрики качества.</p><button type="button" onClick={onPrimaryAction}>Ответить</button></section> : <WorkspaceCard taskId={taskId} id="solution" eyebrow="МОЁ РЕШЕНИЕ" title="Загрузить решение" className="ctw-upload">
        <div className="ctw-upload-files">{uploadedFiles.map((file,index)=><div key={`${file}-${String(index)}`}><span aria-hidden="true">↗</span><b>{file}</b><small>{index===0?"Загружено сегодня, 16:40":"Загружено вчера, 18:05"}</small></div>)}</div><label className="ctw-upload-button">Загрузить файл(-ы)<input type="file" multiple onChange={event=>{const names=Array.from(event.target.files??[]).map(file=>file.name);if(names.length){setUploadedFiles(current=>[...current,...names]);setNotice(`Добавлено файлов: ${String(names.length)}`);}event.target.value="";}}/></label>
      </WorkspaceCard>}
    </aside></div>
    {(quickCardLoading || quickCardError || quickCard) && <div className="overlay" role="presentation"><section className="overlay-panel overlay-panel--dialog" role="dialog" aria-modal="true" aria-label="Карточка участника"><header><div><p className="eyebrow">Участник команды</p><h2>{quickCard?.display_name ?? "Загружаем карточку…"}</h2></div><button type="button" aria-label="Закрыть" onClick={onCloseQuickCard}>×</button></header>{quickCardLoading && <p role="status">Загружаем разрешённые данные…</p>}{quickCardError && <p role="alert">Не удалось открыть карточку. Доступ к чужому проекту или скрытым полям не предоставлен.</p>}{quickCard && <><dl className="quick-card-facts"><div><dt>Роль в проекте</dt><dd>{quickCard.project_role}</dd></div><div><dt>Ответственность</dt><dd>{quickCard.responsibility}</dd></div><div><dt>Доступность</dt><dd>{quickCard.availability}</dd></div><div><dt>Статус вклада</dt><dd>{quickCard.contribution_status ?? "Ещё не отправлен"}</dd></div></dl>{quickCard.profile.skills.length > 0 && <div className="chip-row">{quickCard.profile.skills.map(skill=><span key={`${skill.title}-${skill.origin}`}>{skill.verified ? "✓ " : ""}{skill.title}</span>)}</div>}<div className="modal-actions"><button type="button" disabled={!quickCard.portfolio_available} title={quickCard.portfolio_available ? undefined : "Портфолио скрыто настройками участника"} onClick={()=>{onOpenProfile?.(quickCard.person_id);}}>Подробная информация</button><button type="button" className="secondary-button" onClick={()=>{onOpenDirectMessage?.(quickCard.person_id);}}>Сообщение</button></div></>}</section></div>}
    {selectedMetric && <div className="overlay" role="presentation"><section className="overlay-panel overlay-panel--dialog" role="dialog" aria-modal="true" aria-label="Расчёт ключевой метрики"><header><div><p className="eyebrow">Как считается · {workspace?.freshness ?? "текущий экран"}</p><h2>{selectedMetric === "stages" ? "Выполнено этапов" : selectedMetric === "artifacts" ? "Артефактов загружено" : selectedMetric === "blockers" ? "Блокеры" : "Обратная связь"}</h2></div><button type="button" aria-label="Закрыть" onClick={()=>{setSelectedMetric(null);}}>×</button></header><p><strong>{selectedMetric === "stages" ? `${String(completedCheckpoints.length)} / ${String(workspace?.checkpoints.length ?? 0)}` : selectedMetric === "artifacts" ? String(artifacts.length) : selectedMetric === "blockers" ? String(blockers.length) : String(pendingFeedback.length)}</strong></p>{selectedMetric === "stages" && <><p>Числитель — завершённые checkpoint-и; знаменатель — все checkpoint-и текущей версии задачи.</p>{workspace?.checkpoints.length ? <ul>{completedCheckpoints.map(item=><li key={item.key}>✓ {item.title} · evidence подтверждено · <a href={`#checkpoint-${encodeURIComponent(item.key)}`}>Открыть checkpoint</a></li>)}{remainingCheckpoints.map(item=><li key={item.key}>○ {item.title} · {item.status} · <a href={`#checkpoint-${encodeURIComponent(item.key)}`}>Открыть checkpoint</a></li>)}</ul> : <p>Этапы ещё не сформированы.</p>}</>}{selectedMetric === "artifacts" && <><p>Учитываются уникальные артефакты в отправленных версиях личного вклада.</p>{artifacts.length ? <ul>{artifacts.map(item=><li key={`${item.contributionId}-${item.key}`}>{item.key} · версия {item.version} · {item.status}</li>)}</ul> : <p>Артефакты ещё не загружены. Добавьте evidence в разделе «Моё решение».</p>}</>}{selectedMetric === "blockers" && <><p>Checkpoint считается блокером только при серверном статусе blocked.</p>{blockers.length ? <ul>{blockers.map(item=><li key={item.key}>{item.title} · владелец: команда · действие: открыть checkpoint</li>)}</ul> : <p>Активных блокеров нет.</p>}</>}{selectedMetric === "feedback" && <><p>Показываются запросы ревью, которые ещё не опубликованы или не приняты.</p>{pendingFeedback.length ? <ul>{pendingFeedback.map(item=><li key={`${item.contribution_id}-${String(item.review_version)}`}>Версия вклада {item.contribution_version} · {item.explanation} · {item.status}</li>)}</ul> : <p>Нет ожидающих запросов обратной связи.</p>}</>}</section></div>}
  </div>;
}
