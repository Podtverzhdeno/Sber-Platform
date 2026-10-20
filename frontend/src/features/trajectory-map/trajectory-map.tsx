import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";

import { apiRequest } from "../../api/client";
import type { RuntimeApiPath } from "../../api/client";
import { Badge, Drawer, StatePanel } from "../../components/ui";
import type {
  MapCheckpointView,
  SkillImpactView,
  TrajectoryCheckpointDetailView,
  TrajectoryMapTrackView,
} from "./types";
import "./trajectory-map.css";

const MAP_PATH = "/api/v1/me/trajectory-map" as RuntimeApiPath;

const stateTone: Record<string, "success" | "warning" | "neutral"> = {
  COMPLETED: "success",
  CURRENT: "neutral",
  SUBMITTED: "neutral",
  AVAILABLE: "neutral",
  BRANCH: "neutral",
  OPTIONAL: "neutral",
  LOCKED: "warning",
  SKIPPED_BY_RULE: "neutral",
};

function Connector({ done }: { done: boolean }) {
  return <span className={`tmap-connector${done ? " tmap-connector--done" : ""}`} aria-hidden="true" />;
}

function TrackRoute({
  checkpoints,
  currentKey,
  activeKey,
  onOpen,
}: {
  checkpoints: MapCheckpointView[];
  currentKey: string | null;
  activeKey: string | null;
  onOpen: (key: string) => void;
}) {
  const currentRef = useRef<HTMLLIElement | null>(null);
  const reduced =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  useEffect(() => {
    if (reduced) return;
    const node = currentRef.current;
    if (
      node &&
      typeof node.scrollIntoView === "function" &&
      typeof window !== "undefined" &&
      typeof window.requestAnimationFrame === "function"
    ) {
      window.requestAnimationFrame(() => {
        node.scrollIntoView({ block: "center" });
      });
    }
  }, [reduced, currentKey, activeKey]);
  return (
    <ol className="tmap-route" data-testid="trajectory-route">
      {checkpoints.map((checkpoint, index) => {
        const previous = index > 0 ? checkpoints[index - 1] : undefined;
        const isCurrent = checkpoint.key === currentKey;
        const isActive = checkpoint.key === activeKey;
        return (
          <li
            key={checkpoint.key}
            ref={isCurrent ? currentRef : undefined}
            className={`tmap-step${isCurrent ? " tmap-step--current" : ""}${isActive ? " tmap-step--active" : ""}`}
          >
            {previous ? <Connector done={previous.state === "COMPLETED"} /> : null}
            <button
              type="button"
              className={`tmap-checkpoint tmap-checkpoint--${stateTone[checkpoint.state] ?? "neutral"}`}
              aria-label={`${checkpoint.title}. ${checkpoint.state_label}`}
              aria-current={isCurrent ? "step" : undefined}
              onClick={() => {
                onOpen(checkpoint.key);
              }}
            >
              <span className="tmap-marker" aria-hidden="true">
                {checkpoint.state === "COMPLETED" ? "✓" : checkpoint.position}
              </span>
              <span className="tmap-copy">
                <strong>{checkpoint.title}</strong>
                <small>
                  {checkpoint.state_label}
                  {checkpoint.mandatory ? "" : " · опционально"}
                  {checkpoint.branch && !checkpoint.branch.satisfied ? ` · ${checkpoint.branch.rule}` : ""}
                </small>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function TrackCard({
  track,
  activeKey,
  onOpen,
}: {
  track: TrajectoryMapTrackView;
  activeKey: string | null;
  onOpen: (key: string) => void;
}) {
  return (
    <article className="tmap-track" data-testid="trajectory-track">
      <div className="tmap-track-header">
        <span className="tmap-track-title">{track.track_key}</span>
        <span className="muted" data-testid="trajectory-track-progress">
          Обязательных пройдено {track.progress.completed_mandatory} из {track.progress.total_mandatory} (
          {track.progress.percent}%)
        </span>
      </div>
      <TrackRoute checkpoints={track.checkpoints} currentKey={track.current_key} activeKey={activeKey} onOpen={onOpen} />
      {!track.current_key ? (
        <p className="muted" data-testid="trajectory-no-current">
          Система не определила текущий шаг этого трека: подтвердите обязательную веху или сдайте
          работу на проверку — карта обновится по живым данным.
        </p>
      ) : null}
    </article>
  );
}

function ImpactStrip({ impact }: { impact: SkillImpactView }) {
  return (
    <p className="tmap-impact" data-testid="trajectory-skill-impact">
      <span data-testid="trajectory-skill-impact-levels">
        {impact.current_level} → {impact.target_level}
      </span>
      {impact.projected_level ? (
        <em data-testid="trajectory-skill-impact-forecast">
          Прогноз: {impact.projected_level}
          {impact.forecast_only ? " (не подтверждено платформой)" : ""}
        </em>
      ) : null}
    </p>
  );
}

function CheckpointDetail({
  detail,
  state,
  onNavigatePrerequisite,
}: {
  detail: TrajectoryCheckpointDetailView | undefined;
  state: "pending" | "error" | "success";
  onNavigatePrerequisite: (key: string) => void;
}) {
  if (state === "pending") {
    return <p data-testid="trajectory-detail-loading">Загружаем цель, предпосылки и правила вехи…</p>;
  }
  if (state === "error" || !detail) {
    return (
      <p data-testid="trajectory-detail-unavailable">
        Служба карты недоступна: детали вехи сейчас не получить. Попробуйте позже — карта не
        подменяет данные вымышленными.
      </p>
    );
  }
  const checkpoint = detail.checkpoint;
  return (
    <div className="tmap-detail" data-testid="trajectory-detail">
      <p className="eyebrow" data-testid="trajectory-detail-skill">
        {checkpoint.skill}
      </p>
      <h3 data-testid="trajectory-detail-title">{checkpoint.title}</h3>
      <p>
        <Badge tone={stateTone[checkpoint.state] ?? "neutral"}>{checkpoint.state_label}</Badge>
      </p>
      {checkpoint.locked_reasons.length > 0 ? (
        <p data-testid="trajectory-detail-locked-reasons">
          Шаг заблокирован предпосылками: {checkpoint.locked_reasons.map((reason) => reason.title).join(", ")}
        </p>
      ) : null}
      <dl>
        <dt>Цель</dt>
        <dd data-testid="trajectory-detail-goal">{detail.goal}</dd>
        <dt>Результат</dt>
        <dd data-testid="trajectory-detail-outcome">{detail.outcome}</dd>
      </dl>
      <p className="tmap-detail-points" data-testid="trajectory-detail-points">
        Баллы: доступно {checkpoint.points_available}, начислено {checkpoint.points_earned} (
        {checkpoint.points_rule})
      </p>
      <section>
        <h4>Предпосылки</h4>
        <ul data-testid="trajectory-detail-prerequisites">
          {detail.prerequisites.map((prerequisite) => (
            <li key={prerequisite.milestone_key}>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  onNavigatePrerequisite(prerequisite.milestone_key);
                }}
              >
                {prerequisite.title} — {prerequisite.met ? "подтверждено" : "не подтверждено"}
                <span aria-hidden="true"> →</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h4>Доказательства</h4>
        <ul data-testid="trajectory-detail-evidence">
          {detail.evidence_refs.map((ref) => (
            <li key={ref}>{ref}</li>
          ))}
        </ul>
      </section>
      <ImpactStrip impact={detail.skill_impact} />
      {detail.skill_impact.missing_evidence.length > 0 ? (
        <p data-testid="trajectory-detail-missing-evidence">
          Нужно подтвердить: {detail.skill_impact.missing_evidence.join(", ")}
        </p>
      ) : null}
      {detail.skill_impact.fallback ? (
        <p data-testid="trajectory-detail-fallback">{detail.skill_impact.fallback}</p>
      ) : null}
      {detail.replay ? (
        <p data-testid="trajectory-detail-replay">
          Вы уже выполняли эту веху: повторный шаг предусмотрен правилами версии {detail.policy_version} и
          влияет только на новые баллы и прогноз навыка.
        </p>
      ) : null}
    </div>
  );
}

export function TrajectoryMapSection({
  tracks,
  state,
  activeKey,
  detail,
  detailState,
  onOpenCheckpoint,
  onCloseCheckpoint,
  onRetry,
}: {
  tracks: TrajectoryMapTrackView[] | undefined;
  state: "pending" | "error" | "success";
  activeKey: string | null;
  detail: TrajectoryCheckpointDetailView | undefined;
  detailState: "pending" | "error" | "success";
  onOpenCheckpoint: (key: string) => void;
  onCloseCheckpoint: () => void;
  onRetry: () => void;
}) {
  if (state === "pending") {
    return <StatePanel kind="loading" />;
  }
  if (state === "error") {
    return (
      <StatePanel kind="error" action="Повторить запрос" onAction={onRetry} />
    );
  }
  if (!tracks || tracks.length === 0) {
    return <StatePanel kind="empty" />;
  }
  return (
    <div className="feature-stack" data-testid="trajectory-map" aria-label="Интерактивная карта траектории">
      {tracks.map((track) => (
        <TrackCard key={track.track_key} track={track} activeKey={activeKey} onOpen={onOpenCheckpoint} />
      ))}
      <Drawer open={Boolean(activeKey)} onClose={onCloseCheckpoint} title="Веха траектории">
        <CheckpointDetail
          detail={detail}
          state={detailState}
          onNavigatePrerequisite={onOpenCheckpoint}
        />
      </Drawer>
    </div>
  );
}

export function TrajectoryMapPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const openKey = searchParams.get("checkpoint");
  const maps = useQuery<TrajectoryMapTrackView[]>({
    queryKey: ["trajectory-map"],
    queryFn: () => apiRequest<TrajectoryMapTrackView[]>(MAP_PATH),
  });
  const detail = useQuery<TrajectoryCheckpointDetailView>({
    queryKey: ["trajectory-map-detail", openKey],
    enabled: Boolean(openKey),
    queryFn: () =>
      apiRequest<TrajectoryCheckpointDetailView>(
        `/api/v1/me/trajectory-map/checkpoints/${openKey ?? ""}` as RuntimeApiPath,
      ),
  });
  const open = (key: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("checkpoint", key);
    setSearchParams(next, { replace: false });
  };
  const close = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("checkpoint");
    setSearchParams(next, { replace: false });
  };
  return (
    <TrajectoryMapSection
      tracks={maps.data}
      state={maps.status}
      activeKey={openKey}
      detail={detail.data}
      detailState={openKey ? detail.status : "pending"}
      onOpenCheckpoint={open}
      onCloseCheckpoint={close}
      onRetry={() => {
        void maps.refetch();
      }}
    />
  );
}
