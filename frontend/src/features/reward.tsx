import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { apiRequest } from "../api/client";
import { Badge, Card, StatePanel } from "../components/ui";

type Assessment = { criterion_key: string; finding: string; evidence_refs: string[] };
type Review = {
  id: string; contribution_id: string; contribution_version: number; version: number;
  grade: "A" | "B" | "C"; assessments: Assessment[]; explanation: string;
  status: string; draft_origin: string; confirmed_by: string | null; published_by: string | null;
};
type Payout = { id: string; review_version: number; amount: string | null; currency: string | null; status: string; version: number };
type RewardItem = { review: Review; payout: Payout | null };
type MentorQueueItem = RewardItem & { task_title: string; deadline_at: string; personal_summary: string; artifact_keys: string[]; contribution_accepted: boolean; authorship_conflict_open: boolean };

const csrfHeaders = (): HeadersInit => ({ "X-CSRF-Token": sessionStorage.getItem("impulse_csrf") ?? "" });
const statusLabels: Record<string, string> = {
  draft: "Черновик", proposed: "Ожидает подтверждения", human_confirmed: "Подтверждено человеком",
  published: "Опубликовано", disputed: "Оспаривается", corrected: "Исправлено", upheld: "Оставлено без изменения",
  calculated: "Начисление рассчитано", approved: "Начисление одобрено", sent_to_payment_system: "Передано в платёжный контур",
  paid: "Выплачено", failed: "Ошибка выплаты", reversed: "Возвращено", not_applicable: "Выплата не предусмотрена",
};

function money(amount: string | null, currency: string | null) {
  if (!amount || !currency) return "Не предусмотрено";
  const [integer = "0", fraction] = amount.split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${fraction ? `${grouped},${fraction}` : grouped} ${currency === "RUB" ? "₽" : currency}`;
}

function ReviewEvidence({ item, mentor = false }: { item: RewardItem; mentor?: boolean }) {
  const { review, payout } = item;
  return <Card title={`Оценка ${review.grade} · вклад версии ${String(review.contribution_version)}`}>
    <div className="review-statuses"><Badge tone={review.status === "disputed" ? "warning" : "success"}>{statusLabels[review.status] ?? review.status}</Badge>{payout && <Badge tone={payout.status === "failed" ? "warning" : "neutral"}>{statusLabels[payout.status] ?? payout.status}</Badge>}</div>
    {review.draft_origin === "ai_suggestion" && <aside className="ai-draft" aria-label="Черновик AI"><strong>Черновик предложен AI</strong><p>Это только подготовка по доказательствам. AI не выставляет финальную оценку и не назначает выплату.</p></aside>}
    <section className="human-decision" aria-label="Финальное решение человека"><p className="eyebrow">Финальное решение человека</p><p className="review-grade">{review.grade}</p><p>{review.explanation}</p><p className="muted">Версия оценки {review.version}{review.published_by ? ` · подписал ${review.published_by.slice(0, 8)}` : " · ещё не опубликована"}</p></section>
    <dl className="review-criteria">{review.assessments.map((assessment) => <div key={assessment.criterion_key}><dt>{assessment.criterion_key}</dt><dd>{assessment.finding}<small>Доказательства: {assessment.evidence_refs.join(", ")}</small></dd></div>)}</dl>
    {payout ? <div className="payout-explanation"><strong>{money(payout.amount, payout.currency)}</strong><span>{statusLabels[payout.status] ?? payout.status}</span><small>Расчёт связан с версией оценки {payout.review_version}. Фактический перевод отражается отдельным статусом.</small></div> : <p className="notice">Начисление ещё не рассчитано. Оценка сама по себе не означает фактическую выплату.</p>}
    {mentor && <p className="muted">Вклад: {review.contribution_id} · версия доказательств {review.contribution_version}</p>}
  </Card>;
}

export function ParticipantRewardEvidence() {
  const query = useQuery({ queryKey: ["participant-reward-evidence"], queryFn: () => apiRequest<RewardItem[]>("/api/v1/me/reward-evidence"), refetchOnMount: "always" });
  if (query.isLoading) return <StatePanel kind="loading" />;
  if (query.isError || !query.data) return <StatePanel kind="error" action="Повторить" onAction={() => { void query.refetch(); }} />;
  return <section className="feature-stack" aria-labelledby="reward-evidence-title"><div><p className="eyebrow">Подтверждённый опыт и деньги</p><h2 id="reward-evidence-title">Почему поставлена оценка и что происходит с выплатой</h2><p className="lead">Здесь видны факты личного вклада, решение человека и отдельный статус начисления. Оценка не маскирует ошибку перевода.</p></div>{query.data.length ? <div className="reward-grid">{query.data.map((item) => <ReviewEvidence key={item.review.id} item={item} />)}</div> : <StatePanel kind="empty" />}</section>;
}

export function MentorReviewWorkspace() {
  const client = useQueryClient();
  const [escalated, setEscalated] = useState<Set<string>>(new Set());
  const query = useQuery({ queryKey: ["mentor-review-workspace"], queryFn: () => apiRequest<MentorQueueItem[]>("/api/v1/mentor/review-queue"), refetchOnMount: "always" });
  const transition = useMutation({ mutationFn: ({ review, action }: { review: Review; action: "propose" | "confirm" | "publish" }) => apiRequest(`/api/v1/mentor/reviews/${review.id}/${action}`, { method: "POST", headers: csrfHeaders(), body: JSON.stringify({ expected_version: review.version }) }), onSuccess: async () => client.invalidateQueries({ queryKey: ["mentor-review-workspace"] }) });
  if (query.isLoading) return <StatePanel kind="loading" />;
  if (query.isError || !query.data) return <StatePanel kind="error" action="Повторить" onAction={() => { void query.refetch(); }} />;
  return <div className="feature-stack"><section><p className="eyebrow">Ментор · human-in-the-loop</p><h1 id="workspace-title">Проверяйте доказательства, а не вывод AI</h1><p className="lead">Очередь отсортирована сервером по дедлайну. Видны только назначенные вам работы; AI-черновик отделён от финального решения человека.</p></section>{query.data.length ? <div className="mentor-queue">{query.data.map((item) => <article className="mentor-queue-item" key={item.review.id}><header><div><p className="eyebrow">До {new Date(item.deadline_at).toLocaleString("ru-RU")}</p><h2>{item.task_title}</h2></div><Badge tone={item.authorship_conflict_open ? "warning" : item.contribution_accepted ? "success" : "neutral"}>{item.authorship_conflict_open ? "Конфликт авторства" : item.contribution_accepted ? "Вклад принят" : "Ожидает приёмки"}</Badge></header><div className="mentor-evidence"><div><h3>Личный вклад</h3><p>{item.personal_summary}</p><small>Доказательства: {item.artifact_keys.join(", ") || "не приложены"}</small></div><ReviewEvidence item={item} mentor /></div><div className="review-actions">{item.review.status === "draft" && <button type="button" onClick={() => { transition.mutate({ review: item.review, action: "propose" }); }}>Передать на подтверждение</button>}{item.review.status === "proposed" && <button type="button" onClick={() => { transition.mutate({ review: item.review, action: "confirm" }); }}>Подтвердить человеком</button>}{item.review.status === "human_confirmed" && <button type="button" disabled={!item.contribution_accepted || item.authorship_conflict_open} onClick={() => { transition.mutate({ review: item.review, action: "publish" }); }}>Опубликовать оценку</button>}<button className="secondary-button" type="button" onClick={() => { setEscalated((current) => new Set(current).add(item.review.id)); }}>{escalated.has(item.review.id) ? "Передано оператору (демо)" : "Эскалировать оператору"}</button></div></article>)}</div> : <StatePanel kind="empty" />}</div>;
}
