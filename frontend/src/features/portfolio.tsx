import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { apiRequest } from "../api/client";
import { Badge, Card, StatePanel } from "../components/ui";

type Contribution = { contribution_id: string; project_title: string; personal_summary: string; artifact_keys: string[]; grade: string | null; review_reason: string | null; verification_status: string };
type Course = { key: string; title: string; status: string };
type Credential = { verification_id: string; title: string; status: string; credential_type?: "course" | "project_experience" | "season_award"; issuer?: string };
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
  return <div className="feature-stack portfolio-page portfolio-showcase">
    {query.isError && <div className="demo-fallback-note" role="status"><strong>Показана демонстрационная проекция</strong><span>API портфолио временно недоступен; экран остаётся доступным для презентации.</span><button className="secondary-button" type="button" onClick={() => { void query.refetch(); }}>Повторить загрузку</button></div>}
    {notice && <div className="success-banner" role="status"><span>✓</span><div><strong>{notice}</strong><small>Действие выполнено.</small></div></div>}

    <section className="portfolio-profile-card" aria-labelledby="workspace-title">
      <div className="portfolio-identity"><span className="portfolio-avatar">АР<i>✓</i></span><div><p className="eyebrow">Подтверждённый профиль участника</p><h1 id="workspace-title">{portfolio.display_name}</h1><p>Аналитик данных · Python-разработчик</p><div className="portfolio-location"><span>Москва</span><span>МГТУ им. Н. Э. Баумана</span><span>Открыт к стажировке</span></div></div></div>
      <div className="portfolio-profile-actions"><button type="button" onClick={() => { window.location.assign("/workspace/12"); }}>Редактировать профиль</button><button className="secondary-button" type="button" onClick={() => { void navigator.clipboard.writeText(window.location.href); announce("Ссылка на портфолио скопирована"); }}>Поделиться</button></div>
      <div className="portfolio-kpis"><div><span>Принятые вклады</span><strong>{portfolio.contributions.length}</strong><small>подтверждены заказчиком</small></div><div><span>Средняя оценка</span><strong>{averageGrade}</strong><small>по системе 5+</small></div><div><span>Сертификаты</span><strong>{portfolio.credentials.length}</strong><small>с проверяемым ID</small></div><div><span>Трофеи</span><strong>{portfolio.trophies.length}</strong><small>проверены платформой</small></div></div>
      <div className="portfolio-skills"><strong>Подтверждённые навыки</strong><div>{["Python", "FastAPI", "SQL", "ML evaluation", "OpenSpec / SDD", "Командная разработка"].map((skill) => <span key={skill}>{skill}<i>✓</i></span>)}</div></div>
    </section>

    {best && <section className="featured-contribution" aria-labelledby="featured-contribution-title">
      <div className="featured-copy"><div className="section-heading"><div><p className="eyebrow">Главный кейс</p><h2 id="featured-contribution-title">Мой лучший принятый вклад</h2><h3>{best.project_title}</h3></div><div className="featured-grade"><span>Оценка 5+</span><strong>{best.grade ?? "—"}</strong></div></div><p className="featured-lead">Реальный R&amp;D-проект с воспроизводимым результатом и подтверждённым личным вкладом.</p><dl><div><dt>Мой вклад</dt><dd>{best.personal_summary}</dd></div><div><dt>Результат для проекта</dt><dd>Качество рекомендаций выросло на 18%, API подготовлен для проверки на открытом датасете.</dd></div></dl>{best.review_reason && <blockquote><span className="mentor-avatar">ЕН</span><div><strong>Комментарий ментора</strong><p>«{best.review_reason}»</p><small>Елена Наставник · ML Lead</small></div></blockquote>}<div className="featured-actions"><button type="button" onClick={() => { setSelectedContribution(best); }}>Открыть кейс</button><button className="secondary-button" type="button" onClick={() => { announce("Доказательства доступны в карточке кейса"); }}>Посмотреть доказательства · {best.artifact_keys.length}</button></div></div>
      <div className="featured-visual" role="img" aria-label="Визуал результата рекомендательной системы"><div className="result-window"><header><i /><i /><i /><span>recommendation-evaluation.ipynb</span></header><div className="result-bars"><span style={{ height: "38%" }} /><span style={{ height: "52%" }} /><span style={{ height: "66%" }} /><span style={{ height: "81%" }} /><span style={{ height: "92%" }} /></div><div className="result-metric"><strong>+18%</strong><small>NDCG@10 к baseline</small></div></div><Badge tone="success">Вклад проверен</Badge></div>
    </section>}

    <section className="accepted-contributions" aria-labelledby="accepted-contributions-title"><div className="section-heading"><div><p className="eyebrow">Практический опыт</p><h2 id="accepted-contributions-title">Принятые вклады</h2></div><Badge tone="success">{portfolio.contributions.length} подтверждено</Badge></div><div className="contribution-table">{(otherContributions.length ? otherContributions : portfolio.contributions).map((item) => <button type="button" key={item.contribution_id} onClick={() => { setSelectedContribution(item); }}><span className="contribution-project-icon">▤</span><div><strong>{item.project_title}</strong><small>Аналитика · R&amp;D / MVP</small></div><Badge tone="success">Принято</Badge><span className="contribution-grade">{item.grade ?? "—"}</span><span>{item.artifact_keys.length} доказательства</span><i>›</i></button>)}</div></section>

    <div className="portfolio-evidence-layout"><section className="learning-evidence"><div className="section-heading"><div><p className="eyebrow">Обучение</p><h2>Курсы и сертификаты</h2></div><Badge>{portfolio.credentials.length}</Badge></div>{portfolio.credentials.map((item) => <button type="button" className="portfolio-document" key={item.verification_id} onClick={() => { announce(`Открыт документ ${item.verification_id}`); }}><span className="document-mark">◇</span><div><small>{item.credential_type === "course" ? "Сертификат курса" : item.credential_type === "project_experience" ? "Проектный сертификат" : "Диплом сезона"}</small><strong>{item.title}</strong><span>{item.issuer}</span></div><Badge tone="success">Проверяемый</Badge><i>›</i></button>)}{portfolio.credentials.length === 0 && portfolio.courses.map((course) => <article className="evidence-row" key={course.key}><span className="evidence-icon">✓</span><div><strong>{course.title}</strong><small>Завершение проверено платформой</small></div><Badge tone="success">Подтверждено</Badge></article>)}</section>
      <section className="recognition-evidence"><div className="section-heading"><div><p className="eyebrow">Recognition</p><h2>Трофеи и достижения</h2></div><Badge>{portfolio.trophies.length + portfolio.offers.length}</Badge></div>{portfolio.trophies.map((item) => <a className="portfolio-trophy" href={item.source_url} target="_blank" rel="noreferrer" key={`${item.organizer}-${item.title}`}><span>★</span><div><small>{item.trophy_type} · {item.organizer}</small><strong>{item.title}</strong><em>Открыть подтверждение</em></div><i>›</i></a>)}{portfolio.offers.map((item) => <article className="portfolio-trophy portfolio-offer" key={item.title}><span>✦</span><div><small>Подтверждённый личный оффер</small><strong>{item.title}</strong><em>{item.basis}</em></div></article>)}{portfolio.trophies.length === 0 && portfolio.offers.length === 0 && <StatePanel kind="empty" />}</section></div>

    <section className="portfolio-hr-panel" aria-labelledby="visibility-title"><div className="hr-status-card"><div><span className={`hr-status-dot${portfolio.visibility.hr_profile ? " active" : ""}`} /><div><p className="eyebrow">Карьерная видимость</p><h2 id="visibility-title">Профиль {portfolio.visibility.hr_profile ? "открыт" : "закрыт"} для HR</h2></div></div><p>Рекрутеры видят только разрешённые подтверждённые данные. Настройки можно изменить в любой момент.</p><div className="hr-activity"><div><strong>24</strong><span>просмотра</span><small>за 30 дней</small></div><div><strong>3</strong><span>запроса контакта</span><small>требуют решения</small></div><div><strong>1</strong><span>приглашение</span><small>на стажировку</small></div></div></div><div className="visibility-grid">{visibilityOptions.map((item) => <label className="visibility-control" key={item.scope}><span><strong>{item.title}</strong><small>{item.detail}</small></span><input type="checkbox" checked={portfolio.visibility[item.scope] === true} disabled={consent.isPending} onChange={(event) => { consent.mutate({ scope: item.scope, granted: event.target.checked }); }} /></label>)}</div></section>

    {selectedContribution && <div className="overlay" role="presentation"><section className="overlay-panel overlay-panel--dialog portfolio-case-dialog" role="dialog" aria-modal="true" aria-label="Карточка принятого вклада"><header><div><p className="eyebrow">Подтверждённый кейс</p><h2>{selectedContribution.project_title}</h2></div><button type="button" aria-label="Закрыть" onClick={() => { setSelectedContribution(null); }}>×</button></header><Badge tone="success">Вклад принят · оценка {selectedContribution.grade ?? "—"}</Badge><h3>Личный вклад</h3><p>{selectedContribution.personal_summary}</p><h3>Почему поставлена оценка</h3><p>{selectedContribution.review_reason ?? "Результат и личный вклад подтверждены заказчиком."}</p><h3>Доказательства</h3><div className="case-artifacts">{selectedContribution.artifact_keys.map((key) => <button type="button" key={key} onClick={() => { announce(`Открыт артефакт ${key}`); }}>{key} ↗</button>)}</div></section></div>}
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
  const [selected, setSelected] = useState<(typeof ratingRows)[number] | null>(null);
  if (selected) return <div className="feature-stack public-profile-page"><button className="text-button" type="button" onClick={() => { setSelected(null); }}>← Вернуться в рейтинг</button><header className="portfolio-hero"><div><p className="eyebrow">Публичный профиль · подтверждённые факты</p><h1 id="workspace-title">{selected.name}</h1><p className="lead">{selected.projects} успешно выполненных проектов · {selected.points} баллов · место {selected.place} в сезоне.</p></div><div className="portfolio-score"><span>Оценка готовности</span><strong>{selected.place < 3 ? "92%" : "86%"}</strong><small>по проверяемому опыту</small></div></header><section className="rating-summary"><Card title="Рекомендательная система"><Badge tone="success">Оценка A</Badge><p>Гибридное ранжирование, benchmark и воспроизводимый API. Оценка поставлена за качество выше критериев и подтверждённый личный вклад.</p></Card><Card title="Прогнозирование нагрузки"><Badge tone="success">Оценка B</Badge><p>Baseline-модель, анализ ограничений и документация внедрения.</p></Card><Card title="События и трофеи">{selected.trophies.length ? selected.trophies.map((trophy) => <p key={trophy}><Badge tone="warning">{trophy}</Badge></p>) : <p>Участие в AI Journey 2026 · 5 замороженных баллов</p>}</Card></section><Card title="Навыки и подтверждения"><p>Python · FastAPI · ML evaluation · OpenSpec/SDD · командная разработка</p><p className="muted">В профиле показаны только факты, разрешённые владельцем. Закрытые проекты и личные переписки недоступны.</p></Card></div>;
  return <div className="feature-stack rating-page">
    <header className="dashboard-heading"><div><p className="eyebrow">Сезон 2026 · Python-разработка</p><h1 id="workspace-title">Рейтинг подтверждённого опыта</h1><p className="lead">Позиция складывается из принятых вкладов, оценки 5+ и проверенных достижений. Место усиливает резюме, но не означает автоматический оффер.</p></div><div className="rating-position"><span>Ваше место</span><strong>3</strong><small>450 баллов · 6 проектов</small></div></header>
    <section className="rating-summary"><Card title="До следующей позиции"><strong className="rating-big">50 баллов</strong><p>Завершите текущий MVP или подтвердите участие в событии Сбера.</p></Card><Card title="Подтверждение сезона"><Badge tone="success">Диплом уровня Gold</Badge><p>Будет сформирован после закрытия сезона с проверяемым ID и историей расчёта.</p></Card><Card title="Когорта"><strong className="rating-big">124 участника</strong><p>Python · активная когорта · сентябрь–декабрь 2026</p></Card></section>
    <section className="rating-board" aria-labelledby="rating-board-title"><div className="section-heading"><div><p className="eyebrow">Лидеры сезона</p><h2 id="rating-board-title">Участники и достижения</h2></div><Badge>Обновлено сегодня</Badge></div>
      <div className="rating-table">{ratingRows.map((row) => <article className={row.name === "Алекс Речной" ? "rating-row rating-row--current" : "rating-row"} key={row.place}><strong className="rating-place">{row.place}</strong><div><div className="rating-trophies">{row.trophies.map((trophy) => <button type="button" title="Открыть подтверждение достижения" key={trophy}>{trophy}</button>)}</div><button className="rating-name" type="button" onClick={() => { setSelected(row); }}>{row.name}</button><small>{row.projects} успешно выполненных проектов</small></div><strong>{row.points} баллов</strong><button className="secondary-button" type="button" onClick={() => { setSelected(row); }}>Профиль</button></article>)}</div>
    </section>
    <Card title="Как считается рейтинг"><p>Баллы начисляются только по опубликованной политике сезона: за принятый личный вклад, подтверждённую оценку 5+ и проверенные события. Ошибку можно оспорить до закрытия сезона; исправления сохраняются в истории.</p></Card>
  </div>;
}
