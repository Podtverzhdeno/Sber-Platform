type WorkspaceMode = "customer" | "participant";

type TaskWorkspacePageProps = {
  mode: WorkspaceMode;
  title: string;
  taskId: string;
  description: string;
  deadline: string;
  tags: string[];
  onMessage: () => void;
  onPrimaryAction: () => void;
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
];

export function TaskWorkspacePage({ mode, title, taskId, description, deadline, tags, onMessage, onPrimaryAction }: TaskWorkspacePageProps) {
  const customer = mode === "customer";
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState("Обзор");
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
      <section className="ctw-card"><small className="ctw-label">О ЗАДАЧЕ</small><h2>Описание</h2><p className="ctw-copy">{description}</p><div className="ctw-description-grid"><div><small>Ожидаемый результат</small><b>Работающий прототип и API</b></div><div><small>Формат сдачи</small><b>Demo, репозиторий и документация</b></div></div><div className="ctw-tech"><small>Технологии</small>{["Python","FastAPI","PostgreSQL","Embeddings","Vector DB"].map(x=><span key={x}>{x}</span>)}</div></section>
      <section className="ctw-card"><header className="ctw-section-head"><div><small>РЕЗУЛЬТАТЫ</small><h2>Промежуточные артефакты</h2></div><span>4 результата</span></header><div className="ctw-results">{[["◇","Архитектура решения","Схема компонентов","Проверено"],["<>" ,"API prototype","OpenAPI / Swagger","Готово"],["▦","Dataset v2","Подготовленные данные","Обновлено"],["↗","Demo build","Последняя сборка","В работе"]].map(x=><button type="button" key={x[1]}><i>{x[0]}</i><span><b>{x[1]}</b><small>{x[2]}</small></span><em>{x[3]}</em></button>)}</div></section>
      <section className="ctw-card"><header className="ctw-section-head"><div><small>ПОСЛЕДНИЕ СОБЫТИЯ</small><h2>Активность команды</h2></div><button type="button">Вся история</button></header><div className="ctw-activity">{[["Сегодня, 16:40","Обновлён прототип API","Дмитрий загрузил новую версию Swagger-спецификации."],["Сегодня, 13:15","Добавлен промежуточный результат","Команда прикрепила новую архитектурную схему."],["Вчера, 18:05","Запрошена обратная связь","Команда ждёт подтверждение формата итоговой метрики."]].map(x=><article key={x[0]}><i/><div><small>{x[0]}</small><b>{x[1]}</b><p>{x[2]}</p></div></article>)}</div></section>
    </main><aside>
      <section className="ctw-card"><header className="ctw-section-head"><div><small>КОМАНДА</small><h2>4 участника</h2></div><span className="ctw-online">● online</span></header><div className="ctw-team">{members.map(x=><button type="button" key={x[1]}><i>{x[0]}</i><span><b>{x[1]}</b><small>{x[2]}</small></span><em>●</em></button>)}</div><button className="ctw-wide-button" type="button" onClick={onMessage}>Открыть команду</button></section>
      <section className="ctw-card"><small className="ctw-label">КЛЮЧЕВЫЕ МЕТРИКИ</small><h2>Статус задачи</h2><dl className="ctw-metrics"><div><dt>Выполнено этапов</dt><dd>2 / 5</dd></div><div><dt>Артефактов загружено</dt><dd>4</dd></div><div><dt>Есть блокеры</dt><dd className="good">Нет</dd></div><div><dt>Нужна обратная связь</dt><dd className="accent">1</dd></div></dl></section>
      <section className="ctw-card"><small className="ctw-label">БЛИЖАЙШИЕ ДЕДЛАЙНЫ</small><h2>До {deadline}</h2><div className="ctw-deadlines">{[["29","АПР","Интеграция API","Завершить основной backend"],["02","МАЯ","Тестирование","Проверить качество рекомендаций"],["04","МАЯ","Финальная защита","Demo и презентация результата"]].map(x=><article key={x[2]}><span><b>{x[0]}</b><small>{x[1]}</small></span><div><b>{x[2]}</b><small>{x[3]}</small></div></article>)}</div></section>
      <section className="ctw-decision"><b>Команда ждёт решение</b><p>Требуется подтвердить формат итоговой метрики качества.</p><button type="button" onClick={onPrimaryAction}>Ответить</button></section>
    </aside></div>
  </div>;
}
import { useState } from "react";
