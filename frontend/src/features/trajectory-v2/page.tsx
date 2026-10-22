import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import { StatePanel } from "../../components/ui";
import { loadDevelopmentOverview, overviewQueryKey, PRIMARY_LABEL, roleStateLabel } from "./client";
import type { DevelopmentOverviewView, RoleCardView } from "./client";
import "./trajectory-v2.scss";

/**
 * Trajectory v2 master-detail shell (participant-home-trajectory-grades 5.1).
 * One authorized overview snapshot feeds the server-truth role cards; the
 * selected role is addressable through the ?role= query parameter so Back and
 * Forward restore the selection. Unselected roles show catalog structure only,
 * never personal progress.
 */
export function TrajectoryV2() {
  const overview = useQuery({
    queryKey: overviewQueryKey,
    queryFn: loadDevelopmentOverview,
  });
  if (overview.isPending) {
    return (
      <div className="trajectory-v2" data-reference="R-PAR-02">
        <StatePanel kind="loading" />
      </div>
    );
  }
  if (overview.isError) {
    return (
      <div className="trajectory-v2" data-reference="R-PAR-02">
        <section className="trajectory-v2-failure" role="status">
          <strong>Не удалось загрузить траекторию.</strong>
          <p>Карта этапов остаётся недоступной без авторизованного снимка.</p>
          <button
            type="button"
            onClick={() => {
              void overview.refetch();
            }}
          >
            Повторить
          </button>
        </section>
      </div>
    );
  }
  return (
    <TrajectoryV2Body overview={overview.data} />
  );
}

export function TrajectoryV2Body(props: { overview: DevelopmentOverviewView }) {
  const { overview } = props;
  const [searchParams, setSearchParams] = useSearchParams();
  const roleParam = searchParams.get("role");
  const selectedKey = useMemo(() => {
    const paramRole = overview.roles.find((role) => role.track_key === roleParam);
    if (paramRole) return paramRole.track_key;
    const outcomeKey = overview.next_outcome?.trajectory_key;
    return outcomeKey !== undefined && overview.roles.some((role) => role.track_key === outcomeKey)
      ? outcomeKey
      : (overview.roles[0]?.track_key ?? null);
  }, [overview, roleParam]);
  const selected = overview.roles.find((role) => role.track_key === selectedKey) ?? null;
  const primaryKey = primaryTrajectoryKey(overview);

  const roleSelected = (trackKey: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("role", trackKey);
    setSearchParams(next);
  };

  return (
    <div className="trajectory-v2" data-reference="R-PAR-02" data-as-of={overview.as_of}>
      <header className="trajectory-v2-heading">
        <div>
          <p className="eyebrow">Предпросмотр интерактивного маршрута</p>
          <h2>Моя траектория</h2>
          <small>Снимок авторизованных данных от {formatAsOf(overview.as_of)}</small>
        </div>
      </header>
      <div className="trajectory-v2-columns">
        <nav className="trajectory-v2-roles" aria-label="Роли">
          <ul>
            {overview.roles.map((role) => (
              <li key={role.track_key}>
                <RoleCardOverview
                  role={role}
                  primary={role.track_key === primaryKey}
                  selected={role.track_key === selectedKey}
                  onSelect={() => {
                    roleSelected(role.track_key);
                  }}
                />
              </li>
            ))}
          </ul>
        </nav>
        <section className="trajectory-v2-detail" aria-label="Детали роли">
          {selected === null ? (
            <p role="status">Роли пока не связаны с траекторией.</p>
          ) : (
            <RoleDetail role={selected} primary={selected.track_key === primaryKey} />
          )}
        </section>
      </div>
    </div>
  );
}

function primaryTrajectoryKey(overview: DevelopmentOverviewView): string | null {
  return overview.next_outcome?.trajectory_key ?? null;
}

function formatAsOf(asOf: string): string {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "long", timeStyle: "short" }).format(
    new Date(asOf),
  );
}

export function RoleCardOverview(props: {
  role: RoleCardView;
  primary: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const { role } = props;
  return (
    <button
      type="button"
      className="trajectory-v2-role-card"
      aria-pressed={props.selected}
      onClick={() => {
        props.onSelect();
      }}
    >
      <strong>{role.title}</strong>
      <span className="trajectory-v2-role-state">{roleStateLabel(role.state)}</span>
      {props.primary && <span className="trajectory-v2-role-badge">{PRIMARY_LABEL}</span>}
      {role.attempt_number !== null && (
        <span>попытка {role.attempt_number}</span>
      )}
      {role.attempt_number !== null && (
        <small>
          этапы: {role.completed_milestones} из {role.total_milestones}
        </small>
      )}
      {role.attempt_number === null && <small>этапов в каталоге: {role.total_milestones}</small>}
    </button>
  );
}

export function RoleDetail(props: { role: RoleCardView; primary: boolean }) {
  const role = props.role;
  return (
    <article className="trajectory-v2-role-detail" data-testid="trajectory-role-detail" data-role-key={role.track_key}>
      <header>
        <h3>{role.title}</h3>
        <span className="trajectory-v2-role-state">{roleStateLabel(role.state)}</span>
        {props.primary && <span className="trajectory-v2-role-badge">{PRIMARY_LABEL}</span>}
      </header>
      {role.attempt_number === null ? (
        <section aria-label="Прогресс роли">
          <p className="trajectory-v2-unselected-note" role="status">
            Траектория ещё не включена. Персональный прогресс отсутствует — он появится после
            выбора роли в каталоге траекторий.
          </p>
          <small>этапов в каталоге: {role.total_milestones}</small>
        </section>
      ) : (
        <section aria-label="Прогресс роли">
          <p>Этапов пройдено: {role.completed_milestones} из {role.total_milestones}.</p>
          <small>Попытка {role.attempt_number}.</small>
        </section>
      )}
    </article>
  );
}
