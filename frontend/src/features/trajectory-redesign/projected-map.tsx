import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { apiRequest } from "../../api/client";
import type { components } from "../../api/schema";

type CatalogTask = components["schemas"]["CatalogRecommendationItemView"];
const TASK_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
import type { RuntimeApiPath } from "../../api/client";
import { Drawer } from "../../components/ui";
import type {
  TrajectoryCheckpointDetailView,
  TrajectoryMapTrackView,
} from "../trajectory-map/types";

/** The server owns status and availability, including SUBMITTED checkpoints. */
export function ProjectedCheckpointDrawer(props: {
  checkpointKey: string;
  track: TrajectoryMapTrackView;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const navigation = useQuery({
    queryKey: ["me"],
    queryFn: () => apiRequest<{ navigation: string[] }>("/api/v1/me"),
    enabled: true,
  });
  const checkpoint = props.track.checkpoints.find((item) => item.key === props.checkpointKey) ?? null;
  const needsTaskResolution = checkpoint?.target_kind === "task" &&
    !TASK_UUID.test(checkpoint.target_key) && checkpoint.actionable;
  const taskCandidates = useQuery({
    queryKey: ["trajectory-task-resolve", checkpoint?.target_key],
    queryFn: () => apiRequest<CatalogTask[]>(
      ("/api/v1/me/task-recommendations/resolve?task_key=" + encodeURIComponent(checkpoint?.target_key ?? "")) as RuntimeApiPath,
      { cache: "no-store" },
    ),
    enabled: needsTaskResolution,
  });

  const details = useQuery({
    queryKey: ["trajectory-map-checkpoint", props.track.track_key, props.track.policy_version, props.checkpointKey],
    queryFn: () => apiRequest<TrajectoryCheckpointDetailView>(
      ("/api/v1/me/trajectory-map/checkpoints/" + encodeURIComponent(props.checkpointKey)) as RuntimeApiPath,
    ),
    enabled: checkpoint !== null,
  });

  return (
    <Drawer title="Детали этапа" open onClose={props.onClose}>
      {checkpoint === null ? (
        <p role="status">Этот этап отсутствует в доступной серверной карте. Проверьте ссылку.</p>
      ) : (
        <div className="trajectory-redesign-checkpoint-detail" data-testid="trajectory-checkpoint-detail">
          <span className="trajectory-redesign-kicker">ДОРОЖНАЯ КАРТА · V{props.track.policy_version}</span>
          <h3>{checkpoint.title}</h3>
          <span className="trajectory-redesign-step-state">{checkpoint.state_label}</span>
          <p>{checkpoint.purpose}</p>
          <dl>
            <div><dt>Компетенция</dt><dd>{checkpoint.skill}</dd></div>
            <div><dt>Этап</dt><dd>{checkpoint.target_kind === "course" ? "Bootcamp" : "Задача"} · {checkpoint.position}</dd></div>
            <div><dt>Баллы</dt><dd>Подтверждено {checkpoint.points_earned} из {checkpoint.points_available}</dd></div>
          </dl>
          {checkpoint.locked_reasons.length > 0 && (
            <section aria-label="Предпосылки этапа">
              <strong>Чтобы открыть этап</strong>
              <ul>{checkpoint.locked_reasons.map((item) => <li key={item.milestone_key}>{item.title}</li>)}</ul>
            </section>
          )}
          {details.isPending ? <p role="status">Получаем подтверждения и требования…</p>
            : details.isError ? <div role="status"><p>Не удалось получить детали с сервера.</p><button type="button" onClick={() => { void details.refetch(); }}>Повторить</button></div>
            : (
              <>
                <dl>
                  <div><dt>Цель</dt><dd>{details.data.goal}</dd></div>
                  <div><dt>Результат</dt><dd>{details.data.outcome}</dd></div>
                  <div><dt>Влияние на навык</dt><dd>{details.data.skill_impact.explanation}</dd></div>
                </dl>
                {details.data.evidence_refs.length > 0 && (
                  <section><strong>Цифровые следы</strong>
                    <ul>{details.data.evidence_refs.map((item) => <li key={item}>{item}</li>)}</ul>
                  </section>
                )}
              </>
            )}
          {checkpoint.state === "SUBMITTED" && <p role="status">Результат на проверке. Следующие доступные этапы можно проходить, баллы ещё не начислены.</p>}
          {checkpoint.state === "COMPLETED" && <p role="status">Этап подтверждён сервером.</p>}
          {checkpoint.actionable && (checkpoint.target_kind === "course" || checkpoint.target_kind === "task") && (
            <div className="trajectory-redesign-target-actions">
              {navigation.isError ? (
                <p role="status">Не удалось проверить доступность раздела. Обновите страницу.</p>
              ) : navigation.isPending ? (
                <p role="status">Проверяем доступный раздел…</p>
              ) : !navigation.data.navigation.includes(checkpoint.target_kind === "course" ? "Bootcamp" : "Задачи") ? (
                <p role="status">Раздел недоступен для текущей роли.</p>
              ) : checkpoint.target_kind === "course" || TASK_UUID.test(checkpoint.target_key) ? (
                <button type="button" className="trajectory-redesign-detail-action" onClick={() => {
                  const section = checkpoint.target_kind === "course" ? "Bootcamp" : "Задачи";
                  const index = navigation.data.navigation.indexOf(section);
                  if (index < 0) return;
                  const parameter = checkpoint.target_kind === "course" ? "course" : "task";
                  void navigate("/workspace/" + String(index) + "?" + parameter + "=" + encodeURIComponent(checkpoint.target_key));
                }}>{checkpoint.target_kind === "course" ? "Открыть курс" : "Открыть задачу"} →</button>
              ) : taskCandidates.isPending ? (
                <p role="status">Сопоставляем задачу с актуальным каталогом…</p>
              ) : taskCandidates.isError ? (
                <div role="status">
                  <p>Не удалось сопоставить задачу с каталогом.</p>
                  <button type="button" onClick={() => { void taskCandidates.refetch(); }}>Повторить</button>
                </div>
              ) : taskCandidates.data.length === 0 ? (
                <div role="status">
                  <p>Задача по ключу сейчас недоступна. Можно посмотреть другие задачи направления.</p>
                  <button type="button" className="trajectory-redesign-detail-action" onClick={() => {
                    const index = navigation.data.navigation.indexOf("Задачи");
                    if (index >= 0) void navigate("/workspace/" + String(index) + "?direction=" + encodeURIComponent(props.track.track_key));
                  }}>Каталог задач →</button>
                </div>
              ) : (
                <div className="trajectory-redesign-target-list">
                  {taskCandidates.data.length > 1 &&
                    <p>Ключ используется в нескольких проектах. Выберите нужную задачу:</p>}
                  {taskCandidates.data.map((task) => (
                    <button type="button" className="trajectory-redesign-detail-action" key={task.task_id} onClick={() => {
                      const index = navigation.data.navigation.indexOf("Задачи");
                      if (index >= 0) void navigate("/workspace/" + String(index) + "?task=" + encodeURIComponent(task.task_id));
                    }}>Открыть «{task.title}»{taskCandidates.data.length > 1 ? " · " + task.customer.display_name : ""} →</button>
                  ))}
                </div>
              )}
            </div>
          )}
          {!checkpoint.actionable && checkpoint.state !== "COMPLETED" && checkpoint.state !== "SUBMITTED" && (
            <p className="trajectory-redesign-lock-note">Выполнение недоступно по текущей серверной политике.</p>
          )}
        </div>
      )}
    </Drawer>
  );
}
