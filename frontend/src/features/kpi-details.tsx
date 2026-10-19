import {
  ACTIVE_STATUSES,
  ATTENTION_STATUSES,
  ASSIGNMENT_STATUS_LABELS,
  EVIDENCE_KIND_LABELS,
  HISTORY_STATUSES,
  dayLabel,
  type CourseCertificateView,
  type EvidenceAnchorView,
  type GrowthSnapshotView,
  type KpiKey,
  type WorkItemView,
} from "./kpi-data";

function Pending({ kind }: { kind: KpiKey }) {
  return (
    <p className="kpi-state" data-testid={`kpi-${kind}-loading`}>
      Загружаем данные показателя…
    </p>
  );
}

function Unavailable({ kind }: { kind: KpiKey }) {
  return (
    <p className="kpi-state" data-testid={`kpi-${kind}-unavailable`}>
      Данные показателя сейчас недоступны. Платформа не показывает выдуманные числа — вернитесь,
      когда источник восстановится.
    </p>
  );
}

export function ProgressBody({ state, snapshot }: { state: "pending" | "error" | "success"; snapshot?: GrowthSnapshotView }) {
  if (state === "pending") return <Pending kind="progress" />;
  if (state === "error" || !snapshot) return <Unavailable kind="progress" />;
  return (
    <div className="kpi-body" data-testid="kpi-progress-body">
      <p className="kpi-note" data-testid="kpi-progress-definition">
        Формула: {snapshot.definitions.milestones} — взвешенная доля завершённых обязательных этапов
        маршрута. Если веса этапов не полностью определены (coverage &lt; 1), процент маршрута не
        публикуется.
      </p>
      {snapshot.trajectories.length === 0 ? (
        <p className="kpi-state" data-testid="kpi-progress-empty">
          Маршрут ещё не начат: этапы появятся после выбора плана развития.
        </p>
      ) : (
        snapshot.trajectories.map((trajectory) => (
          <section className="kpi-track" key={trajectory.track_key} data-testid={`kpi-track-${trajectory.track_key}`}>
            <header>
              <h3>{trajectory.track_title}</h3>
              <strong data-testid={`kpi-progress-percent-${trajectory.track_key}`}>
                {trajectory.completion.percent === null
                  ? "точность частична"
                  : `${String(Math.round(trajectory.completion.percent))}%`}
              </strong>
            </header>
            {trajectory.milestones.length === 0 ? (
              <p className="kpi-state">Завершённых этапов в маршруте пока нет.</p>
            ) : (
              <ul>
                {trajectory.milestones.map((milestone) => (
                  <li key={`${trajectory.track_key}:${milestone.key}`} data-testid={`kpi-milestone-${milestone.key}`}>
                    <span>
                      {milestone.purpose} · цель: {milestone.target_title}
                    </span>
                    <small>
                      {milestone.status === "completed"
                        ? "входит в прогресс"
                        : "этап впереди — вклад пока ноль"}
                    </small>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))
      )}
    </div>
  );
}

export function ProjectsBody({
  state,
  work,
  onOpenProject,
}: {
  state: "pending" | "error" | "success";
  work?: WorkItemView[];
  onOpenProject: (assignmentId: string) => void;
}) {
  if (state === "pending") return <Pending kind="projects" />;
  if (state === "error" || !work) return <Unavailable kind="projects" />;
  const items = Array.isArray(work) ? work : [];
  if (items.length === 0) {
    return (
      <p className="kpi-state" data-testid="kpi-projects-empty">
        Проектных работ пока нет: как только задача будет назначена, она появится здесь вместе со
        статусом.
      </p>
    );
  }
  const groups: { key: string; title: string; items: WorkItemView[] }[] = [
    { key: "active", title: "В работе — входят в KPI «Проектов в работе»", items: items.filter((item) => ACTIVE_STATUSES.has(item.assignment.status)) },
    { key: "attention", title: "Требуют внимания", items: items.filter((item) => ATTENTION_STATUSES.has(item.assignment.status)) },
    { key: "history", title: "История — завершённые работы", items: items.filter((item) => HISTORY_STATUSES.has(item.assignment.status)) },
  ];
  return (
    <div className="kpi-body" data-testid="kpi-projects-body">
      {groups.map((group) => (
        <section className="kpi-track" key={group.key}>
          {group.items.length > 0 ? <h3>{group.title}</h3> : null}
          <ul>
            {group.items.map((item) => (
              <li key={item.assignment.id} data-testid={`kpi-item-${item.assignment.id}`}>
                <div>
                  <span>{item.task.title}</span>
                  <small data-testid={`kpi-status-${item.assignment.id}`}>
                    {ASSIGNMENT_STATUS_LABELS[item.assignment.status] ?? item.assignment.status}
                  </small>
                </div>
                {group.key === "history" ? (
                  <button
                    type="button"
                    className="kpi-link"
                    onClick={() => {
                      onOpenProject(item.assignment.id);
                    }}
                    data-testid={`kpi-open-project-${item.assignment.id}`}
                  >
                    Открыть проект
                  </button>
                ) : (
                  <small>дедлайн: {dayLabel(item.terms.deadline_at)}</small>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function VerifiedBody({
  state,
  anchors,
  certificates,
  evidenceRef,
}: {
  state: "pending" | "error" | "success";
  anchors?: EvidenceAnchorView[];
  certificates?: CourseCertificateView[];
  evidenceRef?: string | null;
}) {
  if (state === "pending") return <Pending kind="verified" />;
  if (state === "error" || !anchors || !certificates) return <Unavailable kind="verified" />;
  const anchorItems = Array.isArray(anchors) ? anchors : [];
  const certificateItems = Array.isArray(certificates) ? certificates : [];
  const counted = anchorItems.filter((anchor) => anchor.counted).length;
  return (
    <div className="kpi-body" data-testid="kpi-verified-body">
      <p className="kpi-note" data-testid="kpi-verified-total">
        Из {String(counted)} зафиксированных якорей навыка и {String(certificateItems.length)}{" "}
        сертификатов складывается число «Подтверждено»: {String(counted + certificateItems.length)}.
      </p>
      <section className="kpi-track">
        {anchorItems.length === 0 ? (
          <p className="kpi-state" data-testid="kpi-verified-empty-anchors">
            Подтверждённых фактов о навыках пока нет: якоря появляются из вкладов и checkpoints.
          </p>
        ) : (
          <ul>
            {anchorItems.map((anchor) => (
              <li
                key={`${anchor.competency_key}:${anchor.source_ref}`}
                data-testid={`kpi-anchor-${anchor.source_ref}`}
                data-kpi-evidence-current={anchor.source_ref === evidenceRef ? "true" : undefined}
                className={anchor.source_ref === evidenceRef ? "kpi-anchor--current" : undefined}
              >
                <div>
                  <span>
                    {EVIDENCE_KIND_LABELS[anchor.source_kind] ?? anchor.source_kind} · уровень{" "}
                    {anchor.level} · стоимость {anchor.competency_key}
                  </span>
                  <small>{anchor.reason}</small>
                  <small>
                    {dayLabel(anchor.observed_at)} · источник: {anchor.source_ref}
                  </small>
                </div>
                <small className={anchor.counted ? undefined : "kpi-anchor--outside"}>
                  {anchor.counted ? "входит в KPI" : "вне KPI"}
                </small>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="kpi-track">
        {certificateItems.length === 0 ? (
          <p className="kpi-state" data-testid="kpi-verified-empty-certificates">
            Сертификатов bootcamp пока нет: они появятся после финальной проверки курса.
          </p>
        ) : (
          <ul>
            {certificateItems.map((certificate) => (
              <li key={certificate.certificate_id} data-testid={`kpi-certificate-${certificate.certificate_id}`}>
                <div>
                  <span>
                    {certificate.course_title} · выпуск {certificate.period}
                  </span>
                  <small>
                    выдан {dayLabel(certificate.issued_at)} · {certificate.holder_name}
                  </small>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function KpiDetailsBody(props: {
  kpi: KpiKey;
  progressState: "pending" | "error" | "success";
  progress?: GrowthSnapshotView;
  projectsState: "pending" | "error" | "success";
  projects?: WorkItemView[];
  verifiedState: "pending" | "error" | "success";
  anchors?: EvidenceAnchorView[];
  certificates?: CourseCertificateView[];
  evidenceRef?: string | null;
  onOpenProject: (assignmentId: string) => void;
}) {
  if (props.kpi === "progress") {
    return <ProgressBody state={props.progressState} snapshot={props.progress} />;
  }
  if (props.kpi === "projects") {
    return (
      <ProjectsBody state={props.projectsState} work={props.projects} onOpenProject={props.onOpenProject} />
    );
  }
  return (
    <VerifiedBody
      state={props.verifiedState}
      anchors={props.anchors}
      certificates={props.certificates}
      evidenceRef={props.evidenceRef}
    />
  );
}
