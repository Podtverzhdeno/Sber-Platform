import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { apiRequest } from "../api/client";
import { Badge, Card, Modal, SafeExternalLink, StatePanel } from "../components/ui";

type Track = { key: string; title: string; status: "active" | "frozen" | null; completed_milestones: string[] };
type TrackOverview = { active_count: number; max_active: number; tracks: Track[] };
type Milestone = { key: string; position: number; title: string; purpose: string; skill: string; target_kind: string; target_key: string; completed: boolean };
type Roadmap = { track_key: string; policy_version: number; replacement_reason: string | null; milestones: Milestone[]; next_step: Milestone | null };
type Course = { key: string; title: string; track_keys: string[]; recommendation_reason: string; source_url: string; availability: string; access_note: string; completion_status: string | null; rating_eligible: boolean };
type Streak = { current_days: number; qualified_dates: string[]; reason: string };
type CertificateCompetency = { competency: string; level: string; evidence: string };
type CourseCertificate = {
  certificate_id: string;
  verification_id: string;
  holder_name: string;
  course_title: string;
  specialization: string;
  program_version: string;
  period: string;
  workload_hours: number;
  result: string;
  competencies: CertificateCompetency[];
  issued_at: string;
  preview_marking: string;
};

const externalRoadmaps: Record<string, { title: string; href: string }> = {
  python: { title: "Roadmap Python-разработчика", href: "https://roadmap.sh/python" },
  data: { title: "Roadmap аналитика данных", href: "https://roadmap.sh/data-analyst" },
  product: { title: "Roadmap продакт-менеджера", href: "https://roadmap.sh/product-manager" },
  ml: { title: "Roadmap ML / AI-инженера", href: "https://roadmap.sh/ai-data-scientist" },
};

function csrfHeaders(): HeadersInit {
  return { "X-CSRF-Token": sessionStorage.getItem("impulse_csrf") ?? "" };
}

export function DevelopmentJourney() {
  const client = useQueryClient();
  const navigate = useNavigate();
  const tracks = useQuery({ queryKey: ["tracks"], queryFn: () => apiRequest<TrackOverview>("/api/v1/development/tracks") });
  const roadmaps = useQuery({ queryKey: ["roadmaps"], queryFn: () => apiRequest<Roadmap[]>("/api/v1/me/roadmaps") });
  const [pendingTrack, setPendingTrack] = useState<Track | null>(null);
  const [consultationVisible, setConsultationVisible] = useState(false);
  const [consultationSent, setConsultationSent] = useState(false);
  const selectTrack = useMutation({
    mutationFn: ({ trackKey, freezeTrackKey }: { trackKey: string; freezeTrackKey?: string }) => apiRequest<TrackOverview>("/api/v1/me/tracks", { method: "POST", headers: csrfHeaders(), body: JSON.stringify({ track_key: trackKey, freeze_track_key: freezeTrackKey }) }),
    onSuccess: async () => {
      setPendingTrack(null);
      await Promise.all([client.invalidateQueries({ queryKey: ["tracks"] }), client.invalidateQueries({ queryKey: ["roadmaps"] })]);
    },
  });

  if (tracks.isLoading || roadmaps.isLoading) return <StatePanel kind="loading" />;
  if (tracks.isError || roadmaps.isError || !tracks.data || !roadmaps.data) return <StatePanel kind="error" action="Повторить" onAction={() => { void tracks.refetch(); void roadmaps.refetch(); }} />;
  const overview = tracks.data;
  const roadmapItems = roadmaps.data;

  function choose(track: Track) {
    if (track.status === "active") return;
    if (overview.active_count >= overview.max_active) setPendingTrack(track);
    else selectTrack.mutate({ trackKey: track.key });
  }

  const activeTracks = overview.tracks.filter((track) => track.status === "active");
  return (
    <div className="feature-stack" data-reference="R-PAR-02">
      <section><p className="eyebrow">Профессиональные направления</p><h1 id="workspace-title">Найдите своё через практику</h1><p className="lead">Можно развивать два направления одновременно. Смена интереса — полезный результат: прогресс сохраняется, штрафов и негативных меток нет.</p></section>
      <div className="track-grid">
        {overview.tracks.map((track) => <button className={`track-card track-card--${track.status ?? "new"}`} key={track.key} onClick={() => { choose(track); }}><span>{track.title}</span><Badge tone={track.status === "active" ? "success" : "neutral"}>{track.status === "active" ? "Активно" : track.status === "frozen" ? "Заморожено · прогресс сохранён" : "Попробовать"}</Badge></button>)}
      </div>
      <button className="text-button" type="button" onClick={() => { setConsultationVisible(true); }}>Получить рекомендацию ментора</button>
      {consultationVisible && <Card title="Рекомендация ментора">{consultationSent ? <><Badge tone="success">Запрос отправлен</Badge><p>Елена получила контекст ваших направлений и текущего проекта. Ответ появится в сообщениях; продолжать маршрут можно сразу.</p></> : <p>Ментор увидит выбранные направления, прогресс курсов и текущий проект и сможет предложить следующий практический шаг.</p>}<div className="course-actions">{!consultationSent && <button type="button" onClick={() => { setConsultationSent(true); }}>Отправить запрос</button>}<button className="secondary-button" type="button" onClick={() => { setConsultationVisible(false); }}>Продолжить самостоятельно</button></div></Card>}
      <section aria-labelledby="roadmap-title"><p className="eyebrow">Ваш roadmap</p><h2 id="roadmap-title">Следующие осмысленные шаги</h2><div className="roadmap-grid">
        {roadmapItems.map((roadmap) => { const external = externalRoadmaps[roadmap.track_key.toLowerCase()]; return <Card title={`${roadmap.track_key} · версия ${String(roadmap.policy_version)}`} key={roadmap.track_key}>{roadmap.replacement_reason && <p className="notice">{roadmap.replacement_reason}</p>}<ol className="roadmap-list">{roadmap.milestones.map((step) => <li className={step.completed ? "completed" : ""} key={step.key}><button type="button" onClick={() => { if (step.target_kind === "course") void navigate(`/workspace/2?course=${encodeURIComponent(step.target_key)}`); }}><strong>{step.title}</strong><span>{step.purpose}</span><small>Навык: {step.skill} · {step.completed ? "выполнено" : "+20 баллов за важный checkpoint"}</small></button></li>)}</ol><div className="roadmap-actions"><button className="roadmap-start-button" type="button" onClick={() => { const courseKey = roadmap.next_step?.target_kind === "course" ? roadmap.next_step.target_key : `${roadmap.track_key}-base`; void navigate(`/workspace/2?course=${encodeURIComponent(courseKey)}`); }}>Начать Bootcamp</button>{external && <SafeExternalLink className="roadmap-external-link" href={external.href}>{external.title} ↗</SafeExternalLink>}</div></Card>; })}
      </div></section>
      <Modal title={`Освободить место для «${pendingTrack?.title ?? "направления"}»`} open={pendingTrack !== null} onClose={() => { setPendingTrack(null); }}><p>Выберите направление для заморозки. Весь подтверждённый прогресс останется в истории.</p><div className="modal-actions">{activeTracks.map((track) => <button type="button" key={track.key} onClick={() => { if (pendingTrack) selectTrack.mutate({ trackKey: pendingTrack.key, freezeTrackKey: track.key }); }}>Заморозить «{track.title}»</button>)}</div></Modal>
    </div>
  );
}

export function Bootcamp({ honorBoardEnabled, honorBoardConsent }: { honorBoardEnabled: boolean; honorBoardConsent: boolean }) {
  const client = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [trackFilter, setTrackFilter] = useState("all");
  const courses = useQuery({ queryKey: ["courses"], queryFn: () => apiRequest<Course[]>("/api/v1/development/courses") });
  const streak = useQuery({ queryKey: ["streak"], queryFn: () => apiRequest<Streak>("/api/v1/me/learning/streak") });
  const certificates = useQuery({ queryKey: ["certificates"], queryFn: () => apiRequest<CourseCertificate[]>("/api/v1/me/bootcamp/certificates") });
  const completion = useMutation({ mutationFn: (courseKey: string) => apiRequest(`/api/v1/me/courses/${encodeURIComponent(courseKey)}/completion`, { method: "POST", headers: csrfHeaders() }), onSuccess: async () => { await client.invalidateQueries({ queryKey: ["courses"] }); } });
  const issueCertificate = useMutation({ mutationFn: (courseKey: string) => apiRequest<CourseCertificate>(`/api/v1/me/bootcamp/certificates/${encodeURIComponent(courseKey)}`, { method: "POST", headers: csrfHeaders() }), onSuccess: async () => { await client.invalidateQueries({ queryKey: ["certificates"] }); } });
  const learning = useMutation({ mutationFn: (courseKey: string) => apiRequest<Streak>(`/api/v1/me/courses/${encodeURIComponent(courseKey)}/learning-days`, { method: "POST", headers: csrfHeaders(), body: JSON.stringify({ occurred_at: new Date().toISOString() }) }), onSuccess: async () => { await client.invalidateQueries({ queryKey: ["streak"] }); } });
  if (courses.isLoading || streak.isLoading) return <StatePanel kind="loading" />;
  if (!courses.data || !streak.data || courses.isError || streak.isError) return <StatePanel kind="error" action="Обновить" onAction={() => { void courses.refetch(); void streak.refetch(); }} />;
  const trackOptions = [...new Set(courses.data.flatMap((course) => course.track_keys))];
  const visible = courses.data.filter((course) => trackFilter === "all" || course.track_keys.includes(trackFilter));
  const selectedCourse = courses.data.find((course) => course.key === searchParams.get("course"));
  if (selectedCourse) {
    const checkpoints = [
      { title: "Зачем нужен навык", detail: selectedCourse.recommendation_reason, time: "10 минут", status: "completed" },
      { title: "Базовые понятия и инструменты", detail: "Изучите основу и соберите короткий конспект для будущего проекта.", time: "45 минут", status: "completed" },
      { title: "Практика в рабочем окружении", detail: "Повторите сценарий на учебном репозитории и сохраните артефакт.", time: "1,5 часа", status: "active" },
      { title: "Проверочный мини-проект", detail: "Примените навык к задаче, близкой к реальному R&D-брифу.", time: "3 часа", status: "locked" },
      { title: "Подтверждение результата", detail: "Отправьте артефакт на проверку и получите запись в портфолио.", time: "до 2 дней", status: "locked" },
    ];
    const issued = certificates.data?.find((item) => item.course_title === selectedCourse.title);
    return <div className="feature-stack course-roadmap-page" data-reference="R-PAR-03">
      <button className="text-button" type="button" onClick={() => { setSearchParams({}); }}>← Вернуться в Bootcamp</button>
      <header className="course-roadmap-hero"><div><p className="eyebrow">Траектория курса · {selectedCourse.track_keys.join(" · ")}</p><h1 id="workspace-title">{selectedCourse.title}</h1><p className="lead">{selectedCourse.recommendation_reason}</p></div><div className="course-progress"><strong>40%</strong><span>2 из 5 checkpoint</span><i><b style={{ width: "40%" }} /></i></div></header>
      <section className="course-outcome"><div><span>Цель курса</span><strong>Подготовиться к реальной проектной задаче</strong></div><div><span>Результат</span><strong>Проверяемый артефакт в портфолио</strong></div><div><span>Следующий шаг</span><strong>Практика в рабочем окружении</strong></div></section>
      <section className="course-competencies"><div className="section-heading"><div><p className="eyebrow">Матрица курса · версия 2</p><h2>Какие компетенции подтверждает курс</h2></div><Badge tone="warning">2 из 5 подтверждены</Badge></div><div>{[["Проектирование API", "Уверенный", "Checkpoint 2 · подтверждено"], ["Работа с внешними источниками", "Базовый", "Checkpoint 3 · в работе"], ["Автоматическое тестирование", "Базовый", "Checkpoint 4 · заблокирован"], ["OpenSpec / SDD", "Уверенный", "Checkpoint 2 · подтверждено"]].map(([skill, level, evidence]) => <article key={skill}><strong>{skill}</strong><span>{level}</span><small>{evidence}</small></article>)}</div></section>
      <ol className="checkpoint-list">{checkpoints.map((checkpoint, index) => <li className={`checkpoint checkpoint--${checkpoint.status}`} key={checkpoint.title}><span className="checkpoint-marker">{checkpoint.status === "completed" ? "✓" : index + 1}</span><div><div className="checkpoint-heading"><p className="eyebrow">Checkpoint {index + 1}</p><Badge tone={checkpoint.status === "completed" ? "success" : checkpoint.status === "active" ? "warning" : "neutral"}>{checkpoint.status === "completed" ? "Завершён" : checkpoint.status === "active" ? "Текущий шаг" : "Откроется позже"}</Badge></div><h2>{checkpoint.title}</h2><p>{checkpoint.detail}</p><small>Оценочное время: {checkpoint.time}</small>{checkpoint.status !== "locked" && <div className="course-actions">{index === 2 ? <SafeExternalLink href={selectedCourse.source_url}>Открыть учебный материал</SafeExternalLink> : <button className="secondary-button" type="button" onClick={() => { learning.mutate(selectedCourse.key); }}>Открыть материал</button>}</div>}</div></li>)}</ol>
      <section className="certificate-preview"><div className="certificate-seal">✓</div><div><p className="eyebrow">После подтверждения всех checkpoints</p><h2>Сертификат завершения курса</h2>{issued ? <p>{issued.holder_name} · {issued.period} · {issued.workload_hours} ч · версия {issued.program_version} · competencies: {issued.competencies.map((entry) => entry.competency).join(", ")}</p> : <p>{selectedCourse.title} · матрица компетенций · verification ID · версия программы</p>}<small>{issued ? `Документ ${issued.verification_id} · публичная проверка доступна по согласию на публичный профиль.` : "Выдаётся после подтверждённого завершения курса."}</small></div>{issued ? <a className="secondary-button" href={`/verify/${encodeURIComponent(issued.verification_id)}`}>Публичная страница</a> : selectedCourse.completion_status === "verified" && !certificates.isLoading ? <button type="button" onClick={() => { issueCertificate.mutate(selectedCourse.key); }}>{issueCertificate.isPending ? "Выдаём…" : "Получить сертификат"}</button> : <button type="button" disabled>{selectedCourse.completion_status === "reported" ? "Завершение на проверке" : "Доступен после подтверждения"}</button>}</section>
    </div>;
  }
  return (
    <div className="feature-stack" data-reference="R-PAR-03"><section><p className="eyebrow">Bootcamp</p><h1 id="workspace-title">Учитесь ради следующего результата</h1><p className="lead">Каждый курс связан с выбранным направлением и объясняет, где навык пригодится в реальной задаче.</p></section>
      <Card title={`Серия: ${String(streak.data.current_days)} дн.`}><p>{streak.data.reason}</p><small>Один локальный день учитывается один раз — количество кликов не увеличивает серию.</small></Card>
      <label className="catalog-filter">Направление<select value={trackFilter} onChange={(event) => { setTrackFilter(event.target.value); }}><option value="all">Все мои направления</option>{trackOptions.map((track) => <option key={track} value={track}>{track}</option>)}</select></label>
      <div className="course-grid">{visible.map((course) => <Card title={course.title} key={course.key}><p>{course.recommendation_reason}</p><p className="muted">{course.access_note}</p><div className="course-meta"><Badge tone={course.availability === "available" ? "success" : "warning"}>{course.availability === "available" ? "Доступен" : "Внешний доступ ограничен"}</Badge>{course.completion_status && <Badge>{course.completion_status === "verified" ? "Подтверждено" : "Ожидает проверки"}</Badge>}</div><div className="course-actions"><button type="button" onClick={() => { setSearchParams({ course: course.key }); }}>Открыть траекторию</button><SafeExternalLink href={course.source_url}>Первоисточник курса</SafeExternalLink></div><div className="course-actions"><button type="button" className="secondary-button" onClick={() => { completion.mutate(course.key); }}>Отметить завершение</button><button type="button" className="secondary-button" onClick={() => { learning.mutate(course.key); }}>Учебный шаг выполнен</button></div>{course.completion_status === "reported" && <p className="notice">Результат отправлен на проверку. После подтверждения курс появится в портфолио.</p>}</Card>)}</div>
      {honorBoardEnabled && honorBoardConsent && <Card title="Зал славы курсов"><p>Здесь показываются только участники, отдельно согласившиеся на публичное отображение подтверждённого завершения.</p></Card>}
    </div>
  );
}

export type ProjectDocument = {
  verification_id: string;
  holder_name: string;
  customer_name: string;
  task_title: string;
  project_key: string;
  period: string;
  personal_summary: string;
  artifact_keys: string[];
  grade_label: string;
  review_explanation: string;
  competencies: { competency: string; level: string; evidence_refs: string[]; finding: string }[];
  payment_status: string;
  status: string;
  superseded_by: string | null;
};

export function ProjectVerificationPage() {
  const { verificationId } = useParams();
  const document = useQuery({
    queryKey: ["project-credential-verify", verificationId],
    queryFn: () => apiRequest<ProjectDocument>(`/api/v1/project-credentials/${encodeURIComponent(verificationId ?? "")}`),
    retry: false,
  });
  if (document.isLoading) return <div className="verify-shell"><StatePanel kind="loading" /></div>;
  if (document.isError || !document.data) {
    return <div className="verify-shell"><StatePanel kind="restricted" action="На главную" onAction={() => { window.location.assign("/"); }} /><p className="muted">Проектный документ не найден или владелец закрыл публичную проверку.</p></div>;
  }
  const doc = document.data;
  return <div className="verify-shell">
    <article className="certificate-document" aria-labelledby="project-verify-title">
      <div className="certificate-seal">✓</div>
      <p className="eyebrow">Проверка проектного документа</p>
      <h1 id="project-verify-title">{doc.task_title}</h1>
      <p className="lead">{doc.personal_summary}</p>
      <dl className="verify-facts">
        <div><dt>Исполнитель</dt><dd>{doc.holder_name}</dd></div>
        <div><dt>Подписал заказчик</dt><dd>{doc.customer_name}</dd></div>
        <div><dt>Проект</dt><dd>{doc.project_key}</dd></div>
        <div><dt>Период</dt><dd>{doc.period}</dd></div>
        <div><dt>Оценка</dt><dd>{doc.grade_label}</dd></div>
        <div><dt>Оплата</dt><dd>{doc.payment_status}</dd></div>
        <div><dt>ID проверки</dt><dd>{doc.verification_id}</dd></div>
      </dl>
      <section className="verify-competencies"><h2>Матрица компетенций</h2><ul>{doc.competencies.map((entry) => <li key={entry.competency}><strong>{entry.competency}</strong><span>{entry.level}</span><small>Основание: {entry.evidence_refs.join(", ")}</small><p>{entry.finding}</p></li>)}</ul></section>
      <p className="muted">Обоснование оценки: {doc.review_explanation}</p>
      <section className="verify-artifacts"><h2>Доказательства</h2><ul>{doc.artifact_keys.map((key) => <li key={key}>{key}</li>)}</ul></section>
      {doc.superseded_by && <Badge tone="warning">Документ обновлён · {doc.superseded_by}</Badge>}
      <Badge tone="warning">Демонстрационное подтверждение · не является официальным сертификатом</Badge>
    </article>
  </div>;
}

export function PublicVerificationPage() {
  const { verificationId } = useParams();
  const document = useQuery({
    queryKey: ["certificate-verify", verificationId],
    queryFn: () => apiRequest<CourseCertificate>(`/api/v1/bootcamp/certificates/${encodeURIComponent(verificationId ?? "")}`),
    retry: false,
  });
  if (document.isLoading) return <div className="verify-shell"><StatePanel kind="loading" /></div>;
  if (document.isError || !document.data) {
    return <div className="verify-shell"><StatePanel kind="restricted" action="На главную" onAction={() => { window.location.assign("/"); }} /><p className="muted">Документ не найден или владелец закрыл публичную проверку.</p></div>;
  }
  const doc = document.data;
  return <div className="verify-shell">
    <article className="certificate-document" aria-labelledby="verify-title">
      <div className="certificate-seal">✓</div>
      <p className="eyebrow">Проверка документа</p>
      <h1 id="verify-title">{doc.course_title}</h1>
      <p className="lead">{doc.result}</p>
      <dl className="verify-facts">
        <div><dt>Кому</dt><dd>{doc.holder_name}</dd></div>
        <div><dt>Период</dt><dd>{doc.period}</dd></div>
        <div><dt>Объём</dt><dd>{String(doc.workload_hours)} ч</dd></div>
        <div><dt>Специализация</dt><dd>{doc.specialization}</dd></div>
        <div><dt>Версия программы</dt><dd>{doc.program_version}</dd></div>
        <div><dt>ID проверки</dt><dd>{doc.verification_id}</dd></div>
      </dl>
      <section className="verify-competencies"><h2>Подтверждённые компетенции</h2><ul>{doc.competencies.map((entry) => <li key={entry.competency}><strong>{entry.competency}</strong><span>{entry.level}</span><small>Основание: {entry.evidence}</small></li>)}</ul></section>
      <Badge tone="warning">{doc.preview_marking} · не является официальным сертификатом</Badge>
    </article>
  </div>;
}
