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
  credentials: [{ verification_id: "IMP-2026-GOLD-0042", title: "Диплом Impulse · Gold", status: "Проверяемый" }],
  trophies: [{ title: "Победитель МАЯКИ", organizer: "Сбер", source_url: "https://developers.sber.ru/", trophy_type: "Победа" }],
  offers: [{ title: "Приглашение на стажировку", basis: "Решение HR после просмотра подтверждённого портфолио и интервью." }],
};

export function ParticipantPortfolio() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["portfolio"], queryFn: () => apiRequest<Portfolio>("/api/v1/me/portfolio"), refetchOnMount: "always" });
  const consent = useMutation({
    mutationFn: ({ scope, granted }: { scope: VisibilityScope; granted: boolean }) => apiRequest(`/api/v1/me/consents/${scope}`, { method: "PUT", headers: csrfHeaders(), body: JSON.stringify({ granted }) }),
    onSuccess: async () => client.invalidateQueries({ queryKey: ["portfolio"] }),
  });
  if (query.isLoading) return <StatePanel kind="loading" />;
  const portfolio = query.data ?? demoPortfolio;
  return <div className="feature-stack portfolio-page">
    {query.isError && <div className="demo-fallback-note" role="status"><strong>Показана демонстрационная проекция</strong><span>API портфолио временно недоступен; экран остаётся доступным для презентации.</span><button className="secondary-button" type="button" onClick={() => { void query.refetch(); }}>Повторить загрузку</button></div>}
    <header className="portfolio-hero"><div><p className="eyebrow">Evidence-first резюме</p><h1 id="workspace-title">Подтверждённый опыт</h1><p className="lead">Каждый факт связан с конкретным проектом, личным вкладом и решением человека. Вы сами определяете, кто увидит профиль.</p></div><div className="portfolio-score"><span>Успешных проектов</span><strong>{portfolio.contributions.length}</strong><small>Демо-данные</small></div></header>
    <section className="visibility-panel" aria-labelledby="visibility-title"><div><h2 id="visibility-title">Кому видно резюме</h2><p>Согласие можно отозвать в любой момент. После отзыва профиль сразу исчезнет из поиска HR.</p></div><div className="visibility-grid">{visibilityOptions.map((item) => <label className="visibility-control" key={item.scope}><span><strong>{item.title}</strong><small>{item.detail}</small></span><input type="checkbox" checked={portfolio.visibility[item.scope] === true} disabled={consent.isPending} onChange={(event) => { consent.mutate({ scope: item.scope, granted: event.target.checked }); }} /></label>)}</div></section>
    <section aria-labelledby="portfolio-projects"><div className="section-heading"><div><p className="eyebrow">Практика</p><h2 id="portfolio-projects">Проекты и оценка 5+</h2></div><Badge tone="success">Проверенные факты</Badge></div>{portfolio.contributions.length ? <div className="portfolio-grid">{portfolio.contributions.map((item) => <Card title={item.project_title} key={item.contribution_id}><div className="portfolio-card-head"><Badge tone="success">Вклад принят</Badge>{item.grade && <span className="grade-orb" aria-label={`Оценка ${item.grade}`}>{item.grade}</span>}</div><p>{item.personal_summary}</p>{item.review_reason && <blockquote><strong>Почему поставлена оценка</strong><p>{item.review_reason}</p></blockquote>}<p className="muted">Доказательства: {item.artifact_keys.join(", ") || "зафиксированы в проекте"}</p></Card>)}</div> : <StatePanel kind="empty" />}</section>
    <div className="portfolio-columns"><section><div className="section-heading"><h2>Корпоративные курсы</h2><Badge>{portfolio.courses.length}</Badge></div>{portfolio.courses.length ? portfolio.courses.map((course) => <article className="evidence-row" key={course.key}><span className="evidence-icon">✓</span><div><strong>{course.title}</strong><small>Завершение проверено платформой</small></div><Badge tone="success">Подтверждено</Badge></article>) : <StatePanel kind="empty" />}</section><section><div className="section-heading"><h2>Дипломы и сертификаты</h2><Badge>{portfolio.credentials.length}</Badge></div>{portfolio.credentials.length ? portfolio.credentials.map((item) => <article className="evidence-row" key={item.verification_id}><span className="evidence-icon">◇</span><div><strong>{item.title}</strong><small>ID: {item.verification_id}</small></div><Badge tone="success">{item.status}</Badge></article>) : <StatePanel kind="empty" />}</section></div>
    <section><div className="section-heading"><div><p className="eyebrow">Достижения</p><h2>Трофеи и офферы</h2></div></div><p className="muted">Победа и личный оффер показываются отдельно: трофей никогда не создаёт надпись об оффере автоматически.</p><div className="portfolio-grid">{portfolio.trophies.map((item) => <Card title={item.title} key={`${item.organizer}-${item.title}`}><Badge tone="success">{item.trophy_type}</Badge><p>{item.organizer}</p><a href={item.source_url} target="_blank" rel="noreferrer">Проверить источник</a></Card>)}{portfolio.offers.map((item) => <Card title={item.title} key={item.title}><Badge tone="success">Подтверждённый личный оффер</Badge><p>{item.basis}</p></Card>)}{portfolio.trophies.length === 0 && portfolio.offers.length === 0 && <StatePanel kind="empty" />}</div></section>
  </div>;
}

const ratingRows = [
  { place: 1, name: "Кирилл Меньшев", projects: 8, points: 550, trophies: ["Победитель МАЯКИ", "Получил оффер"] },
  { place: 2, name: "Мария Северова", projects: 7, points: 500, trophies: ["Призёр AI Journey"] },
  { place: 3, name: "Алекс Речной", projects: 6, points: 450, trophies: ["Вы в рейтинге"] },
  { place: 4, name: "Игорь Лесной", projects: 6, points: 400, trophies: [] },
  { place: 5, name: "Анна Смирнова", projects: 5, points: 350, trophies: ["Финалист хакатона"] },
];

export function ParticipantRating() {
  return <div className="feature-stack rating-page">
    <header className="dashboard-heading"><div><p className="eyebrow">Сезон 2026 · Python-разработка</p><h1 id="workspace-title">Рейтинг подтверждённого опыта</h1><p className="lead">Позиция складывается из принятых вкладов, оценки 5+ и проверенных достижений. Место усиливает резюме, но не означает автоматический оффер.</p></div><div className="rating-position"><span>Ваше место</span><strong>3</strong><small>450 баллов · 6 проектов</small></div></header>
    <section className="rating-summary"><Card title="До следующей позиции"><strong className="rating-big">50 баллов</strong><p>Завершите текущий MVP или подтвердите участие в событии Сбера.</p></Card><Card title="Подтверждение сезона"><Badge tone="success">Диплом уровня Gold</Badge><p>Будет сформирован после закрытия сезона с проверяемым ID и историей расчёта.</p></Card><Card title="Когорта"><strong className="rating-big">124 участника</strong><p>Python · активная когорта · сентябрь–декабрь 2026</p></Card></section>
    <section className="rating-board" aria-labelledby="rating-board-title"><div className="section-heading"><div><p className="eyebrow">Лидеры сезона</p><h2 id="rating-board-title">Участники и достижения</h2></div><Badge>Обновлено сегодня</Badge></div>
      <div className="rating-table">{ratingRows.map((row) => <article className={row.name === "Алекс Речной" ? "rating-row rating-row--current" : "rating-row"} key={row.place}><strong className="rating-place">{row.place}</strong><div><div className="rating-trophies">{row.trophies.map((trophy) => <button type="button" title="Открыть подтверждение достижения" key={trophy}>{trophy}</button>)}</div><h3>{row.name}</h3><small>{row.projects} успешно выполненных проектов</small></div><strong>{row.points} баллов</strong><button className="secondary-button" type="button">Профиль</button></article>)}</div>
    </section>
    <Card title="Как считается рейтинг"><p>Баллы начисляются только по опубликованной политике сезона: за принятый личный вклад, подтверждённую оценку 5+ и проверенные события. Ошибку можно оспорить до закрытия сезона; исправления сохраняются в истории.</p></Card>
  </div>;
}
