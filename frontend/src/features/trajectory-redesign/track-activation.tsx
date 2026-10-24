import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { apiRequest } from "../../api/client";
import { Modal } from "../../components/ui";
import { overviewQueryKey, roadmapsQueryKey, type RoleCardView } from "../trajectory-v2/client";
import { trajectoryMapQueryKey } from "./map-client";

type TrackCatalogItem = {
  key: string;
  title: string;
  status: "active" | "frozen" | null;
  completed_milestones: string[];
};
type TrackCatalog = {
  active_count: number;
  max_active: number;
  tracks: TrackCatalogItem[];
};

/** Existing authorized track-selection flow, without client-owned progress. */
export function TrajectoryActivation(props: { role: RoleCardView; allowed: boolean }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const catalog = useQuery({
    queryKey: ["track-activation-catalog"],
    queryFn: () => apiRequest<TrackCatalog>("/api/v1/development/tracks"),
    enabled: open,
    staleTime: 0,
  });
  const command = useMutation({
    mutationFn: ({ trackKey, freezeTrackKey }: { trackKey: string; freezeTrackKey?: string }) =>
      apiRequest<TrackCatalog>("/api/v1/me/tracks", {
        method: "POST",
        headers: { "X-CSRF-Token": sessionStorage.getItem("impulse_csrf") ?? "" },
        body: JSON.stringify({
          track_key: trackKey,
          ...(freezeTrackKey === undefined ? {} : { freeze_track_key: freezeTrackKey }),
        }),
      }),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: ["task-catalog-v2"] });
      queryClient.removeQueries({ queryKey: ["task-catalog-v2-detail"] });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: overviewQueryKey }),
        queryClient.invalidateQueries({ queryKey: roadmapsQueryKey }),
        queryClient.invalidateQueries({ queryKey: trajectoryMapQueryKey }),
        queryClient.invalidateQueries({ queryKey: ["tracks"] }),
        queryClient.invalidateQueries({ queryKey: ["growth-snapshot"] }),
        queryClient.invalidateQueries({ queryKey: ["track-activation-catalog"] }),
      ]);
      setOpen(false);
      setFeedback("Направление обновлено. Прогресс и доступные шаги загружены из сервера.");
    },
  });

  if (props.role.state === "active") return null;
  const label = props.role.state === "paused" ? "Возобновить направление" : "Начать осваивать";
  const track = catalog.data?.tracks.find((item) => item.key === props.role.track_key) ?? null;
  const activeTracks = catalog.data?.tracks.filter((item) =>
    item.status === "active" && item.key !== props.role.track_key) ?? [];
  const availableSlot = catalog.data !== undefined && catalog.data.active_count < catalog.data.max_active;

  const request = (freezeTrackKey?: string) => {
    if (track === null || !props.allowed || command.isPending) return;
    if (freezeTrackKey !== undefined && !activeTracks.some((item) => item.key === freezeTrackKey)) return;
    command.mutate({ trackKey: track.key, freezeTrackKey });
  };

  return (
    <div className="trajectory-redesign-activation">
      {props.allowed ? (
        <button type="button" className="trajectory-redesign-activation-trigger"
          onClick={() => { setOpen(true); setFeedback(null); }}>
          {label}
        </button>
      ) : (
        <small role="status">Выбор направлений недоступен для текущих прав</small>
      )}
      {feedback && <small role="status" className="trajectory-redesign-activation-feedback">{feedback}</small>}
      <Modal title={"Выбрать направление: " + props.role.title} open={open}
        onClose={() => { if (!command.isPending) setOpen(false); }}>
        {catalog.isPending ? (
          <p role="status">Проверяем доступные направления…</p>
        ) : catalog.isError ? (
          <div role="status">
            <p>Не удалось получить актуальные ограничения. Выбор не выполнен.</p>
            <button type="button" onClick={() => { void catalog.refetch(); }}>Повторить</button>
          </div>
        ) : track === null ? (
          <p role="status">Выбранной роли нет в текущем каталоге. Обновите страницу и попробуйте снова.</p>
        ) : track.status === "active" ? (
          <div role="status">
            <p>Направление уже активно на сервере. Обновите страницу для актуального прогресса.</p>
            <button type="button" onClick={() => { void queryClient.invalidateQueries({ queryKey: overviewQueryKey }); setOpen(false); }}>Обновить</button>
          </div>
        ) : availableSlot ? (
          <div className="trajectory-redesign-activation-body">
            <p>Можно начать направление «{props.role.title}». История остальных направлений сохранится.</p>
            <button type="button" disabled={command.isPending} onClick={() => { request(); }}>
              {command.isPending ? "Сохраняем…" : "Подтвердить выбор"}
            </button>
          </div>
        ) : activeTracks.length > 0 ? (
          <div className="trajectory-redesign-activation-body">
            <p>Достигнут лимит активных направлений: {catalog.data.active_count} из {catalog.data.max_active}. Выберите, какое направление поставить на паузу. Подтверждённые результаты сохранятся.</p>
            {activeTracks.map((item) => (
              <button key={item.key} type="button" disabled={command.isPending}
                onClick={() => { request(item.key); }}>
                {command.isPending ? "Сохраняем…" : "Поставить «" + item.title + "» на паузу и выбрать «" + props.role.title + "»"}
              </button>
            ))}
          </div>
        ) : (
          <p role="status">Выбор направления сейчас не разрешён серверной политикой.</p>
        )}
        {command.isError && <p role="alert">Не удалось изменить направление. Данные не обновлены; повторите попытку.</p>}
      </Modal>
    </div>
  );
}
