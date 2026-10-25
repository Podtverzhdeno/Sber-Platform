import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight, Award, BookOpenCheck, BriefcaseBusiness, Check, CheckCheck,
  ChevronRight, CircleCheck, Clock3, ExternalLink, FileBadge, FilterX,
  GraduationCap, Medal, Plus, Search, ShieldCheck, Sparkles, Trophy,
  X,
} from "lucide-react";

import { apiRequest } from "../../api/client";
import { SafeExternalLink } from "../../components/ui";
import {
  achievementCategoryLabels,
  achievementStatusLabels,
  achievementSummary,
  buildAchievements,
  type AchievementCategory,
  type AchievementClaim,
  type AchievementEventsPage,
  type AchievementRecord,
  type AchievementStatus,
  type AchievementsPortfolio,
} from "./model";
import "./achievements-v2.scss";

type Filter = "all" | AchievementCategory;
type StatusFilter = "all" | AchievementStatus;
type Sort = "status" | "type" | "name";

const categories: { id: Filter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "trophy", label: "Награды" },
  { id: "certificate", label: "Сертификаты" },
  { id: "project", label: "Проекты" },
  { id: "event", label: "События" },
];
const categoryIcons = {
  trophy: Trophy, certificate: GraduationCap, project: BriefcaseBusiness, event: Sparkles,
};
const statusOrder: Record<AchievementStatus, number> = { pending: 0, verified: 1, rejected: 2 };

export function ParticipantAchievementsV2({ navigation = [] }: { navigation?: string[] }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<Filter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<Sort>("status");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const portfolio = useQuery({
    queryKey: ["portfolio"],
    queryFn: () => apiRequest<AchievementsPortfolio>("/api/v1/me/portfolio"),
    refetchOnMount: "always",
  });
  const claims = useQuery({
    queryKey: ["event-claims"],
    queryFn: () => apiRequest<AchievementClaim[]>("/api/v1/me/event-claims"),
    refetchOnMount: "always",
  });
  const events = useQuery({
    queryKey: ["ecosystem-events", "achievements"],
    queryFn: () => apiRequest<AchievementEventsPage>("/api/v1/ecosystem/events"),
    enabled: (claims.data?.length ?? 0) > 0,
  });

  const records = useMemo(
    () => buildAchievements(portfolio.data, claims.data, events.data?.items),
    [portfolio.data, claims.data, events.data],
  );
  const summary = useMemo(() => achievementSummary(records), [records]);
  const confirmedPercent = summary.all > 0 ? Math.round(summary.verified / summary.all * 100) : 0;
  const categoryCount = (category: Filter) =>
    category === "all" ? summary.all : records.filter(item => item.category === category).length;

  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("ru-RU");
    return records.filter(item =>
      (filter === "all" || item.category === filter) &&
      (statusFilter === "all" || item.status === statusFilter) &&
      (!term || [item.title, item.description, item.issuer, item.verificationId ?? ""]
        .join(" ").toLocaleLowerCase("ru-RU").includes(term)),
    ).sort((a, b) =>
      sort === "name" ? a.title.localeCompare(b.title, "ru") :
        sort === "type" ? a.category.localeCompare(b.category) || a.title.localeCompare(b.title, "ru") :
          statusOrder[a.status] - statusOrder[b.status] || a.title.localeCompare(b.title, "ru"),
    );
  }, [records, filter, statusFilter, search, sort]);

  const activeId = params.get("achievement");
  const selected = records.find(item => item.id === activeId);
  const changeSelected = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set("achievement", id);
    else next.delete("achievement");
    setParams(next);
  };
  const modalOpen = showAdd || Boolean(selected);
  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setShowAdd(false);
      if (activeId) {
        const next = new URLSearchParams(window.location.search);
        next.delete("achievement");
        setParams(next, { replace: true });
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [modalOpen, activeId, setParams]);

  const goTo = (name: string) => {
    setShowAdd(false);
    changeSelected(null);
    const index = navigation.findIndex(item => item === name);
    if (index >= 0) void navigate(`/workspace/${String(index)}`);
  };
  const resetFilters = () => { setFilter("all"); setStatusFilter("all"); setSearch(""); setSort("status"); };
  const loading = portfolio.isLoading && claims.isLoading;
  const failed = portfolio.isError || claims.isError;
  const noSource = portfolio.isError && claims.isError;

  return <div className="achv-page feature-stack" data-reference="R-PAR-10" data-testid="achievements-v2">
    <section className="achv-hero" aria-labelledby="workspace-title">
      <div className="achv-hero-copy">
        <div className="achv-kicker"><ShieldCheck size={15}/> ПРОВЕРЯЕМЫЕ РЕЗУЛЬТАТЫ <span className="achv-kicker-spark">✦</span></div>
        <h1 id="workspace-title">Достижения <span>со смыслом</span></h1>
        <p>Ваш опыт, победы и сертификаты — в одном месте. Сохраняйте доказательства, отслеживайте проверку и показывайте реальные результаты командам Сбера.</p>
        <div className="achv-hero-actions">
          <button type="button" className="achv-button achv-button-primary" onClick={() => setShowAdd(true)}><Plus size={17}/> Добавить результат</button>
          <button type="button" className="achv-button achv-button-ghost" onClick={() => goTo("Портфолио")}>Моё портфолио <ArrowRight size={16}/></button>
        </div>
        {portfolio.data?.demo_data && <small className="achv-demo-label">Демонстрационный профиль · показаны только данные, доступные из источников</small>}
      </div>
      <div className="achv-hero-visual" aria-hidden="true">
        <div className="achv-orbit achv-orbit-one"/><div className="achv-orbit achv-orbit-two"/>
        <div className="achv-orbit-token achv-orbit-token--a"><Medal size={25}/></div>
        <div className="achv-orbit-token achv-orbit-token--b"><GraduationCap size={23}/></div>
        <div className="achv-orbit-token achv-orbit-token--c"><BriefcaseBusiness size={22}/></div>
        <div className="achv-hero-ring" style={{ "--achv-progress": `${String(confirmedPercent)}%` } as CSSProperties}>
          <div><span>{summary.all ? `${String(confirmedPercent)}%` : "—"}</span><small>подтверждено</small></div>
        </div>
        <span className="achv-float achv-float-top"><CheckCheck size={13}/> Доказанный опыт</span>
        <span className="achv-float achv-float-bottom"><Sparkles size={13}/> Ваш следующий шаг</span>
      </div>
    </section>

    <section className="achv-metrics" aria-label="Статистика достижений">
      <article className="achv-metric"><span className="achv-metric-icon total"><Award size={22}/></span><div><small>Всего результатов</small><strong>{loading ? "—" : summary.all}</strong><span>из ваших источников</span></div></article>
      <article className="achv-metric"><span className="achv-metric-icon verified"><CircleCheck size={22}/></span><div><small>Подтверждено</small><strong>{loading ? "—" : summary.verified}</strong><span>проверяемый опыт</span></div></article>
      <article className="achv-metric"><span className="achv-metric-icon pending"><Clock3 size={22}/></span><div><small>На проверке</small><strong>{loading ? "—" : summary.pending}</strong><span>ожидают решения</span></div></article>
      <article className="achv-metric"><span className="achv-metric-icon category"><FileBadge size={22}/></span><div><small>Разных направлений</small><strong>{loading ? "—" : new Set(records.map(item => item.category)).size}</strong><span>проекты, обучение, победы</span></div></article>
    </section>

    {failed && <div className="achv-source-warning" role="status">
      <ShieldCheck size={18}/>
      <span>{noSource ? "Не удалось получить достижения из источников. Демонстрационные результаты не подставлены." :
        "Часть источников недоступна. Показаны только полученные результаты."}</span>
      <button type="button" onClick={() => { void portfolio.refetch(); void claims.refetch(); }}>Повторить</button>
    </div>}

    <div className="achv-content">
      <main className="achv-main">
        <div className="achv-section-heading">
          <div><span className="achv-eyebrow">ВАША КОЛЛЕКЦИЯ</span><h2>История достижений <span>{summary.all}</span></h2><p>Каждый результат можно открыть и проверить</p></div>
          <div className="achv-heading-decoration" aria-hidden="true"><Award size={26}/></div>
        </div>
        <div className="achv-toolbar">
          <div className="achv-tabs" role="group" aria-label="Тип достижений">
            {categories.map(item => <button key={item.id} type="button" className={filter === item.id ? "active" : ""} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}<span>{categoryCount(item.id)}</span></button>)}
          </div>
          <div className="achv-controls">
            <label className="achv-search"><Search size={16}/><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Поиск по достижениям" aria-label="Поиск по достижениям"/></label>
            <label className="achv-select-label"><span>Статус</span><select aria-label="Статус достижения" value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}><option value="all">Все статусы</option><option value="verified">Подтверждено</option><option value="pending">На проверке</option><option value="rejected">Отклонено</option></select></label>
            <label className="achv-select-label"><span>Сортировка</span><select aria-label="Сортировка достижений" value={sort} onChange={event => setSort(event.target.value as Sort)}><option value="status">По статусу</option><option value="type">По типу</option><option value="name">По названию</option></select></label>
          </div>
        </div>
        <div className="achv-list-topline"><span>Найдено <strong>{visible.length}</strong> {visible.length === 1 ? "результат" : "результатов"}</span>{(filter !== "all" || statusFilter !== "all" || search) && <button type="button" onClick={resetFilters}><FilterX size={14}/> Сбросить фильтры</button>}</div>
        {loading ? <div className="achv-empty" role="status"><span className="achv-empty-icon"><Clock3 size={27}/></span><h3>Загружаем ваши достижения</h3><p>Сверяем портфолио и результаты внешних событий</p></div> :
          visible.length === 0 ? <div className="achv-empty" data-testid="achievements-empty">
            <span className="achv-empty-icon"><Award size={29}/></span>
            <h3>{summary.all ? "Ничего не найдено" : "Ваши достижения появятся здесь"}</h3>
            <p>{summary.all ? "Попробуйте другие фильтры или поисковый запрос." :
              "Завершите обучение, подтвердите результат проекта или участие в событии, чтобы собрать проверяемое портфолио."}</p>
            <button className="achv-button achv-button-primary" type="button" onClick={() => summary.all ? resetFilters() : setShowAdd(true)}>
              {summary.all ? "Очистить фильтры" : "Как добавить результат"} <ArrowRight size={16}/>
            </button>
          </div> : <div className="achv-grid">
            {visible.map(record => {
              const Icon = categoryIcons[record.category];
              return <button type="button" className={`achv-item achv-item--${record.category}`} key={record.id} data-testid="achievement-card" onClick={() => changeSelected(record.id)}>
                <div className="achv-item-top">
                  <span className="achv-item-icon"><Icon size={23}/></span>
                  <span className={`achv-state achv-state--${record.status}`}>{record.status === "verified" ? <Check size={13}/> : record.status === "pending" ? <Clock3 size={13}/> : <X size={13}/>}{achievementStatusLabels[record.status]}</span>
                </div>
                <span className="achv-category">{achievementCategoryLabels[record.category].slice(0,-1)}</span>
                <h3>{record.title}</h3>
                <p>{record.description}</p>
                <div className="achv-item-bottom">
                  <span>{record.issuer}</span><span className="achv-item-open">Подробнее <ChevronRight size={15}/></span>
                </div>
              </button>;
            })}
          </div>}
      </main>

      <aside className="achv-side" aria-label="Полезная информация о достижениях">
        <section className="achv-side-panel achv-progress-panel">
          <div className="achv-side-kicker"><span className="achv-side-dot"/> ВАШ ПРОГРЕСС</div>
          <h3>Портфолио, которому доверяют</h3>
          <p>Подтверждённый результат ценнее неподтверждённой записи — он показывает практический опыт.</p>
          <div className="achv-progress-line"><div><strong>{summary.verified} из {summary.all}</strong><span>подтверждены</span></div><div className="achv-progress-track"><span style={{ width: `${String(confirmedPercent)}%` }}/></div></div>
          <button type="button" className="achv-side-link" onClick={() => goTo("Портфолио")}>Открыть портфолио <ArrowRight size={16}/></button>
        </section>
        <section className="achv-side-panel achv-how">
          <div className="achv-side-kicker"><Sparkles size={14}/> КАК ЭТО РАБОТАЕТ</div>
          <h3>От участия до достижения</h3>
          <ol>
            <li><span>01</span><div><strong>Сделайте что-то реальное</strong><small>Курс, проект, конкурс или событие</small></div></li>
            <li><span>02</span><div><strong>Добавьте подтверждение</strong><small>Сертификат, результат проверки или вклад</small></div></li>
            <li><span>03</span><div><strong>Покажите ваш опыт</strong><small>Подтверждённые данные попадут в портфолио</small></div></li>
          </ol>
        </section>
        <section className="achv-side-promo">
          <span className="achv-side-promo-icon"><BookOpenCheck size={22}/></span>
          <h3>Следующее достижение ближе, чем кажется</h3>
          <p>Выберите практический курс или событие, чтобы пополнить портфолио.</p>
          <button type="button" onClick={() => goTo("События")}>Найти событие <ArrowRight size={15}/></button>
        </section>
      </aside>
    </div>

    {selected && <div className="achv-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) changeSelected(null); }}>
      <section className="achv-modal" role="dialog" aria-modal="true" aria-label="Подробности достижения" data-testid="achievement-detail">
        <button type="button" className="achv-close" onClick={() => changeSelected(null)} aria-label="Закрыть подробности"><X size={18}/></button>
        <span className="achv-modal-type">{achievementCategoryLabels[selected.category]}</span>
        <div className="achv-modal-title"><span className="achv-modal-icon">{(() => { const Icon = categoryIcons[selected.category]; return <Icon size={27}/>; })()}</span><div><h2>{selected.title}</h2><span className={`achv-state achv-state--${selected.status}`}>{achievementStatusLabels[selected.status]}</span></div></div>
        <h3>Что подтверждено</h3><p>{selected.description}</p>
        <dl className="achv-modal-facts">
          <div><dt>Источник</dt><dd>{selected.issuer}</dd></div>
          <div><dt>Статус</dt><dd>{achievementStatusLabels[selected.status]}</dd></div>
          {selected.verificationId && <div><dt>Идентификатор</dt><dd className="achv-monospace">{selected.verificationId}</dd></div>}
        </dl>
        {selected.evidence.length > 0 && <><h3>Доказательства</h3><div className="achv-evidence">{selected.evidence.map(evidence => <span key={evidence}><FileBadge size={15}/>{evidence}</span>)}</div><p className="achv-modal-note">Артефакты перечислены в записи проекта. Содержимое доступно через исходный рабочий процесс.</p></>}
        <div className="achv-modal-actions">
          {selected.sourceUrl && <SafeExternalLink className="achv-button achv-button-primary" href={selected.sourceUrl}>Первоисточник <ExternalLink size={15}/></SafeExternalLink>}
          {selected.eventKey && <button className="achv-button achv-button-primary" type="button" onClick={() => goTo("События")}>К событиям <ArrowRight size={16}/></button>}
          <button className="achv-button achv-button-ghost" type="button" onClick={() => { changeSelected(null); goTo(selected.category === "project" ? "Мои проекты" : selected.category === "certificate" ? "Bootcamp" : "Портфолио"); }}>Связанный раздел <ArrowRight size={16}/></button>
        </div>
      </section>
    </div>}

    {showAdd && <div className="achv-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setShowAdd(false); }}>
      <section className="achv-modal achv-add-modal" role="dialog" aria-modal="true" aria-label="Добавить результат" data-testid="achievements-add-dialog">
        <button type="button" className="achv-close" onClick={() => setShowAdd(false)} aria-label="Закрыть"><X size={18}/></button>
        <span className="achv-modal-type">ПОПОЛНИТЬ ПОРТФОЛИО</span><h2>Какое достижение добавим?</h2>
        <p>Выберите источник результата. Платформа получает подтверждение из связанного раздела — фиктивное начисление баллов не производится.</p>
        <div className="achv-add-options">
          {([
            { name: "События", title: "Победа или участие", description: "Подтвердить результат конкурса или хакатона", Icon: Trophy },
            { name: "Мои проекты", title: "Проектный результат", description: "Представить личный вклад и доказательства", Icon: BriefcaseBusiness },
            { name: "Bootcamp", title: "Сертификат курса", description: "Завершить курс с проверкой результата", Icon: GraduationCap },
          ] as const).map(option => <button key={option.name} type="button" onClick={() => goTo(option.name)}><span><option.Icon size={21}/></span><div><strong>{option.title}</strong><small>{option.description}</small></div><ChevronRight size={19}/></button>)}
        </div>
      </section>
    </div>}
  </div>;
}
