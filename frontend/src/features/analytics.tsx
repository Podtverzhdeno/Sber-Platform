import { useQuery } from "@tanstack/react-query";

import { apiRequest } from "../api/client";
import { Badge, StatePanel } from "../components/ui";

type Stage = { key: string; title: string; status: "completed" | "in_progress" | "not_started" | "unknown"; completed: boolean; count: number };
type Earnings = { calculated: string; approved: string; paid: string; failed: string; currency: string | null; unknown_items: number };
type Analytics = { stages: Stage[]; successful: boolean; next_action: string; earnings: Earnings; freshness: string; generated_at: string };
const money = (value: string, currency: string | null) => `${Number(value).toLocaleString("ru-RU")} ${currency ?? "₽"}`;
const stageLabel: Record<Stage["status"], string> = { completed: "Завершено", in_progress: "В процессе", not_started: "Не начато", unknown: "Нет данных" };

export function ParticipantAnalytics() {
  const query = useQuery({ queryKey: ["participant-analytics"], queryFn: () => apiRequest<Analytics>("/api/v1/me/analytics/journey"), refetchOnMount: "always" });
  if (query.isLoading) return <StatePanel kind="loading" />;
  if (query.isError || !query.data) return <StatePanel kind="error" action="Повторить" onAction={() => { void query.refetch(); }} />;
  const data = query.data;
  const earnings = [{ key: "calculated", title: "Рассчитано", value: data.earnings.calculated }, { key: "approved", title: "Одобрено", value: data.earnings.approved }, { key: "paid", title: "Выплачено", value: data.earnings.paid }, { key: "failed", title: "Ошибка выплаты", value: data.earnings.failed }];
  return <div className="feature-stack participant-analytics"><header className="dashboard-heading"><div><p className="eyebrow">Аналитика · личный путь</p><h1 id="workspace-title">От выбора направления до подтверждённого опыта</h1><p className="lead">Этап считается успешным только после подтверждённого результата. Активность и незавершённая работа не превращаются в успех автоматически.</p></div><div className="freshness-chip"><span className={data.freshness === "fresh" ? "fresh-dot" : "stale-dot"} />Обновлено {new Date(data.generated_at).toLocaleString("ru-RU")}</div></header><section className="journey-funnel" aria-label="Личная воронка">{data.stages.map((stage, index) => <article className={`journey-stage journey-stage--${stage.status}`} key={stage.key}><span className="stage-number">{index + 1}</span><div><strong>{stage.title}</strong><small>{stage.count} подтверждённых объектов</small></div><Badge tone={stage.completed ? "success" : stage.status === "in_progress" ? "warning" : "neutral"}>{stageLabel[stage.status]}</Badge>{index < data.stages.length - 1 && <i aria-hidden="true">→</i>}</article>)}</section><section className="next-step-panel"><div><p className="eyebrow">Следующее действие</p><h2>{data.next_action}</h2></div><Badge tone={data.successful ? "success" : "warning"}>{data.successful ? "Путь подтверждён" : "Путь продолжается"}</Badge></section><section><div className="section-heading"><div><p className="eyebrow">Вознаграждение</p><h2>Статусы начислений</h2></div>{data.earnings.unknown_items > 0 && <Badge tone="warning">Нет суммы: {data.earnings.unknown_items}</Badge>}</div><p className="muted">Расчёт и одобрение ещё не означают фактический перевод денег.</p><div className="earnings-grid">{earnings.map((item) => <article className={`earning-card earning-card--${item.key}`} key={item.key}><span>{item.title}</span><strong>{money(item.value, data.earnings.currency)}</strong><small>{item.key === "paid" ? "Фактически переведено" : item.key === "failed" ? "Требует внимания оператора" : "Не является выплатой"}</small></article>)}</div></section></div>;
}
