import { Badge } from "../components/ui";

import {
  percentText,
  remainderText,
  formatVersionMeta,
  DEFAULT_COLOR_NAME,
  TRAJECTORY_MODE_LABELS,
  TRAJECTORY_VIEW_MODES,
  type SkillContour,
  type TrajectoryCard,
  type TrajectoryDetailFacts,
  type TrajectoryOverviewFacts,
  type TrajectoryViewMode,
} from "./trajectory-data";

interface ModeToggleProps {
  mode: TrajectoryViewMode;
  onChange: (mode: TrajectoryViewMode) => void;
}

const nextStepLabel = (ref: string | null): string =>
  ref === null ? "Следующий шаг определится по формуле этапов." : ref.replace(":", " · ");

export function TrajectoryModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div className="trajectory-toggle" role="group" aria-label="Режим представления направлений">
      {TRAJECTORY_VIEW_MODES.map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={mode === value}
          data-testid={`trajectory-view-${value}`}
          onClick={() => { onChange(value); }}
        >
          {TRAJECTORY_MODE_LABELS[value]}
        </button>
      ))}
    </div>
  );
}

function CardBody({ card }: { card: TrajectoryCard }) {
  return (
    <>
      <p className="trajectory-percent">
        <strong data-testid={`trajectory-percent-${card.slug}`}>{card.percentText}</strong>
        <span>{card.remainderText}</span>
        {card.partial && <span> · покрытие неполное ({String(card.coverage)})</span>}
      </p>
      <CycleBar percent={card.completionPercent} label={`trajectory-card-cycle-${card.slug}`} />
    </>
  );
}

function CardMeta({ card }: { card: TrajectoryCard }) {
  return (
    <p className="trajectory-meta">
      Готовность роли: {card.readinessPercentText} · подтверждено этапов: {String(card.completedCount)}
      {" из "}
      {String(card.totalMilestones)}
      {card.nextStepTitle !== null ? ` · следующий шаг: ${card.nextStepTitle}` : ""}
      {` · ${formatVersionMeta(card.version)} · цвет ${card.colorName}`}
    </p>
  );
}

function CardActions({ card, onOpen }: { card: TrajectoryCard; onOpen: (mode: "overview" | "detail") => void }) {
  return (
    <div className="trajectory-actions">
      <button type="button" data-testid={`trajectory-open-overview-${card.slug}`} onClick={() => { onOpen("overview"); }}>
        Обзор: {card.title}
      </button>
      <button type="button" data-testid={`trajectory-open-detail-${card.slug}`} onClick={() => { onOpen("detail"); }}>
        Подробнее
      </button>
    </div>
  );
}

interface BoardProps {
  mode: TrajectoryViewMode;
  cards: TrajectoryCard[];
  loading: boolean;
  onOpenTrack: (slug: string, pane: "overview" | "detail") => void;
}

export function TrajectoryBoard({ mode, cards, loading, onOpenTrack }: BoardProps) {
  if (loading) {
    return <p className="trajectory-state" data-testid="trajectory-loading">Загружаем направления…</p>;
  }
  if (cards.length === 0) {
    return (
      <p className="trajectory-state" data-testid="trajectory-empty">
        Направления появятся здесь после выбора. Данные о прогрессе недоступны без активных траекторий.
      </p>
    );
  }
  if (mode === "list") {
    return (
      <ol className="trajectory-list">
        {cards.map((card) => (
          <li key={card.slug} className={`trajectory-row ${card.colorClass}`} data-testid={`trajectory-row-${card.slug}`}>
            <div>
              <strong>{card.title}</strong>
              <CardBody card={card} />
              <CardMeta card={card} />
            </div>
            <CardActions card={card} onOpen={(pane) => { onOpenTrack(card.slug, pane); }} />
          </li>
        ))}
      </ol>
    );
  }
  return (
    <div className="trajectory-grid">
      {cards.map((card) => (
        <article key={card.slug} className={`trajectory-card ${card.colorClass}`} data-testid={`trajectory-card-${card.slug}`}>
          <header>
            <h3>
              {card.title}
              <span className="trajectory-slug">#{card.slug}</span>
            </h3>
          </header>
          <CardBody card={card} />
          <CardMeta card={card} />
          <CardActions card={card} onOpen={(pane) => { onOpenTrack(card.slug, pane); }} />
        </article>
      ))}
    </div>
  );
}

export function TrackOverviewBody({ facts }: { facts: TrajectoryOverviewFacts }) {
  return (
    <div className="trajectory-overview" data-testid="trajectory-overview-body">
      <p className="eyebrow">
        #{facts.slug} · цвет: {facts.colorName}
      </p>
      <section>
        <strong>Назначение этапов</strong>
        {facts.purpose.length > 0 ? (
          <ul>{facts.purpose.map((item, index) => <li key={`${facts.slug}-purpose-${String(index)}`}>{item}</li>)}</ul>
        ) : (
          <p>Этапы направления ещё не назначены.</p>
        )}
      </section>
      <p>
        <strong>Аудитория.</strong> {facts.audience}
      </p>
      <p>
        <strong>Результат.</strong> {facts.outcome}
      </p>
      <p>
        <strong>Навыки.</strong>{" "}
        {facts.skills.length > 0 ? facts.skills.join(" · ") : "Навыки направления ещё не определены."}
      </p>
      <section>
        <strong>Этапы направления</strong>
        {facts.stages.length > 0 ? (
          <ol className="trajectory-overview-stages">
            {facts.stages.map((stage) => (
              <li key={stage.key}>
                <strong>{stage.title}</strong>
                <span> {stage.purpose}</span>
                <small> · {stage.statusLabel}</small>
              </li>
            ))}
          </ol>
        ) : (
          <p>Этапы ещё внесены в план.</p>
        )}
      </section>
      <p>
        <strong>Правила evidence.</strong> {facts.evidenceRule}
      </p>
      <small className="trajectory-version-meta">{formatVersionMeta(facts.version)}</small>
    </div>
  );
}

function Contour({ contour, index }: { contour: SkillContour; index: number }) {
  return (
    <li data-testid={`trajectory-contour-${String(index)}`}>
      <span>
        {contour.title}: {contour.progressText}
        {contour.known && contour.currentLevel !== null && contour.targetLevel !== null && (
          <span className="trajectory-contour" aria-hidden="true">
            <i data-level="current">{contour.currentLevel}</i>
            <b data-level="target">{contour.targetLevel}</b>
          </span>
        )}
      </span>
      <small data-testid={`trajectory-contour-cycle-${String(index)}`}>{contour.cycleText}</small>
    </li>
  );
}

export function CycleBar({ percent, label }: { percent: number | null; label: string }) {
  const value = percent === null ? 0 : Math.max(0, Math.min(percent, 100));
  return (
    <div
      className="trajectory-cycle"
      data-testid={label}
      role="img"
      aria-label={`${label}: ${percentText(percent)}`}
    >
      <i aria-hidden="true" style={{ width: `${String(value)}%` }} />
      <strong>{percentText(percent)}</strong>
    </div>
  );
}

export function TrackDetailBody({ facts }: { facts: TrajectoryDetailFacts }) {
  return (
    <div className="trajectory-detail" data-testid="trajectory-detail-body">
      <p className="trajectory-percent">
        <strong data-testid="trajectory-detail-percent">{facts.percentText}</strong>
        <span>{facts.remainderText}</span>
        {facts.partial && <span> · покрытие неполное</span>}
        <span> · готовность роли: {facts.readinessPercentText}</span>
      </p>
      <div className="trajectory-cycles">
        <CycleBar percent={facts.completionPercent} label="cycle-completion" />
        <CycleBar percent={facts.readinessPercent} label="cycle-readiness" />
        <small>{facts.readinessCycleText}</small>
      </div>
      {facts.planChange && (
        <p data-testid="trajectory-plan-change">
          <strong>План обновлён.</strong> {facts.planChange} Подтверждённые milestones сохранены и
          пересчитаны по новой версии без потери прогресса.
        </p>
      )}
      <p className="trajectory-formula" data-testid="trajectory-formula">
        {facts.formulaText}
      </p>
      <section>
        <strong>Current/target циклограмма</strong>
        {facts.contours.length > 0 ? (
          <ul data-testid="trajectory-contours" className="trajectory-contours">
            {facts.contours.map((contour, index) => (
              <Contour contour={contour} index={index} key={`${facts.slug}-${contour.title}`} />
            ))}
          </ul>
        ) : (
          <p data-testid="trajectory-contours-unavailable">Данные уровней навыков недоступны.</p>
        )}
      </section>
      <section>
        <strong>Календарь активности</strong>
        {facts.calendar.length > 0 ? (
          <ul data-testid="trajectory-calendar">
            {facts.calendar.map((day) => (
              <li data-testid={`trajectory-day-${day.day}`} key={day.day}>
                <strong>{day.label}</strong>
                <span>
                  {String(day.count)} · {day.kindsLabel}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p data-testid="trajectory-calendar-empty">Квалифицированных событий за период нет.</p>
        )}
        <dl data-testid="trajectory-days">
          <div>
            <dt>Дни с квалифицированной активностью</dt>
            <dd>{String(facts.days.qualifiedDays)}</dd>
          </div>
          <div>
            <dt>Дни без активности (в периоде 14 дней)</dt>
            <dd>{String(facts.days.quietDays)}</dd>
          </div>
          <div>
            <dt>Сегодня (по {Intl.DateTimeFormat().resolvedOptions().timeZone})</dt>
            <dd>{facts.days.todayKey}</dd>
          </div>
        </dl>
        <small>{facts.days.note}</small>
      </section>
      <section data-testid="trajectory-hours">
        <strong>Часы</strong>
        {facts.hoursKnown ? (
          <dl>
            <div>
              <dt>Подтверждённые часы</dt>
              <dd>{facts.trustedHoursText ?? "—"}</dd>
            </div>
            <div>
              <dt>Самоотчёты (не подтверждены)</dt>
              <dd>{facts.selfReportedHoursText ?? "—"}</dd>
            </div>
            <div>
              <dt>Интервалы в снапшоте</dt>
              <dd>{String(facts.intervalsCount)}</dd>
            </div>
          </dl>
        ) : (
          <p>Часы пока не подтверждены: данные появляются после доверенных интервалов.</p>
        )}
      </section>
      <section>
        <strong>Связанные доказательства</strong>
        {facts.evidence.length > 0 ? (
          <ul data-testid="trajectory-evidence">
            {facts.evidence.map((item) => (
              <li data-testid={`trajectory-evidence-${item.key}`} key={item.key}>
                <strong>
                  {item.label}: {item.level}
                </strong>
                <span>
                  {" "}
                  {item.countedLabel} · {item.title}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p data-testid="trajectory-evidence-empty">Доказательства для этого направления ещё не добавлены.</p>
        )}
      </section>
      <p data-testid="trajectory-next-step">
        <strong>Следующий шаг.</strong> {nextStepLabel(facts.nextStepRef)}
      </p>
    </div>
  );
}

interface PercentBadgeProps {
  percent: number | null;
}

export function PercentValue({ percent }: PercentBadgeProps) {
  return <Badge tone={percent === null || percent < 34 ? "warning" : "success"}>{percentText(percent)}</Badge>;
}

export function RemainderText({ percent }: PercentBadgeProps) {
  return <span>{remainderText(percent)}</span>;
}

export function ColorNameText({ colorName }: { colorName: string | undefined }) {
  return <span className="trajectory-color-name">{colorName ?? DEFAULT_COLOR_NAME}</span>;
}
