import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { apiRequest } from "../api/client";
import { Badge, SafeExternalLink, StatePanel } from "../components/ui";
import { ParticipantRatingV2 } from "./rating-v2/page";

type Contribution = { contribution_id: string; project_title: string; personal_summary: string; artifact_keys: string[]; grade: string | null; review_reason: string | null; verification_status: string };
type Course = { key: string; title: string; status: string };
type Credential = { verification_id: string; title: string; status: string; credential_type?: "course" | "project_experience" | "season_award"; issuer?: string };
type ProjectDocument = { verification_id: string; holder_name: string; customer_name: string; task_title: string; project_key: string; period: string; personal_summary: string; artifact_keys: string[]; grade_label: string; competencies: { competency: string; level: string }[]; payment_status: string; status: string; superseded_by: string | null };
type Trophy = { title: string; organizer: string; source_url: string; trophy_type: string };
type Portfolio = { person_id: string; display_name: string; contributions: Contribution[]; courses: Course[]; credentials: Credential[]; trophies: Trophy[]; offers: { title: string; basis: string }[]; visibility: Record<string, boolean>; demo_data: boolean };

const csrfHeaders = (): HeadersInit => ({ "X-CSRF-Token": sessionStorage.getItem("impulse_csrf") ?? "" });
type VisibilityScope = "hr_profile" | "public_profile" | "public_trophies";
const visibilityOptions: { scope: VisibilityScope; title: string; detail: string }[] = [
  { scope: "hr_profile", title: "Резюме для HR", detail: "Разрешает HR найти профиль и открыть только доказательства из этого резюме." },
  { scope: "public_profile", title: "Публичный профиль", detail: "Показывает выбранные подтверждения по публичной ссылке." },
  { scope: "public_trophies", title: "Публичные трофеи", detail: "Показывает только проверенные достижения и их источники." },
];

const demoPortfolio: Portfolio = {
  person_id: "demo-participant",
  display_name: "Алекс Речной",
  demo_data: true,
  visibility: { hr_profile: true, public_profile: true, public_trophies: true },
  contributions: [
    { contribution_id: "demo-1", project_title: "Прототип рекомендательной системы", personal_summary: "Разработал ранжирование, воспроизводимый benchmark и API демонстрационного MVP.", artifact_keys: ["repository", "evaluation-report.pdf", "demo-video"], grade: "A", review_reason: "Качество выше критериев, результат воспроизводится, личный вклад подтверждён историей артефактов.", verification_status: "verified" },
    { contribution_id: "demo-2", project_title: "Прогнозирование нагрузки контактного центра", personal_summary: "Подготовил признаки, baseline-модель и анализ ограничений внедрения.", artifact_keys: ["notebook", "model-card"], grade: "B", review_reason: "Целевые метрики достигнуты, документация и вклад подтверждены.", verification_status: "verified" },
  ],
  courses: [{ key: "openspec", title: "OpenSpec и SDD", status: "verified" }, { key: "agents", title: "Разработка с AI-агентами", status: "verified" }],
  credentials: [
    { verification_id: "COURSE-OS-2026-0142", title: "OpenSpec и SDD", status: "Проверяемый", credential_type: "course", issuer: "Impulse Bootcamp · демонстрационный образец" },
    { verification_id: "PROJECT-RD-2026-0088", title: "Прогнозирование нагрузки", status: "Подписан заказчиком", credential_type: "project_experience", issuer: "Роман Воронов · заказчик" },
    { verification_id: "IMP-2026-GOLD-0042", title: "Диплом Impulse · Gold", status: "Проверяемый", credential_type: "season_award", issuer: "Impulse · сезон 2026" },
  ],
  trophies: [{ title: "Победитель МАЯКИ", organizer: "Сбер", source_url: "https://developers.sber.ru/", trophy_type: "Победа" }],
  offers: [{ title: "Приглашение на стажировку", basis: "Решение HR после просмотра подтверждённого портфолио и интервью." }],
};

export function ParticipantPortfolio() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["portfolio"], queryFn: () => apiRequest<Portfolio>("/api/v1/me/portfolio"), refetchOnMount: "always" });
  const passport = useQuery({ queryKey: ["talent-passport"], queryFn: () => apiRequest<{ verified_courses: string[]; skills: { key: string; practical_level: string; confirmed_case_count: number }[]; cases: { contribution_id: string; submitted_at: string; reviewer_id: string }[] }>("/api/v1/me/talent-passport"), refetchOnMount: "always" });
  const projectDocuments = useQuery({ queryKey: ["project-credentials"], queryFn: () => apiRequest<ProjectDocument[]>("/api/v1/me/project-credentials"), refetchOnMount: "always" });
  const [notice, setNotice] = useState("");
  const [selectedContribution, setSelectedContribution] = useState<Contribution | null>(null);
  const consent = useMutation({
    mutationFn: ({ scope, granted }: { scope: VisibilityScope; granted: boolean }) => apiRequest(`/api/v1/me/consents/${scope}`, { method: "PUT", headers: csrfHeaders(), body: JSON.stringify({ granted }) }),
    onSuccess: async () => client.invalidateQueries({ queryKey: ["portfolio"] }),
  });
  const announce = (message: string) => { setNotice(message); window.setTimeout(() => { setNotice(""); }, 2600); };
  if (query.isLoading) return <StatePanel kind="loading" />;
  const portfolio = query.data ?? demoPortfolio;
  const best = portfolio.contributions[0];
  const otherContributions = portfolio.contributions.slice(1);
  const graded = portfolio.contributions.filter((item) => item.grade);
  const averageGrade = graded.length ? (graded.reduce((sum, item) => sum + (item.grade === "A" ? 5 : item.grade === "B" ? 4 : 3), 0) / graded.length).toFixed(1) : "—";
  const competencies = passport.data?.skills ?? [];
  return <div className="feature-stack portfolio-page portfolio-showcase" data-reference="R-PAR-08">
    {query.isError && <div className="demo-fallback-note" role="status"><strong>Показана демонстрационная проекция</strong><span>API портфолио временно недоступен; экран остаётся доступным для презентации.</span><button className="secondary-button" type="button" onClick={() => { void query.refetch(); }}>Повторить загрузку</button></div>}
    {passport.isError && <StatePanel kind="error" action="Повторить загрузку паспорта" onAction={() => { void passport.refetch(); }} />}
    {notice && <div className="success-banner" role="status"><span>✓</span><div><strong>{notice}</strong><small>Действие выполнено.</small></div></div>}

    <section className="portfolio-profile-card" aria-labelledby="workspace-title">
      <div className="portfolio-identity"><span className="portfolio-avatar">АР<i>✓</i></span><div><p className="eyebrow">Подтверждённый профиль участника</p><h1 id="workspace-title">{portfolio.display_name}</h1><p>Участник Impulse</p></div></div>
      <div className="portfolio-profile-actions"><button type="button" onClick={() => { window.location.assign("/workspace/12"); }}>Редактировать профиль</button><button className="secondary-button" type="button" onClick={() => { void navigator.clipboard.writeText(window.location.href); announce("Ссылка на портфолио скопирована"); }}>Поделиться</button></div>
      <div className="portfolio-kpis"><div><span>Принятые вклады</span><strong>{portfolio.contributions.length}</strong><small>подтверждены заказчиком</small></div><div><span>Средняя оценка</span><strong>{averageGrade}</strong><small>по системе 5+</small></div><div><span>Сертификаты</span><strong>{portfolio.credentials.length}</strong><small>с проверяемым ID</small></div><div><span>Трофеи</span><strong>{portfolio.trophies.length}</strong><small>проверены платформой</small></div></div>
      <div className="portfolio-skills"><strong>Подтверждённые навыки</strong><div>{competencies.map((skill) => <span key={skill.key}>{skill.key}<i>✓</i></span>)}{competencies.length === 0 && <span>Пока нет подтверждённых практических навыков</span>}</div></div>
    </section>

    {best && <section className="featured-contribution" aria-labelledby="featured-contribution-title">
      <div className="featured-copy"><div className="section-heading"><div><p className="eyebrow">Главный кейс</p><h2 id="featured-contribution-title">Мой лучший принятый вклад</h2><h3>{best.project_title}</h3></div><div className="featured-grade"><span>Оценка 5+</span><strong>{best.grade ?? "—"}</strong></div></div><p className="featured-lead">Принятый личный вклад и связанные доказательства.</p><dl><div><dt>Мой вклад</dt><dd>{best.personal_summary}</dd></div><div><dt>Результат для проекта</dt><dd>Результат принят заказчиком в рамках условий задачи.</dd></div></dl>{best.review_reason && <blockquote><span className="mentor-avatar">ЕН</span><div><strong>Комментарий проверяющего</strong><p>«{best.review_reason}»</p></div></blockquote>}<div className="featured-actions"><button type="button" onClick={() => { setSelectedContribution(best); }}>Открыть кейс</button><button className="secondary-button" type="button" onClick={() => { announce("Доказательства доступны в карточке кейса"); }}>Посмотреть доказательства · {best.artifact_keys.length}</button></div></div>
      <aside className="featured-visual competency-evidence" aria-label="Матрица выявленных компетенций"><header><div><p className="eyebrow">Матрица компетенций</p><h3>Чем выделяется кандидат</h3></div><span className="talent-index">По доказательствам</span></header><p className="competency-explanation">Практический уровень появляется только после принятого личного вклада с доказательствами. Курсы отображаются отдельно.</p><div className="competency-rows">{competencies.length === 0 && <p>Практические компетенции появятся после принятия личного вклада по кейсу.</p>}{competencies.map((item) => <div className="competency-row" key={item.key}><div><strong>{item.key}</strong><span>{item.confirmed_case_count} подтверждённых кейсов</span></div><em>Подтверждено</em></div>)}</div><footer><span><i className="evidence-dot evidence-dot--project" />Проекты</span><span><i className="evidence-dot evidence-dot--course" />Курсы</span><span><i className="evidence-dot evidence-dot--human" />Оценка человека</span></footer></aside>
    </section>}

    <section className="accepted-contributions" aria-labelledby="accepted-contributions-title"><div className="section-heading"><div><p className="eyebrow">Практический опыт</p><h2 id="accepted-contributions-title">Принятые вклады</h2></div><Badge tone="success">{portfolio.contributions.length} подтверждено</Badge></div><div className="contribution-table">{(otherContributions.length ? otherContributions : portfolio.contributions).map((item) => <button type="button" key={item.contribution_id} onClick={() => { setSelectedContribution(item); }}><span className="contribution-project-icon">▤</span><div><strong>{item.project_title}</strong><small>Аналитика · R&amp;D / MVP</small></div><Badge tone="success">Принято</Badge><span className="contribution-grade">{item.grade ?? "—"}</span><span>{item.artifact_keys.length} доказательства</span><i>›</i></button>)}</div></section>

    <div className="portfolio-evidence-layout"><section className="learning-evidence"><div className="section-heading"><div><p className="eyebrow">Обучение</p><h2>Курсы и сертификаты</h2></div><Badge>{portfolio.credentials.length}</Badge></div>{portfolio.credentials.map((item) => <button type="button" className="portfolio-document" key={item.verification_id} onClick={() => { announce(`Открыт документ ${item.verification_id}`); }}><span className="document-mark">◇</span><div><small>{item.credential_type === "course" ? "Сертификат курса" : item.credential_type === "project_experience" ? "Проектный сертификат" : "Диплом сезона"}</small><strong>{item.title}</strong><span>{item.issuer}</span></div><Badge tone="success">Проверяемый</Badge><i>›</i></button>)}{(projectDocuments.data ?? []).map((item) => <a className="portfolio-document" href={`/verify/projects/${encodeURIComponent(item.verification_id)}`} key={item.verification_id}><span className="document-mark">▤</span><div><small>Проектный документ · {item.period} · {item.payment_status}</small><strong>{item.task_title}</strong><span>{item.customer_name} · {item.grade_label}</span></div>{item.superseded_by ? <Badge tone="warning">Обновлён</Badge> : <Badge tone="success">Подписан</Badge>}<i>›</i></a>)}{portfolio.credentials.length === 0 && (projectDocuments.data ?? []).length === 0 && portfolio.courses.map((course) => <article className="evidence-row" key={course.key}><span className="evidence-icon">✓</span><div><strong>{course.title}</strong><small>Завершение проверено платформой</small></div><Badge tone="success">Подтверждено</Badge></article>)}</section>
      <section className="recognition-evidence"><div className="section-heading"><div><p className="eyebrow">Recognition</p><h2>Трофеи и достижения</h2></div><Badge>{portfolio.trophies.length + portfolio.offers.length}</Badge></div>{portfolio.trophies.map((item) => <SafeExternalLink className="portfolio-trophy" href={item.source_url} key={`${item.organizer}-${item.title}`}><span>★</span><div><small>{item.trophy_type} · {item.organizer}</small><strong>{item.title}</strong><em>Открыть подтверждение</em></div><i>›</i></SafeExternalLink>)}{portfolio.offers.map((item) => <article className="portfolio-trophy portfolio-offer" key={item.title}><span>✦</span><div><small>Подтверждённый личный оффер</small><strong>{item.title}</strong><em>{item.basis}</em></div></article>)}{portfolio.trophies.length === 0 && portfolio.offers.length === 0 && <StatePanel kind="empty" />}</section></div>

    <section className="portfolio-hr-panel" aria-labelledby="visibility-title"><div className="hr-status-card"><div><span className={`hr-status-dot${portfolio.visibility.hr_profile ? " active" : ""}`} /><div><p className="eyebrow">Карьерная видимость</p><h2 id="visibility-title">Профиль {portfolio.visibility.hr_profile ? "открыт" : "закрыт"} для HR</h2></div></div><p>Рекрутеры видят только разрешённые подтверждённые данные. Настройки можно изменить в любой момент.</p><div className="hr-activity"><div><strong>24</strong><span>просмотра</span><small>за 30 дней</small></div><div><strong>3</strong><span>запроса контакта</span><small>требуют решения</small></div><div><strong>1</strong><span>приглашение</span><small>на стажировку</small></div></div></div><div className="visibility-grid">{visibilityOptions.map((item) => <label className="visibility-control" key={item.scope}><span><strong>{item.title}</strong><small>{item.detail}</small></span><input type="checkbox" checked={portfolio.visibility[item.scope] === true} disabled={consent.isPending} onChange={(event) => { consent.mutate({ scope: item.scope, granted: event.target.checked }); }} /></label>)}</div></section>

    {selectedContribution && <div className="overlay" role="presentation"><section className="overlay-panel overlay-panel--dialog portfolio-case-dialog" role="dialog" aria-modal="true" aria-label="Карточка принятого вклада"><header><div><p className="eyebrow">Подтверждённый кейс</p><h2>{selectedContribution.project_title}</h2></div><button type="button" aria-label="Закрыть" onClick={() => { setSelectedContribution(null); }}>×</button></header><Badge tone="success">Вклад принят · оценка {selectedContribution.grade ?? "—"}</Badge><h3>Личный вклад</h3><p>{selectedContribution.personal_summary}</p><h3>Почему поставлена оценка</h3><p>{selectedContribution.review_reason ?? "Результат и личный вклад подтверждены заказчиком."}</p><h3>Доказательства</h3><div className="case-artifacts">{selectedContribution.artifact_keys.map((key) => <button type="button" key={key} onClick={() => { announce(`Открыт артефакт ${key}`); }}>{key} ↗</button>)}</div></section></div>}
  </div>;
}


/** Preserve the established participant route; the full UI is scoped to Rating V2. */
export function ParticipantRating() {
  const navigate = useNavigate();
  return <ParticipantRatingV2 onOpenMessages={() => { void navigate("/workspace/10"); }} />;
}
