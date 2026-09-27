import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiRequest } from "../api/client";
import { Badge, Card, StatePanel } from "../components/ui";

type Contribution = { contribution_id: string; project_title: string; personal_summary: string; artifact_keys: string[]; grade: string | null; review_reason: string | null; verification_status: string };
type Course = { key: string; title: string; status: string };
type Credential = { verification_id: string; title: string; status: string };
type Trophy = { title: string; organizer: string; source_url: string; trophy_type: string };
type Portfolio = { person_id: string; display_name: string; contributions: Contribution[]; courses: Course[]; credentials: Credential[]; trophies: Trophy[]; offers: { title: string; basis: string }[]; visibility: Record<string, boolean>; demo_data: boolean };

const csrfHeaders = (): HeadersInit => ({ "X-CSRF-Token": sessionStorage.getItem("impulse_csrf") ?? "" });
type VisibilityScope = "hr_profile" | "public_profile" | "public_trophies";
const visibilityOptions: { scope: VisibilityScope; title: string; detail: string }[] = [
  { scope: "hr_profile", title: "Резюме для HR", detail: "Разрешает HR найти профиль и открыть только доказательства из этого резюме." },
  { scope: "public_profile", title: "Публичный профиль", detail: "Показывает выбранные подтверждения по публичной ссылке." },
  { scope: "public_trophies", title: "Публичные трофеи", detail: "Показывает только проверенные достижения и их источники." },
];

export function ParticipantPortfolio() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["portfolio"], queryFn: () => apiRequest<Portfolio>("/api/v1/me/portfolio"), refetchOnMount: "always" });
  const consent = useMutation({
    mutationFn: ({ scope, granted }: { scope: VisibilityScope; granted: boolean }) => apiRequest(`/api/v1/me/consents/${scope}`, { method: "PUT", headers: csrfHeaders(), body: JSON.stringify({ granted }) }),
    onSuccess: async () => client.invalidateQueries({ queryKey: ["portfolio"] }),
  });
  if (query.isLoading) return <StatePanel kind="loading" />;
  if (query.isError || !query.data) return <StatePanel kind="error" action="Повторить" onAction={() => { void query.refetch(); }} />;
  const portfolio = query.data;
  return <div className="feature-stack portfolio-page">
    <header className="portfolio-hero"><div><p className="eyebrow">Evidence-first резюме</p><h1 id="workspace-title">Подтверждённый опыт</h1><p className="lead">Каждый факт связан с конкретным проектом, личным вкладом и решением человека. Вы сами определяете, кто увидит профиль.</p></div><div className="portfolio-score"><span>Успешных проектов</span><strong>{portfolio.contributions.length}</strong><small>Демо-данные</small></div></header>
    <section className="visibility-panel" aria-labelledby="visibility-title"><div><h2 id="visibility-title">Кому видно резюме</h2><p>Согласие можно отозвать в любой момент. После отзыва профиль сразу исчезнет из поиска HR.</p></div><div className="visibility-grid">{visibilityOptions.map((item) => <label className="visibility-control" key={item.scope}><span><strong>{item.title}</strong><small>{item.detail}</small></span><input type="checkbox" checked={portfolio.visibility[item.scope] === true} disabled={consent.isPending} onChange={(event) => { consent.mutate({ scope: item.scope, granted: event.target.checked }); }} /></label>)}</div></section>
    <section aria-labelledby="portfolio-projects"><div className="section-heading"><div><p className="eyebrow">Практика</p><h2 id="portfolio-projects">Проекты и оценка 5+</h2></div><Badge tone="success">Проверенные факты</Badge></div>{portfolio.contributions.length ? <div className="portfolio-grid">{portfolio.contributions.map((item) => <Card title={item.project_title} key={item.contribution_id}><div className="portfolio-card-head"><Badge tone="success">Вклад принят</Badge>{item.grade && <span className="grade-orb" aria-label={`Оценка ${item.grade}`}>{item.grade}</span>}</div><p>{item.personal_summary}</p>{item.review_reason && <blockquote><strong>Почему поставлена оценка</strong><p>{item.review_reason}</p></blockquote>}<p className="muted">Доказательства: {item.artifact_keys.join(", ") || "зафиксированы в проекте"}</p></Card>)}</div> : <StatePanel kind="empty" />}</section>
    <div className="portfolio-columns"><section><div className="section-heading"><h2>Корпоративные курсы</h2><Badge>{portfolio.courses.length}</Badge></div>{portfolio.courses.length ? portfolio.courses.map((course) => <article className="evidence-row" key={course.key}><span className="evidence-icon">✓</span><div><strong>{course.title}</strong><small>Завершение проверено платформой</small></div><Badge tone="success">Подтверждено</Badge></article>) : <StatePanel kind="empty" />}</section><section><div className="section-heading"><h2>Дипломы и сертификаты</h2><Badge>{portfolio.credentials.length}</Badge></div>{portfolio.credentials.length ? portfolio.credentials.map((item) => <article className="evidence-row" key={item.verification_id}><span className="evidence-icon">◇</span><div><strong>{item.title}</strong><small>ID: {item.verification_id}</small></div><Badge tone="success">{item.status}</Badge></article>) : <StatePanel kind="empty" />}</section></div>
    <section><div className="section-heading"><div><p className="eyebrow">Достижения</p><h2>Трофеи и офферы</h2></div></div><p className="muted">Победа и личный оффер показываются отдельно: трофей никогда не создаёт надпись об оффере автоматически.</p><div className="portfolio-grid">{portfolio.trophies.map((item) => <Card title={item.title} key={`${item.organizer}-${item.title}`}><Badge tone="success">{item.trophy_type}</Badge><p>{item.organizer}</p><a href={item.source_url} target="_blank" rel="noreferrer">Проверить источник</a></Card>)}{portfolio.offers.map((item) => <Card title={item.title} key={item.title}><Badge tone="success">Подтверждённый личный оффер</Badge><p>{item.basis}</p></Card>)}{portfolio.trophies.length === 0 && portfolio.offers.length === 0 && <StatePanel kind="empty" />}</div></section>
  </div>;
}
