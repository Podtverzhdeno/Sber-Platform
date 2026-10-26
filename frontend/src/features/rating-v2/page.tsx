import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, type RuntimeApiPath } from "../../api/client";
import { useSearchParams } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, Award, BadgeCheck, BriefcaseBusiness, CalendarDays,
  Check, ChevronDown, CircleCheck, Crown, FileBadge2,
  Flame, Gem, Heart, LockKeyhole, Mail, Medal,
  Search, Share2, ShieldCheck, Star, Trophy, Users,
} from "lucide-react";

import { selectOwnPublishedStanding, useOwnPublishedStandings } from "./own-standing";
import "./rating-v2.scss";

type Person = {
  personId: string | null;
  place: number;
  name: string;
  projects: number;
  points: number;
  achievements: string[];
  activity: string;
  initials: string;
  palette: "gold" | "silver" | "teal" | "blue";
};
type Screen = "list" | "benefits" | "profile";
type RankingFilter = "all" | "10" | "30" | "50";
type Benefit = { key: "top30" | "top1" | "top50"; place: string; title: string; copy: string; Icon: typeof Trophy; perks: string[] };

type Season = { id: string; key: string; title: string; status: string; version: number; policy_version: number | null };
type PublishedEntry = {
  place: number; person_id: string | null; display_name: string; score: string | number;
  successful_projects: number; anonymized: boolean;
  trophies: { title: string; trophy_type: string; source_url: string }[];
  offers: { event_title: string; source_url: string; basis: string }[];
};

/** The ranking has no synthetic fallback. Never infer activity or skill evidence. */
function toPerson(entry: PublishedEntry): Person {
  const words = entry.display_name.split(/\s+/).filter(Boolean);
  return {
    personId: entry.anonymized ? null : entry.person_id,
    place: entry.place,
    // Never trust a display_name from an anonymized public record.
    // A stable place-based alias makes anonymous rows distinguishable.
    name: entry.anonymized ? "Участник №" + String(entry.place) : entry.display_name,
    projects: entry.successful_projects,
    points: Number(entry.score),
    achievements: entry.trophies.map(trophy => trophy.title),
    activity: "Не опубликована",
    initials: entry.anonymized ? "•" : words.slice(0, 2).map(word => word.charAt(0)).join("").toLocaleUpperCase("ru-RU"),
    palette: entry.place === 1 ? "gold" : entry.place === 2 ? "silver" : entry.place === 3 ? "teal" : "blue",
  };
}

const benefits: Benefit[] = [
  { key: "top30", place: "ТОП 30", title: "Премиум-подписка GigaCode", copy: "Доступ к премиальным инструментам и ускорение работы над проектами.", Icon: Gem,
    perks: ["Премиум-подписка GigaCode", "Повышенная видимость профиля", "Приоритет при отборе на активности", "Ранний доступ к новым возможностям"] },
  { key: "top1", place: "ТОП 1", title: "Особая сертификация и признание", copy: "Статус лучшего участника сезона с записью о победе в Skill Passport.", Icon: Crown,
    perks: ["Именная сертификация победителя", "Подтверждённая запись в Skill Passport", "Признание лучшим участником программы", "Публикация истории успеха в Impulse", "Приглашение на встречу с экспертами"] },
  { key: "top50", place: "ТОП 50", title: "Закрытое сообщество лучших", copy: "Комьюнити, нетворкинг и преимущества экосистемы для сильнейших участников.", Icon: Trophy,
    perks: ["Приглашение в закрытое сообщество", "Пакеты токенов GitVerse, GigaAgent, GigaCowork", "Нетворкинг с экспертами и участниками", "Участие в закрытых событиях"] },
];

const levels = [
  { label: "ТОП 30", benefit: "GigaCode Premium", icon: Gem },
  { label: "ТОП 1", benefit: "Skill Passport", icon: Crown },
  { label: "ТОП 50", benefit: "Закрытое комьюнити", icon: Trophy },
] as const;

function PersonAvatar({ person, big = false }: { person: Person; big?: boolean }) {
  return <span className={["ir-avatar", "ir-avatar--" + person.palette, big ? "ir-avatar--big" : ""].join(" ")} aria-label={person.name} role="img">
    <span>{person.initials}</span>
  </span>;
}

function TrophyArtwork({ type }: { type: "top1" | "top30" | "top50" | "hero" }) {
  return <div className={["ir-art", "ir-art--" + type].join(" ")} aria-hidden="true">
    <div className="ir-art-glow" />
    <div className="ir-art-mountains"><i /><i /><i /></div>
    <div className="ir-art-pedestal"><i /></div>
    <div className="ir-art-crystal"><span /></div>
    {type === "top1" ? <Crown className="ir-art-icon" /> : type === "top50" ? <Trophy className="ir-art-icon" /> : <Gem className="ir-art-icon" />}
  </div>;
}

function BenefitTile({ benefit, onOpen, compact = false }: { benefit: Benefit; onOpen: () => void; compact?: boolean }) {
  const Icon = benefit.Icon;
  return <button type="button" className={["ir-benefit", "ir-benefit--" + benefit.key, compact ? "ir-benefit--compact" : ""].join(" ")} onClick={onOpen} aria-label={"Подробнее: " + benefit.place + " — " + benefit.title}>
    <TrophyArtwork type={benefit.key} />
    <div className="ir-benefit-text">
      <span className="ir-benefit-title"><Icon size={24} strokeWidth={2.2} /> {benefit.place}</span>
      <strong>{benefit.title}</strong>
      {!compact && <ul>{benefit.perks.slice(0, benefit.key === "top1" ? 4 : 3).map(perk => <li key={perk}><CircleCheck size={15} />{perk}</li>)}</ul>}
      {compact && <span className="ir-benefit-subtitle">{benefit.copy}</span>}
    </div>
    <span className="ir-benefit-arr"><ArrowRight size={19} /></span>
  </button>;
}

function RewardDialog({ benefit, onClose }: { benefit: Benefit; onClose: () => void }) {
  useEffect(() => {
    const onEsc = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onEsc);
    return () => { window.removeEventListener("keydown", onEsc); };
  }, [onClose]);
  const Icon = benefit.Icon;
  return <div className="ir-overlay" role="presentation" onClick={onClose}>
    <section className={"ir-modal ir-modal--" + benefit.key} role="dialog" aria-modal="true" aria-label={benefit.place + ": " + benefit.title} onClick={event => {event.stopPropagation();}}>
      <button type="button" className="ir-close" aria-label="Закрыть описание награды" onClick={onClose}>×</button>
      <div className="ir-modal-icon"><Icon size={42} /></div>
      <span className="ir-eyebrow">Награды сезона · условия программы</span>
      <h2>{benefit.place} — {benefit.title}</h2>
      <p>{benefit.copy}</p>
      <ul className="ir-modal-list">{benefit.perks.map(item => <li key={item}><Check size={17} />{item}</li>)}</ul>
      <p className="ir-benefit-note">Концепция привилегий: доступ и выдача зависят от утверждения условий программы, итоговой позиции и подтверждения результатов.</p>
      <button type="button" className="ir-btn ir-btn--solid" onClick={onClose}>Понятно <ArrowRight size={16} /></button>
    </section>
  </div>;
}

function RatingHero({ title, eyebrow, description, seasonTitle, compact = false }: { title: string; eyebrow: string; description: string; seasonTitle: string; compact?: boolean }) {
  return <header className={["ir-hero", compact ? "ir-hero--compact" : ""].join(" ")}>
    <TrophyArtwork type="hero" />
    <div className="ir-hero-copy">
      <p className="ir-eyebrow">{eyebrow}</p>
      <h1 id="workspace-title">{title}</h1>
      <p>{description}</p>
    </div>
    {!compact && <aside className="ir-season" aria-label="Текущий сезон">
      <CalendarDays size={26} />
      <div><strong>{seasonTitle}</strong><b>Опубликованный рейтинг</b><span>По подтверждённым результатам</span></div>
      <span className="ir-season-status">Опубликованный сезон</span>
    </aside>}
  </header>;
}

export function ParticipantRatingV2({ onOpenMessages, currentPersonId }: { onOpenMessages?: () => void; currentPersonId?: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const seasonsQuery = useQuery({
    queryKey: ["rating-seasons"],
    queryFn: () => apiRequest<Season[]>("/api/v1/rating-seasons", { cache: "no-store" }),
  });
  const seasons = seasonsQuery.data ?? [];
  const requestedSeason = searchParams.get("season");
  const season = seasons.find(item => item.id === requestedSeason) ?? seasons[0] ?? null;
  const leadersQuery = useQuery({
    queryKey: ["rating-season-leaderboard", season?.id],
    enabled: season !== null,
    queryFn: () => apiRequest<PublishedEntry[]>(`/api/v1/rating-seasons/${encodeURIComponent(season?.id ?? "")}/leaderboard` as RuntimeApiPath, { cache: "no-store" }),
  });
  const people = useMemo(() => (leadersQuery.data ?? []).map(toPerson), [leadersQuery.data]);
  const ownQuery = useOwnPublishedStandings(currentPersonId);
  const ownStanding = selectOwnPublishedStanding(ownQuery.data, season);
  const [selectedBenefit, setSelectedBenefit] = useState<Benefit | null>(null);
  const [feedback, setFeedback] = useState("");
  const [tab, setTab] = useState("Обзор");
  const [favorites, setFavorites] = useState<Set<number>>(() => new Set());
  const screenValue = searchParams.get("ratingView");
  const screen: Screen = screenValue === "benefits" || screenValue === "profile" ? screenValue : "list";
  const profileId = searchParams.get("participant");
  const person = people.find(item => item.personId !== null && item.personId === profileId) ?? null;
  const rankValue = searchParams.get("rank");
  const filter: RankingFilter = rankValue === "10" || rankValue === "30" || rankValue === "50" ? rankValue : "all";
  const query = searchParams.get("q") ?? "";
  const order = searchParams.get("order") ?? "points";
  const current = people.find(item => item.personId !== null && item.personId === currentPersonId) ?? null;
  const visible = useMemo(() => {
    const limit = filter === "all" ? Infinity : Number(filter);
    const text = query.trim().toLocaleLowerCase("ru-RU");
    const items = people.filter(item => item.place <= limit && (!text || item.name.toLocaleLowerCase("ru-RU").includes(text) || item.achievements.some(a => a.toLocaleLowerCase("ru-RU").includes(text))));
    return [...items].sort((a, b) => order === "projects" ? b.projects - a.projects || b.points - a.points : order === "name" ? a.name.localeCompare(b.name, "ru") : b.points - a.points);
  }, [filter, query, order, people]);

  function updateParams(values: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams);
    Object.entries(values).forEach(([key, value]) => { if (value === null || value === "") next.delete(key); else next.set(key, value); });
    setSearchParams(next);
  }
  function openProfile(item: Person) {
    setTab("Обзор");
    if (item.personId === null) return;
    updateParams({ ratingView: "profile", participant: item.personId });
  }
  function backToList() {
    updateParams({ ratingView: null, participant: null });
  }
  async function shareProfile() {
    const link = window.location.href;
    try { await navigator.clipboard.writeText(link); setFeedback("Ссылка на профиль скопирована"); }
    catch { setFeedback("Адрес профиля: " + link); }
  }
  function viewBenefits() {
    updateParams({ ratingView: "benefits", participant: null });
  }

  return <div className="ir-page" data-testid="rating-v2" data-screen={screen}>
    {(seasonsQuery.isLoading || (season !== null && leadersQuery.isLoading)) && <p role="status" className="ir-disclaimer">Загружаем опубликованные данные рейтинга…</p>}
    {(seasonsQuery.isError || leadersQuery.isError) && <p role="alert" className="ir-disclaimer">Не удалось загрузить рейтинг. <button type="button" onClick={() => { void seasonsQuery.refetch(); void leadersQuery.refetch(); }}>Повторить</button></p>}
    {!seasonsQuery.isLoading && !seasonsQuery.isError && season === null && <p role="status" className="ir-disclaimer">Опубликованных сезонов рейтинга пока нет. Баллы и места не присваиваются автоматически.</p>}

    {screen === "list" && <>
      <div className="ir-breadcrumb"><span>Рейтинг</span><span className="ir-divider-chevron">›</span><strong>Все участники</strong></div>
      <RatingHero title="Все участники рейтинга" eyebrow="РЕЙТИНГ · ОПУБЛИКОВАННЫЙ СЕЗОН" description="Результаты участников из опубликованного рейтинга с учётом настроек приватности." seasonTitle={season?.title ?? "Сезон не опубликован"} />
      <div className="ir-reward-strip" aria-label="Награды за места в рейтинге">
        {benefits.map(benefit => <BenefitTile key={benefit.key} benefit={benefit} compact onOpen={() => {setSelectedBenefit(benefit);}} />)}
      </div>
      <div className="ir-board-toolbar">
        <div className="ir-ranking-filters" role="group" aria-label="Фильтр рейтинга">
          {(["all", "10", "30", "50"] as const).map(value => <button type="button" key={value} aria-pressed={filter === value} onClick={() => {updateParams({rank:value==="all"?null:value});}}>{value === "all" ? "Все" : "ТОП " + value}</button>)}
        </div>
        <label className="ir-control ir-control--search"><Search size={18} /><span className="ir-sr">Поиск участников</span><input type="search" value={query} placeholder="Поиск по участникам..." onChange={event => {updateParams({q:event.target.value});}} /></label>
        <label className="ir-control ir-select" aria-label="Сезон рейтинга"><CalendarDays size={18} /><select aria-label="Выбрать сезон" value={season?.id ?? ""} disabled={seasons.length === 0} onChange={event => { updateParams({ season: event.target.value, participant: null, ratingView: null }); }}><option value="" disabled>Нет опубликованного сезона</option>{seasons.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
        <label className="ir-control ir-control--sort"><span className="ir-sr">Сортировка рейтинга</span><span>↕</span><select value={order} onChange={event => {updateParams({order:event.target.value==="points"?null:event.target.value});}}><option value="points">По баллам</option><option value="projects">По проектам</option><option value="name">По имени</option></select><ChevronDown size={16}/></label>
      </div>
      <div className="ir-list-bar"><p><strong>{visible.length}</strong> участников показано · из {people.length} опубликованных</p><button className="ir-btn ir-btn--solid" type="button" onClick={viewBenefits}>Подробнее о рейтинге и наградах <ArrowRight size={18}/></button></div>
      <section className="ir-leaderboard" aria-label="Все участники рейтинга">
        <div className="ir-list-head"><span>#</span><span>Участник</span><span>Статус</span><span>Баллы</span><span>Проекты</span><span>Достижения</span><span>Активность</span><span /></div>
        {visible.length === 0 && <div className="ir-empty"><Search size={30}/><strong>Участники не найдены</strong><p>{people.length === 0 ? "Подтверждённых записей пока нет." : "Измените поиск или фильтр рейтинга."}</p><button type="button" onClick={() => {updateParams({q:null,rank:null});}}>Сбросить фильтры</button></div>}
        {visible.map(item => <article key={item.place} className={["ir-leader-row", item.place <= 3 ? "ir-leader-row--"+String(item.place) : "", item.personId !== null && item.personId === current?.personId ? "ir-leader-row--me" : ""].join(" ")}>
          <span className="ir-rank">{item.place <= 3 ? <Crown size={22} /> : null}{item.place}</span>
          <div className="ir-person"><PersonAvatar person={item}/><div><button type="button" disabled={item.personId === null} title={item.personId === null ? "Личный профиль скрыт по настройкам приватности" : undefined} onClick={() => {openProfile(item);}}>{item.name}</button><small>{item.personId === null ? "Имя и профиль скрыты · " : ""}{item.projects} успешно выполненных проектов</small></div></div>
          <span className={"ir-status ir-status--" + (item.place <= 3 ? String(item.place) : "normal")}>{item.place === 1 ? "Лидер сезона" : item.personId !== null && item.personId === current?.personId ? "Ваш результат" : item.place <= 30 ? "Топ-участник" : "Участник"}</span>
          <strong className="ir-points">{item.points}<small> баллов</small></strong>
          <span className="ir-count"><BriefcaseBusiness size={16}/>{item.projects}</span>
          <div className="ir-achievements" aria-label={"Достижения " + item.name}>{item.achievements.length > 0 ? item.achievements.map(title => <Medal key={title} size={16} aria-label={title}/>) : "—"}</div>
          <span className="ir-activity">{item.activity}</span>
          <button type="button" className="ir-outline-button" disabled={item.personId === null} title={item.personId === null ? "Профиль скрыт по настройкам приватности" : undefined} onClick={() => {openProfile(item);}}>{item.personId === null ? "Профиль закрыт" : "Профиль"} <ArrowRight size={16} /></button>
        </article>)}
      </section>
      <div className="ir-disclaimer">Позиции и баллы берутся из опубликованного рейтинга. Имена отображаются только с разрешения участников.{season?.key.startsWith("demo-") ? " Демо-персоны вымышлены." : ""} Привилегии и сертификаты не выдаются автоматически.</div>
    </>}
    {screen === "benefits" && <>
      <div className="ir-breadcrumb"><button type="button" onClick={backToList}>Рейтинг</button><span className="ir-divider-chevron">›</span><strong>Награды и возможности</strong></div>
      <div className="ir-benefits-heading"><RatingHero compact title="Рейтинг подтверждённого опыта" eyebrow="ОПУБЛИКОВАННЫЙ РЕЙТИНГ" description="Баллы начисляются по опубликованным правилам сезона, а привилегии требуют отдельного подтверждения." seasonTitle={season?.title ?? "Нет сезона"} />
        <div className="ir-my-rank"><span><Crown size={20}/> Ваше место</span><strong>{ownStanding?.place ?? "—"}</strong><p>{ownStanding ? `${String(ownStanding.score ?? "—")} баллов · ${String(ownStanding.successful_projects ?? "—")} проектов` : ownQuery.isError ? "Личный результат временно недоступен" : "Нет опубликованной позиции"}</p><small>{ownStanding ? `Место №${String(ownStanding.place)}` : ownQuery.isError ? "Повторите загрузку" : "Результат не опубликован"}</small></div>
      </div>
      <div className="ir-benefits-showcase">{benefits.map(benefit => <BenefitTile key={benefit.key} benefit={benefit} onOpen={() => {setSelectedBenefit(benefit);}} />)}</div>
      <section className="ir-why"><div><h2>Почему это важно</h2><p>Рейтинг — не просто позиция. Это возможности для твоего роста.</p></div>
        {[{Icon:BriefcaseBusiness,title:"Реальные возможности",body:"Проекты, стажировки и доступ к партнёрам"},{Icon:ShieldCheck,title:"Больше доверия",body:"Результаты и достижения подтверждены"},{Icon:Users,title:"Доступ к сообществу",body:"Нетворкинг, наставники и закрытые события"},{Icon:Star,title:"Персональный рост",body:"Признание, поддержка и обратная связь"}].map(x=><article key={x.title}><x.Icon size={26}/><div><strong>{x.title}</strong><p>{x.body}</p></div></article>)}
      </section>
      <div className="ir-leaders-header"><div><span className="ir-eyebrow">ЛИДЕРЫ СЕЗОНА</span><h2>Участники, которые уже открыли возможности</h2></div><div className="ir-micro-stats"><span><Users size={17}/> {people.length} участников</span><span><Award size={17}/> {season?.title ?? "Сезон не опубликован"}</span></div><button className="ir-outline-button" type="button" onClick={backToList}>Смотреть весь список <ArrowRight size={17}/></button></div>
      <div className="ir-top-three">{people.slice(0,3).map(item => <article className={["ir-top-card","ir-top-card--"+item.palette].join(" ")} key={item.place}>
        <TrophyArtwork type={item.place===1?"top1":item.place===2?"top30":"hero"}/>
        <div className="ir-top-card-head"><span><Crown size={19}/> {item.place}</span><b>{item.points} баллов</b></div>
        <div className="ir-top-user"><PersonAvatar person={item} big/><div><strong>{item.name}</strong><small>{item.projects} завершённых проектов</small><span>{item.achievements[0]??"Участник программы"}</span></div></div>
        <button type="button" className="ir-outline-button" disabled={item.personId === null} onClick={() => {openProfile(item);}}>Открыть профиль <ArrowRight size={16}/></button>
      </article>)}</div>
      <p className="ir-disclaimer">Программа наград — концепция. Условия, квоты и выдача подтверждаются организаторами, а не самим фактом нахождения в рейтинге.</p>
    </>}
    {screen === "profile" && <>
      <div className="ir-breadcrumb"><button type="button" onClick={backToList}>Рейтинг</button><span className="ir-divider-chevron">›</span><strong>Профиль участника</strong></div>
      {person !== null && <header className="ir-profile-hero">
        <TrophyArtwork type="hero"/>
        <div className="ir-profile-identity"><PersonAvatar big person={person}/><div><span className="ir-eyebrow">ПРОФИЛЬ УЧАСТНИКА · {season?.title ?? "Сезон"}</span><h1 id="workspace-title">{person.name} <BadgeCheck size={26} aria-label="Опубликован"/></h1><p>Участник опубликованного рейтинга Impulse</p></div></div>
        <span className="ir-profile-position"><Crown size={17}/> Место {person.place}</span>
        <aside className="ir-profile-tools"><div className="ir-profile-buttons"><button type="button" className="ir-btn ir-btn--solid" onClick={() => {if(onOpenMessages)onOpenMessages();else setFeedback("Перейдите в раздел Сообщения для связи");}}><Mail size={17}/> Написать</button><button className="ir-outline-button" type="button" aria-pressed={favorites.has(person.place)} onClick={() => {setFavorites(previous => { const next = new Set(previous); if (next.has(person.place)) next.delete(person.place); else next.add(person.place); return next; });}}><Heart size={17} fill={favorites.has(person.place)?"currentColor":"none"}/>{favorites.has(person.place)?"В избранном":"В избранное"}</button><button type="button" className="ir-outline-button ir-icon-btn" aria-label="Поделиться профилем" onClick={() => {void shareProfile();}}><Share2 size={17}/></button></div>
          <div className="ir-profile-stats"><span><Crown size={19}/><strong>{person.place}</strong><small>Место в рейтинге</small></span><span><Flame size={19}/><strong>{person.points}</strong><small>Всего баллов</small></span><span><BriefcaseBusiness size={19}/><strong>{person.projects}</strong><small>Проектов</small></span></div></aside>
      </header>}
      {person === null && <p role="status" className="ir-disclaimer">Профиль недоступен или скрыт настройками приватности. Вернитесь в список участников.</p>}
      {person !== null && <div className="ir-profile-tabs" role="tablist" aria-label="Разделы профиля">{["Обзор","Достижения","Проекты","Оценки","Награды"].map(value=><button key={value} type="button" role="tab" aria-selected={tab===value} onClick={() => {setTab(value);}}>{value}</button>)}</div>}
      {person !== null && feedback && <div className="ir-feedback" role="status"><CircleCheck size={18}/>{feedback}<button type="button" onClick={()=>{setFeedback("");}} aria-label="Закрыть уведомление">×</button></div>}
      {person !== null && (tab==="Обзор"||tab==="Награды")&&<section className="ir-unlocks"><h2><LockKeyhole size={20}/> Открытые возможности</h2><div className="ir-unlock-grid">{levels.map((item)=>{const qualifies=item.label==="ТОП 1"?person.place===1:item.label==="ТОП 30"?person.place<=30:person.place<=50;const reward=benefits.find(benefit => benefit.place === item.label);if (!reward) return null;return <button type="button" key={item.label} className={"ir-unlock ir-unlock--"+reward.key} onClick={() => {setSelectedBenefit(reward);}}><item.icon size={25}/><strong>{item.label}</strong><span>{item.benefit}</span><small>{qualifies?<><Check size={15}/> В призовой зоне</>:<><LockKeyhole size={15}/> Пока недоступно</>}</small></button>;})}</div><p>Попадание в призовую зону не подтверждает фактическую выдачу награды. Организаторы проверяют результаты и утверждают условия.</p></section>}
      {person !== null && <div className="ir-profile-grid">
        {(tab==="Обзор"||tab==="Достижения")&&<section className="ir-profile-panel"><h2><Trophy size={19}/> Ключевые достижения</h2>{(person.achievements.length?person.achievements:["Подтверждённых наград нет"]).map((item)=><div className="ir-proof-row" key={item}><span><Medal size={20}/></span><div><strong>{item}</strong><small>Заявлено в опубликованном рейтинге</small></div></div>)}<button type="button" className="ir-subtle-action" onClick={viewBenefits}>Награды программы <ArrowRight size={16}/></button></section>}
        {(tab==="Обзор"||tab==="Проекты")&&<section className="ir-profile-panel"><h2><BriefcaseBusiness size={19}/> Завершённые проекты</h2><p className="ir-small-note">Подтверждённых проектов: {person.projects}. Детали проектов доступны только в портфолио с разрешением владельца.</p></section>}
        {(tab==="Обзор"||tab==="Оценки")&&<section className="ir-profile-panel ir-evaluation"><h2><Star size={19}/> Оценки и вклад</h2><p className="ir-small-note">Оценки компетенций не выводятся из позиции в рейтинге. Требуется отдельная подтверждённая оценка.</p></section>}
        {(tab==="Обзор"||tab==="Достижения"||tab==="Награды")&&<section className="ir-profile-panel"><h2><BadgeCheck size={19}/> Skill Passport и признание</h2><div className="ir-skill-passport"><FileBadge2 size={35}/><div><strong>Skill Passport</strong><span>Данные о результатах и достижениях</span><small>Награды проверяются отдельно от таблицы рейтинга</small></div></div><button type="button" className="ir-subtle-action" onClick={viewBenefits}>Условия признания <ArrowRight size={16}/></button></section>}
      </div>}
      <button type="button" className="ir-back-button" onClick={backToList}><ArrowLeft size={18}/> Вернуться в рейтинг</button>
    </>}
    {selectedBenefit && <RewardDialog benefit={selectedBenefit} onClose={() => {setSelectedBenefit(null);}} />}
  </div>;
}
