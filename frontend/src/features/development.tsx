import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { apiRequest } from "../api/client";
import { Badge, Card, Modal, SafeExternalLink, StatePanel } from "../components/ui";

type Track = { key: string; title: string; status: "active" | "frozen" | null; completed_milestones: string[] };
type TrackOverview = { active_count: number; max_active: number; tracks: Track[] };
type Milestone = { key: string; position: number; title: string; purpose: string; skill: string; target_kind: string; target_key: string; completed: boolean };
type Roadmap = { track_key: string; policy_version: number; replacement_reason: string | null; milestones: Milestone[]; next_step: Milestone | null };
type Course = { key: string; title: string; track_keys: string[]; recommendation_reason: string; source_url: string; availability: string; access_note: string; completion_status: string | null; rating_eligible: boolean };
type Streak = { current_days: number; qualified_dates: string[]; reason: string };

function csrfHeaders(): HeadersInit {
  return { "X-CSRF-Token": sessionStorage.getItem("impulse_csrf") ?? "" };
}

export function DevelopmentJourney() {
  const client = useQueryClient();
  const tracks = useQuery({ queryKey: ["tracks"], queryFn: () => apiRequest<TrackOverview>("/api/v1/development/tracks") });
  const roadmaps = useQuery({ queryKey: ["roadmaps"], queryFn: () => apiRequest<Roadmap[]>("/api/v1/me/roadmaps") });
  const [pendingTrack, setPendingTrack] = useState<Track | null>(null);
  const [consultationVisible, setConsultationVisible] = useState(false);
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
    <div className="feature-stack">
      <section><p className="eyebrow">Профессиональные направления</p><h1 id="workspace-title">Найдите своё через практику</h1><p className="lead">Можно развивать два направления одновременно. Смена интереса — полезный результат: прогресс сохраняется, штрафов и негативных меток нет.</p></section>
      <div className="track-grid">
        {overview.tracks.map((track) => <button className={`track-card track-card--${track.status ?? "new"}`} key={track.key} onClick={() => { choose(track); }}><span>{track.title}</span><Badge tone={track.status === "active" ? "success" : "neutral"}>{track.status === "active" ? "Активно" : track.status === "frozen" ? "Заморожено · прогресс сохранён" : "Попробовать"}</Badge></button>)}
      </div>
      <button className="text-button" type="button" onClick={() => { setConsultationVisible(true); }}>Хочу узнать мнение ментора</button>
      {consultationVisible && <Card title="Консультация необязательна"><p>Можно обсудить выбор с ментором или продолжить самостоятельно — разрешение и ожидание ответа не требуются.</p><button type="button" onClick={() => { setConsultationVisible(false); }}>Продолжить самостоятельно</button></Card>}
      <section aria-labelledby="roadmap-title"><p className="eyebrow">Ваш roadmap</p><h2 id="roadmap-title">Следующие осмысленные шаги</h2><div className="roadmap-grid">
        {roadmapItems.map((roadmap) => <Card title={`${roadmap.track_key} · версия ${String(roadmap.policy_version)}`} key={roadmap.track_key}>{roadmap.replacement_reason && <p className="notice">{roadmap.replacement_reason}</p>}<ol className="roadmap-list">{roadmap.milestones.map((step) => <li className={step.completed ? "completed" : ""} key={step.key}><button type="button"><strong>{step.title}</strong><span>{step.purpose}</span><small>Навык: {step.skill} · перейти: {step.target_kind}</small></button></li>)}</ol></Card>)}
      </div></section>
      <Modal title={`Освободить место для «${pendingTrack?.title ?? "направления"}»`} open={pendingTrack !== null} onClose={() => { setPendingTrack(null); }}><p>Выберите направление для заморозки. Весь подтверждённый прогресс останется в истории.</p><div className="modal-actions">{activeTracks.map((track) => <button type="button" key={track.key} onClick={() => { if (pendingTrack) selectTrack.mutate({ trackKey: pendingTrack.key, freezeTrackKey: track.key }); }}>Заморозить «{track.title}»</button>)}</div></Modal>
    </div>
  );
}

export function Bootcamp({ honorBoardEnabled, honorBoardConsent }: { honorBoardEnabled: boolean; honorBoardConsent: boolean }) {
  const client = useQueryClient();
  const [trackFilter, setTrackFilter] = useState("all");
  const courses = useQuery({ queryKey: ["courses"], queryFn: () => apiRequest<Course[]>("/api/v1/development/courses") });
  const streak = useQuery({ queryKey: ["streak"], queryFn: () => apiRequest<Streak>("/api/v1/me/learning/streak") });
  const completion = useMutation({ mutationFn: (courseKey: string) => apiRequest(`/api/v1/me/courses/${encodeURIComponent(courseKey)}/completion`, { method: "POST", headers: csrfHeaders() }), onSuccess: async () => { await client.invalidateQueries({ queryKey: ["courses"] }); } });
  const learning = useMutation({ mutationFn: (courseKey: string) => apiRequest<Streak>(`/api/v1/me/courses/${encodeURIComponent(courseKey)}/learning-days`, { method: "POST", headers: csrfHeaders(), body: JSON.stringify({ occurred_at: new Date().toISOString() }) }), onSuccess: async () => { await client.invalidateQueries({ queryKey: ["streak"] }); } });
  if (courses.isLoading || streak.isLoading) return <StatePanel kind="loading" />;
  if (!courses.data || !streak.data || courses.isError || streak.isError) return <StatePanel kind="error" action="Обновить" onAction={() => { void courses.refetch(); void streak.refetch(); }} />;
  const trackOptions = [...new Set(courses.data.flatMap((course) => course.track_keys))];
  const visible = courses.data.filter((course) => trackFilter === "all" || course.track_keys.includes(trackFilter));
  return (
    <div className="feature-stack"><section><p className="eyebrow">Bootcamp</p><h1 id="workspace-title">Учитесь ради следующего результата</h1><p className="lead">Каждый курс связан с выбранным направлением и объясняет, где навык пригодится в реальной задаче.</p></section>
      <Card title={`Серия: ${String(streak.data.current_days)} дн.`}><p>{streak.data.reason}</p><small>Один локальный день учитывается один раз — количество кликов не увеличивает серию.</small></Card>
      <label className="catalog-filter">Направление<select value={trackFilter} onChange={(event) => { setTrackFilter(event.target.value); }}><option value="all">Все мои направления</option>{trackOptions.map((track) => <option key={track} value={track}>{track}</option>)}</select></label>
      <div className="course-grid">{visible.map((course) => <Card title={course.title} key={course.key}><p>{course.recommendation_reason}</p><p className="muted">{course.access_note}</p><div className="course-meta"><Badge tone={course.availability === "available" ? "success" : "warning"}>{course.availability === "available" ? "Доступен" : "Внешний доступ ограничен"}</Badge>{course.completion_status && <Badge>{course.completion_status === "verified" ? "Подтверждено" : "Ожидает проверки"}</Badge>}</div><SafeExternalLink href={course.source_url}>Открыть источник курса</SafeExternalLink><div className="course-actions"><button type="button" onClick={() => { completion.mutate(course.key); }}>Отметить завершение</button><button type="button" className="secondary-button" onClick={() => { learning.mutate(course.key); }}>Учебный шаг выполнен</button></div>{course.completion_status === "reported" && <p className="notice">Баллы не начисляются до проверки источника.</p>}</Card>)}</div>
      {honorBoardEnabled && honorBoardConsent && <Card title="Зал славы курсов"><p>Здесь показываются только участники, отдельно согласившиеся на публичное отображение подтверждённого завершения.</p></Card>}
    </div>
  );
}
