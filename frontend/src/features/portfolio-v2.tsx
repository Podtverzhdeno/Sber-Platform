import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Award, ArrowRight, BarChart3, BadgeCheck, BriefcaseBusiness,
  Check, CheckCircle2, ChevronRight, ClipboardCheck, Copy, ExternalLink,
  Eye, FileBadge2, FileCheck2, FolderKanban, GraduationCap, Link2, MapPin, Medal,
  MoreHorizontal, Pencil, Rocket, Share2, ShieldCheck, Sparkles, Star, Target, Trophy,
  Users, X, type LucideIcon,
} from "lucide-react";
import { apiRequest } from "../api/client";
import "./portfolio-v2.scss";

type Contribution = {
  contribution_id: string; project_title: string; personal_summary: string;
  artifact_keys: string[]; grade: string | null; review_reason: string | null; verification_status: string;
};
type Course = { key: string; title: string; status: string };
type Credential = { verification_id: string; title: string; status: string; credential_type?: "course" | "project_experience" | "season_award"; issuer?: string };
type Trophy = { title: string; organizer: string; source_url: string; trophy_type: string };
type Portfolio = {
  person_id: string; display_name: string; contributions: Contribution[]; courses: Course[];
  credentials: Credential[]; trophies: Trophy[]; offers: { title: string; basis: string }[];
  visibility: Record<string, boolean>; demo_data: boolean;
  about?: string | null; bio?: string | null; headline?: string | null; location?: string | null;
  public_url?: string | null;
};
type Passport = {
  verified_courses: string[];
  skills: { key: string; practical_level: string; confirmed_case_count: number }[];
  cases: { contribution_id: string; submitted_at: string; reviewer_id: string }[];
};
type ProjectDocument = {
  verification_id: string; holder_name: string; customer_name: string; task_title: string;
  project_key: string; period: string; personal_summary: string; artifact_keys: string[];
  grade_label: string; competencies: { competency: string; level: string }[];
  payment_status: string; status: string; superseded_by: string | null;
};
type Tab = "overview" | "passport" | "projects" | "certification" | "achievements" | "about";
type Scope = "hr_profile" | "public_profile" | "public_trophies";
const sections: { id: Tab; name: string; Icon: LucideIcon }[] = [
  { id: "overview", name: "Обзор", Icon: Sparkles },
  { id: "passport", name: "Skill Passport", Icon: BarChart3 },
  { id: "projects", name: "Проекты", Icon: FolderKanban },
  { id: "certification", name: "Сертификация", Icon: FileBadge2 },
  { id: "achievements", name: "Достижения", Icon: Trophy },
  { id: "about", name: "О себе", Icon: Users },
];
const demoPortfolio: Portfolio = {
  person_id: "demo-participant", display_name: "Алекс Речной", demo_data: true,
  about: "Разрабатываю цифровые продукты и исследую применение AI в реальных задачах. Интересуюсь инженерией, аналитикой и продуктовыми решениями.",
  visibility: { hr_profile: true, public_profile: true, public_trophies: true },
  contributions: [
    { contribution_id: "demo-1", project_title: "Рекомендательная система для научных статей",
      personal_summary: "Разработал ранжирование, воспроизводимый benchmark и API демонстрационного MVP.",
      artifact_keys: ["Репозиторий", "Отчёт об оценке", "Демонстрация"], grade: "A",
      review_reason: "Качество выше критериев, результат воспроизводится, личный вклад подтверждён историей артефактов.", verification_status: "verified" },
    { contribution_id: "demo-2", project_title: "Прогнозирование нагрузки контактного центра",
      personal_summary: "Подготовил признаки, baseline-модель и анализ ограничений внедрения.",
      artifact_keys: ["Notebook", "Model card"], grade: "B",
      review_reason: "Целевые метрики достигнуты, документация и вклад подтверждены.", verification_status: "verified" },
  ],
  courses: [{ key: "openspec", title: "OpenSpec и SDD", status: "verified" }, { key: "agents", title: "Агентная разработка", status: "verified" }],
  credentials: [{ verification_id: "DEMO-COURSE-1", title: "OpenSpec и SDD", status: "Проверяемый", credential_type: "course", issuer: "Impulse · демонстрация" }],
  trophies: [{ title: "Победитель МАЯКИ", organizer: "Сбер", source_url: "https://developers.sber.ru/", trophy_type: "Победа" }],
  offers: [],
};
const numberForGrade = (grade: string | null): number | null => {
  if (!grade) return null;
  const value = { A: 5, B: 4, C: 3, D: 2, E: 1 }[grade.toUpperCase() as "A" | "B" | "C" | "D" | "E"];
  if (value) return value;
  const parsed = Number(grade);
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 5 ? parsed : null;
};
const isAccepted = (value: Contribution) => ["verified", "accepted", "approved"].includes(value.verification_status.toLowerCase());
const csrf = (): HeadersInit => ({ "X-CSRF-Token": sessionStorage.getItem("impulse_csrf") ?? "" });

function PanelHeading({ icon: Icon, title, action, onAction }: { icon: LucideIcon; title: string; action?: string; onAction?: () => void }) {
  return <header className="p2-panel-heading"><span><Icon size={17} strokeWidth={2.4}/>{title}</span>{action && <button type="button" onClick={onAction}>{action}<ArrowRight size={14}/></button>}</header>;
}
function MiniArt({ index }: { index: number }) {
  return <div className={"p2-project-art p2-project-art--" + String(index % 3)} aria-hidden="true">
    <div className="p2-art-top"><i/><i/><i/><span/></div>
    <div className="p2-art-heading"/>
    <div className="p2-art-board"><div className="p2-art-bars"><i/><i/><i/><i/><i/><i/><i/><i/></div><svg viewBox="0 0 140 70" preserveAspectRatio="none"><polyline points="0,61 15,51 29,57 46,31 59,38 76,16 90,26 104,11 121,20 140,3" fill="none" stroke="#31e6dd" strokeWidth="2.3"/></svg></div>
    <div className="p2-art-footer"><i/><i/><i/></div>
  </div>;
}
function Radar({ skills }: { skills: Passport["skills"] }) {
  const values = Array.from({ length: 5 }, (_, i) => {
    const item = skills[i];
    const raw = item?.practical_level.match(/[1-5]/)?.[0];
    return raw ? Math.min(5, Math.max(1, Number(raw))) : item?.confirmed_case_count ? 1 : 0;
  });
  const pt = (index: number, scale: number) => {
    const theta = -Math.PI / 2 + index * Math.PI * 2 / 5;
    return [120 + Math.cos(theta) * 77 * scale, 100 + Math.sin(theta) * 77 * scale].join(",");
  };
  const labels = skills.slice(0, 5).map(s => s.key);
  return <svg className="p2-radar" viewBox="0 0 240 204" role="img" aria-label="Радар подтверждённых навыков">
    {[.25,.5,.75,1].map(s => <polygon key={s} points={Array.from({length:5},(_,i)=>pt(i,s)).join(" ")} fill="none" stroke="#204d66" strokeWidth="1.2"/>)}
    {Array.from({length:5},(_,i)=><line key={i} x1="120" y1="100" x2={pt(i,1).split(",")[0]} y2={pt(i,1).split(",")[1]} stroke="#204d66"/>)}
    <polygon points={values.map((v,i)=>pt(i,v / 5)).join(" ")} fill="#09dec0" fillOpacity=".26" stroke="#22f3dc" strokeWidth="2"/>
    {values.map((v,i)=><circle key={i} cx={Number(pt(i,v/5).split(",")[0])} cy={Number(pt(i,v/5).split(",")[1])} r="3.4" fill="#1df0e5"/>)}
    {Array.from({length:5},(_,i)=> {
      const x=120+Math.cos(-Math.PI/2+i*Math.PI*2/5)*103;
      const y=100+Math.sin(-Math.PI/2+i*Math.PI*2/5)*95;
      return <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fill="#9cbcd3" fontSize="10">{labels[i] ? labels[i].slice(0,15) : "—"}</text>;
    })}
  </svg>;
}
function Metric({ Icon, count, label }: { Icon: LucideIcon; count: string | number; label: string }) {
  return <div className="p2-metric"><span className="p2-metric-icon"><Icon size={21}/></span><div><strong>{count}</strong><small>{label}</small></div></div>;
}
function CredentialCard({ item, onSelect }: { item: Credential; onSelect: (item: Credential) => void }) {
  return <button className="p2-certificate" type="button" onClick={() => { onSelect(item); }}>
    <span className="p2-certificate-symbol"><GraduationCap size={23}/></span><span className="p2-certificate-description"><strong>{item.title}</strong><small>{item.issuer || "Impulse · документ"}</small><em>{item.verification_id}</em></span>
    <span className="p2-verified"><CheckCircle2 size={13}/> {item.status}</span>
  </button>;
}
function ProjectCard({ item, index, onSelect }: { item: Contribution; index: number; onSelect: (item: Contribution) => void }) {
  return <article className="p2-project">
    <MiniArt index={index}/>
    <div className="p2-project-info">
      <div className="p2-project-top"><h3>{item.project_title}</h3><span className={"p2-project-status" + (isAccepted(item) ? " is-accepted" : "")}><CheckCircle2 size={13}/>{isAccepted(item) ? "Принят заказчиком" : item.verification_status}</span></div>
      <p>{item.personal_summary}</p>
      <div className="p2-project-facts"><span><BarChart3 size={17}/> {item.grade ? "Оценка " + item.grade : "Без оценки"}</span><span><Users size={17}/> {item.artifact_keys.length} доказательств</span><span><ShieldCheck size={17}/> Личный вклад</span></div>
      <div className="p2-project-actions"><button className="p2-primary" type="button" onClick={() => { onSelect(item); }}>Открыть кейс <ArrowRight size={15}/></button><button className="p2-outline" type="button" onClick={() => { onSelect(item); }}><FolderKanban size={15}/> Доказательства · {item.artifact_keys.length}</button></div>
    </div>
  </article>;
}
export function ParticipantPortfolioV2() {
  const client = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("overview");
  const [openCase, setOpenCase] = useState<Contribution | null>(null);
  const [openCredential, setOpenCredential] = useState<Credential | null>(null);
  const [notice, setNotice] = useState("");
  const panelId = useId();
  const profileQuery = useQuery({ queryKey: ["portfolio"], queryFn: () => apiRequest<Portfolio>("/api/v1/me/portfolio"), refetchOnMount: "always" });
  const passportQuery = useQuery({ queryKey: ["talent-passport"], queryFn: () => apiRequest<Passport>("/api/v1/me/talent-passport"), refetchOnMount: "always" });
  const documentsQuery = useQuery({ queryKey: ["project-credentials"], queryFn: () => apiRequest<ProjectDocument[]>("/api/v1/me/project-credentials"), refetchOnMount: "always" });
  const consent = useMutation({
    mutationFn: ({ scope, granted }: { scope: Scope; granted: boolean }) => apiRequest(`/api/v1/me/consents/${scope}`, { method: "PUT", headers: csrf(), body: JSON.stringify({ granted }) }),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ["portfolio"] }); },
    onError: () => { setNotice("Не удалось сохранить настройку видимости. Попробуйте ещё раз."); },
  });
  useEffect(() => { if (!notice) return; const t = window.setTimeout(() => setNotice(""), 4000); return () => { window.clearTimeout(t); }; }, [notice]);
  useEffect(() => {
    if (!openCase && !openCredential) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpenCase(null); setOpenCredential(null); } };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); };
  }, [openCase, openCredential]);

  if (profileQuery.isPending) return <div className="p2-loading" role="status">Загружаем подтверждённое портфолио…</div>;
  const portfolio = profileQuery.data ?? demoPortfolio;
  const contributions = portfolio.contributions;
  const verifiedProjects = contributions.filter(isAccepted);
  const skills = passportQuery.data?.skills ?? [];
  const credentials = portfolio.credentials;
  const certificates = credentials.filter(i => i.credential_type === "course");
  const trophies = portfolio.trophies;
  const allGrades = verifiedProjects.map(x => numberForGrade(x.grade)).filter((n): n is number => n !== null);
  const grade = allGrades.length ? (allGrades.reduce((a,b)=>a+b,0) / allGrades.length).toFixed(1) : "—";
  const bio = portfolio.about || portfolio.bio || (portfolio.demo_data ? demoPortfolio.about : null);
  const verified = verifiedProjects.length > 0 || skills.some(s => s.confirmed_case_count > 0);
  const showProjects = tab === "overview" || tab === "projects";
  const showPassport = tab === "overview" || tab === "passport";
  const showCerts = tab === "overview" || tab === "certification";
  const showAchievements = tab === "overview" || tab === "achievements";
  const showAbout = tab === "overview" || tab === "about";
  const openTab = (next: Tab) => { setTab(next); };
  const navigateTo = (section: number) => { void navigate("/workspace/" + String(section)); };
  const share = async () => {
    try {
      await navigator.clipboard.writeText(portfolio.public_url || window.location.href);
      setNotice(portfolio.public_url ? "Ссылка на публичный профиль скопирована" : "Ссылка на текущую страницу скопирована. Для внешнего доступа нужна публичная ссылка.");
    } catch { setNotice("Не удалось скопировать ссылку. Проверьте разрешения браузера."); }
  };
  return <main className="p2-root" data-testid="portfolio-v2" data-current-tab={tab}>
    {profileQuery.isError && <div className="p2-warning" role="alert">API портфолио недоступен — показаны демонстрационные данные. <button onClick={() => void profileQuery.refetch()} type="button">Повторить</button></div>}
    {passportQuery.isError && <div className="p2-warning" role="status">Skill Passport временно недоступен. <button onClick={() => void passportQuery.refetch()} type="button">Повторить</button></div>}
    {notice && <div className="p2-notice" role="status">{notice}</div>}
    <section className="p2-hero" aria-labelledby="workspace-title">
      <div className="p2-hero-top">
        <div className="p2-avatar" aria-hidden="true">{portfolio.demo_data && portfolio.display_name === "Алекс Речной" ? <img src="/home-reference/avatar.svg" alt="" /> : <span>{portfolio.display_name.split(" ").map(part => part[0]).slice(0,2).join("").toUpperCase()}</span>}{verified && <i><Check size={14}/></i>}</div>
        <div className="p2-person"><div className="p2-overline">ПОДТВЕРЖДЁННЫЙ ПРОФИЛЬ УЧАСТНИКА</div><div className="p2-name-line"><h1 id="workspace-title">{portfolio.display_name}</h1>{verified && <span className="p2-identity-badge"><BadgeCheck size={15}/> Есть подтверждённые результаты</span>}</div><p>Участник Impulse</p><div className="p2-person-about">{portfolio.headline || bio || "Здесь появится описание профессиональных интересов, специализации и практического опыта."}</div></div>
        <div className="p2-hero-controls"><div className="p2-hero-buttons"><button className="p2-primary" type="button" onClick={() => { navigateTo(12); }}><Pencil size={16}/> Редактировать профиль</button><button className="p2-outline" type="button" onClick={() => void share()}><Share2 size={16}/> Поделиться</button><button className="p2-outline p2-more" aria-label="Настроить видимость" type="button" onClick={() => { openTab("about"); }}><MoreHorizontal size={19}/></button></div><div className="p2-skill-chips">{skills.slice(0,4).map(s => <span key={s.key}>{s.key}</span>)}{skills.length>4 && <span>+{skills.length-4}</span>}{skills.length === 0 && <span>Навыки пока не подтверждены</span>}</div></div>
      </div>
      <div className="p2-metrics">
        <Metric Icon={FolderKanban} count={verifiedProjects.length} label="Принятых проектов"/>
        <Metric Icon={Users} count={passportQuery.isError ? "—" : skills.filter(s => s.confirmed_case_count > 0).length} label="Подтверждённых навыков"/>
        <Metric Icon={FileBadge2} count={certificates.length} label="Сертификатов курсов"/>
        <Metric Icon={Trophy} count={trophies.length} label="Достижений"/>
        <Metric Icon={Star} count={grade} label="Средняя оценка"/>
      </div>
    </section>
    <nav className="p2-tabs" role="tablist" aria-label="Разделы портфолио">
      {sections.map(({id,name,Icon}) => <button key={id} id={panelId+"-"+id} role="tab" aria-selected={tab===id} aria-controls={panelId+"-panel"} className={tab===id ? "is-active" : ""} type="button" onClick={()=>{ openTab(id); }}><Icon size={18}/>{name}</button>)}
    </nav>
    <div className="p2-sections" role="tabpanel" id={panelId+"-panel"} aria-labelledby={panelId+"-"+tab}>
      <div className={"p2-content-grid" + (tab !== "overview" ? " p2-content-grid--single" : "")}>
        {showProjects && <section className="p2-panel p2-projects-panel" aria-label="Лучшие проекты">
          <PanelHeading icon={Star} title={tab==="overview"?"ЛУЧШИЕ ПРОЕКТЫ":"ПРОЕКТЫ И ПРАКТИЧЕСКИЙ ОПЫТ"} action={tab==="overview"?"Все проекты":"Открыть раздел проектов"} onAction={()=>{ if(tab==="overview") openTab("projects"); else navigateTo(4); }}/>
          <div className="p2-project-list">{(tab==="overview"?verifiedProjects.slice(0,2):contributions).map((item,index)=><ProjectCard item={item} index={index} key={item.contribution_id} onSelect={setOpenCase}/>)}</div>
          {(tab==="overview"?verifiedProjects:contributions).length===0 && <div className="p2-empty"><FolderKanban size={27}/><strong>Пока нет принятых проектов</strong><p>После проверки личного вклада здесь появятся кейсы с доказательствами.</p><button type="button" className="p2-primary" onClick={()=>{ navigateTo(4); }}>Мои проекты <ArrowRight size={14}/></button></div>}
          {tab==="overview"&&verifiedProjects.length>2 && <button type="button" className="p2-show-all" onClick={()=>{ openTab("projects"); }}>Показать все {verifiedProjects.length} проектов <ArrowRight size={15}/></button>}
        </section>}
        {showPassport && <section className="p2-panel p2-passport-panel" aria-label="Skill Passport">
          <PanelHeading icon={BarChart3} title="SKILL PASSPORT" action={tab==="overview"?"Открыть":"Подробнее в аналитике"} onAction={()=>{ if(tab==="overview") openTab("passport"); else navigateTo(9); }}/>
          <div className="p2-passport-body"><div className="p2-radar-wrap"><Radar skills={skills}/></div><div className="p2-skill-levels"><h3>Уровень компетенций</h3>{skills.slice(0,5).map((s)=>{
            const m=s.practical_level.match(/[1-5]/);
            const level=m ? Math.min(5,Number(m[0])) : null;
            return <div className="p2-skill-level" key={s.key}><span>{s.key}</span><i><b style={{width:level?String(level*20)+"%":"0%"}}/></i><em>{level?String(level)+"/5":"—"}</em></div>;
          })}{skills.length===0 && <p className="p2-inline-empty">Подтверждённые компетенции появятся после оценки кейсов.</p>}</div></div>
          <div className="p2-passport-footer"><div className="p2-passport-count"><Award size={19}/><strong>{skills.filter(s=>s.confirmed_case_count>0).length}</strong><small>практически подтверждённых навыков</small></div><button className="p2-primary" type="button" onClick={()=>{ navigateTo(9); }}>Открыть Skill Passport <ArrowRight size={15}/></button></div>
        </section>}
        {showCerts && <section className="p2-panel p2-certs-panel" aria-label="Сертификация">
          <PanelHeading icon={FileBadge2} title="СЕРТИФИКАЦИЯ" action={tab==="overview"?"Все сертификаты":"Перейти в аналитику"} onAction={()=>{ if(tab==="overview") openTab("certification"); else navigateTo(9); }}/>
          <div className="p2-cert-list">{certificates.slice(0,tab==="overview"?3:20).map(item=><CredentialCard key={item.verification_id} item={item} onSelect={setOpenCredential}/>)}</div>
          {certificates.length===0 && <div className="p2-inline-empty">Проверяемые сертификаты курсов пока не выданы. Пройденные курсы доступны в Bootcamp.</div>}
          {tab==="certification" && (documentsQuery.data??[]).length>0 && <div className="p2-document-list"><h3>Документы проектного опыта</h3>{(documentsQuery.data??[]).map(item=><a key={item.verification_id} href={"/verify/projects/"+encodeURIComponent(item.verification_id)}><FileCheck2 size={20}/><span>{item.task_title}<small>{item.customer_name} · {item.grade_label}</small></span><ExternalLink size={15}/></a>)}</div>}
        </section>}
        {showAchievements && <section className="p2-panel p2-achievements-panel" aria-label="Достижения">
          <PanelHeading icon={Trophy} title="ДОСТИЖЕНИЯ" action={tab==="overview"?"Все достижения":"Перейти в достижения"} onAction={()=>{ if(tab==="overview") openTab("achievements"); else navigateTo(8); }}/>
          {trophies.length>0?<div className="p2-trophies">{trophies.slice(0,tab==="overview"?2:30).map((item,i)=><a href={item.source_url} target="_blank" rel="noopener noreferrer" key={item.title+"-"+String(i)}><span className="p2-trophy-icon"><Medal size={23}/></span><span><strong>{item.title}</strong><small>{item.organizer} · {item.trophy_type}</small></span><ExternalLink size={14}/></a>)}</div>:<div className="p2-inline-empty">Подтверждённых достижений пока нет.</div>}
        </section>}
        {showAbout && <section className="p2-panel p2-about-panel" aria-label="О себе">
          <PanelHeading icon={Users} title="О СЕБЕ" action="Редактировать" onAction={()=>{ navigateTo(12); }}/>
          <p>{bio || "Добавьте профессиональное описание: чем занимаетесь, какие задачи решаете и какие возможности рассматриваете."}</p>
          <div className="p2-about-chips">{portfolio.location && <span><MapPin size={15}/>{portfolio.location}</span>}<span><BriefcaseBusiness size={15}/>Профессиональный профиль</span><span><Link2 size={15}/>{portfolio.public_url?"Публичная ссылка доступна":"Ссылка не опубликована"}</span></div>
        </section>}
        {(tab==="overview" || tab==="about" || tab==="projects") && <section className="p2-panel p2-trust-panel" aria-label="Доказательства и доверие">
          <PanelHeading icon={ShieldCheck} title="ДОКАЗАТЕЛЬСТВА И ДОВЕРИЕ" action="Все подтверждения" onAction={()=>{ openTab("projects"); }}/>
          <div className="p2-trust-list">{verifiedProjects.slice(0,2).map(x=><button key={x.contribution_id} type="button" onClick={()=>{ setOpenCase(x); }}><span className="p2-trust-icon"><ClipboardCheck size={18}/></span><span><strong>Проект принят заказчиком</strong><small>{x.project_title}</small></span><CheckCircle2 size={17}/></button>)}
            {certificates.slice(0,2).map(c=><button key={c.verification_id} type="button" onClick={()=>{ setOpenCredential(c); }}><span className="p2-trust-icon"><GraduationCap size={18}/></span><span><strong>Сертификат курса</strong><small>{c.title}</small></span><CheckCircle2 size={17}/></button>)}
            {verifiedProjects.length===0&&certificates.length===0&&<div className="p2-inline-empty">Здесь появятся подтверждения проектов и обучения.</div>}
          </div>
        </section>}
        {(tab==="overview" || tab==="about") && <section className="p2-panel p2-visibility-panel" aria-label="Карьерная видимость">
          <PanelHeading icon={Eye} title="КАРЬЕРНАЯ ВИДИМОСТЬ"/>
          <p>Управляйте доступом HR, заказчиков и участников к вашим подтверждённым результатам.</p>
          <div className="p2-visibility-controls">
            {([
              ["hr_profile","Резюме для HR"],
              ["public_profile","Публичный профиль"],
              ["public_trophies","Публичные достижения"],
            ] as [Scope,string][]).map(([scope,label])=><label key={scope}><span>{label}</span><input type="checkbox" aria-label={label} checked={Boolean(portfolio.visibility[scope])} disabled={consent.isPending || profileQuery.isError} onChange={e=>{ consent.mutate({scope,granted:e.target.checked}); }}/></label>)}
          </div>
          <button type="button" className="p2-visibility-share" onClick={()=>void share()}><Copy size={14}/>{portfolio.public_url?"Скопировать публичную ссылку":"Поделиться страницей"}<ChevronRight size={15}/></button>
        </section>}
        {tab==="achievements" && portfolio.offers.length>0 && <section className="p2-panel p2-offers"><PanelHeading icon={Rocket} title="КАРЬЕРНЫЕ ВОЗМОЖНОСТИ"/>{portfolio.offers.map((x,i)=><article key={i}><strong>{x.title}</strong><p>{x.basis}</p></article>)}</section>}
        {tab==="passport"&&<section className="p2-panel p2-passport-detail"><PanelHeading icon={Target} title="ПОДТВЕРЖДАЮЩИЕ КЕЙСЫ"/>{skills.map(s=><div key={s.key} className="p2-skill-detail"><strong>{s.key}</strong><span>{s.confirmed_case_count} подтверждённых кейсов</span><em>{s.practical_level || "Уровень не определён"}</em></div>)}{skills.length===0&&<div className="p2-inline-empty">Данные о навыках пока не поступили.</div>}</section>}
      </div>
    </div>
    {(openCase || openCredential) && <div className="p2-modal-scrim" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget){setOpenCase(null);setOpenCredential(null);}}}>
      <section className="p2-modal" role="dialog" aria-modal="true" aria-label={openCase?"Подтверждённый проект":"Сертификат"}><button type="button" className="p2-modal-close" aria-label="Закрыть" onClick={()=>{setOpenCase(null);setOpenCredential(null);}}><X size={22}/></button>
        {openCase ? <><div className="p2-overline">КЕЙС И ДОКАЗАТЕЛЬСТВА</div><h2>{openCase.project_title}</h2><span className="p2-identity-badge"><BadgeCheck size={16}/>{isAccepted(openCase)?"Принят заказчиком":"Статус: "+openCase.verification_status}</span><h3>Личный вклад</h3><p>{openCase.personal_summary}</p><h3>Оценка и комментарий</h3><p>{openCase.grade??"Без оценки"} · {openCase.review_reason||"Комментарий ещё не предоставлен"}</p><h3>Связанные артефакты</h3><ul>{openCase.artifact_keys.map((key,i)=><li key={key+"-"+String(i)}><FileCheck2 size={17}/>{key}</li>)}</ul><p className="p2-modal-note">Для доступа к исходным файлам требуется разрешённая ссылка на артефакт. Названия файлов не являются прямыми ссылками.</p></> :
        openCredential && <><div className="p2-overline">СЕРТИФИКАЦИЯ</div><h2>{openCredential.title}</h2><p>{openCredential.issuer || "Impulse"}</p><h3>Идентификатор документа</h3><p>{openCredential.verification_id}</p><h3>Статус</h3><p>{openCredential.status}</p><p className="p2-modal-note">Информация получена из реестра портфолио.</p></>}
      </section>
    </div>}
  </main>;
}
