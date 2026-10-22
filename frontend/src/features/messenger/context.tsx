import type { ApiChannelView } from "./contracts";
import {
  type ChannelWorkContextView,
  contextDateLabel,
  contributionLabel,
  reviewStatusLabel,
} from "./context-model";
import { dialogTitle, dialogKindLabel, participantRoleLabel } from "./view-model";
import "./context.scss";

export type ContextPanelProps = {
  channel: ApiChannelView;
  viewerId: string | null;
  workContext?: ChannelWorkContextView;
  open: boolean;
  onOpenTask?: (taskId: string) => void;
  onOpenMeeting?: () => void;
  onOpenReview?: () => void;
  onClose?: () => void;
  className?: string;
};

export function ContextPanel({
  channel,
  viewerId,
  workContext = null,
  open,
  onOpenTask,
  onOpenMeeting,
  onOpenReview,
  onClose,
  className,
}: ContextPanelProps) {
  if (!open) return null;
  const classes = ["msg-context", "chat-context", className ?? ""].filter(Boolean).join(" ");
  const roleInChannel = viewerId
    ? channel.participants.find((person) => person.id === viewerId)?.role ?? null
    : null;
  const isChannelTeam = channel.task_id !== null;
  return (
    <aside className={classes} id="messenger-context-panel" aria-label="Контекст диалога">
      {onClose !== undefined && (
        <button type="button" className="msg-context__close" onClick={onClose}>
          ←
          <span className="sr-only">К чату</span>
        </button>
      )}
      <p className="msg-context__eyebrow">Контекст</p>
      <h2 className="msg-context__title">{dialogTitle(channel, viewerId)}</h2>
      <span className={`msg-context__badge${channel.muted ? " msg-context__badge--muted" : ""}`}>
        {dialogKindLabel(channel.kind)}
      </span>
      {roleInChannel !== null && (
        <span className="msg-context__role" data-testid="context-your-role">
          ваша роль: {participantRoleLabel(roleInChannel)}
        </span>
      )}
      <dl className="msg-context__facts">
        <div>
          <dt>Непрочитанных</dt>
          <dd>{String(channel.unread)}</dd>
        </div>
        <div>
          <dt>Статус</dt>
          <dd>{channel.status === "active" ? "активен" : "закрыт"}</dd>
        </div>
        <div>
          <dt>Участников</dt>
          <dd>{String(channel.participants.length)}</dd>
        </div>
      </dl>
      <section className="msg-context__section" aria-label="Задача">
        <h3 className="msg-context__section-title">Задача</h3>
        <dl className="msg-context__facts">
          <div>
            <dt>Проект</dt>
            <dd data-testid="context-project">{workContext?.project_key ?? "не выбран"}</dd>
          </div>
          <div>
            <dt>Задача</dt>
            <dd data-testid="context-task">{workContext?.task_title ?? "не привязана"}</dd>
          </div>
          <div>
            <dt>Контрольная точка (дедлайн)</dt>
            <dd data-testid="context-deadline">{contextDateLabel(workContext?.deadline_at ?? null)}</dd>
          </div>
        </dl>
        {workContext !== null && (
          <dl className="msg-context__facts">
            <div>
              <dt>Вклад</dt>
              <dd data-testid="context-contribution">{contributionLabel(workContext)}</dd>
            </div>
            <div>
              <dt>Оценка</dt>
              <dd data-testid="context-review">{reviewStatusLabel(workContext.review_status)}</dd>
            </div>
          </dl>
        )}
      </section>
      <section className="msg-context__section" aria-label="Участники">
        <h3 className="msg-context__section-title">Участники</h3>
        <ul className="msg-context__people">
          {channel.participants.map((person) => (
            <li key={person.id} data-testid="context-participant">
              <span>{person.display_name || "Без имени"}</span>
              <small> · {participantRoleLabel(person.role)}</small>
            </li>
          ))}
        </ul>
      </section>
      {isChannelTeam && (
        <div className="msg-context__actions">
          {channel.task_id !== null && onOpenTask !== undefined && (
            <button
              type="button"
              className="msg-context__action"
              onClick={() => {
                const taskId = channel.task_id;
                if (taskId !== null) onOpenTask(taskId);
              }}
            >
              Открыть вклад задачи
            </button>
          )}
          {onOpenMeeting !== undefined && (
            <button type="button" className="msg-context__action" onClick={onOpenMeeting}>
              Запланировать встречу
            </button>
          )}
          {onOpenReview !== undefined && (
            <button type="button" className="msg-context__action" onClick={onOpenReview}>
              Открыть workspace оценки
            </button>
          )}
        </div>
      )}
      <small className="msg-context__disclaimer" data-testid="context-disclaimer">
        Сообщения не изменяют официальные статусы: формальные приёмка вклада,
        оценка, выплата и оффер выполняются только в доменных экранах.
      </small>
    </aside>
  );
}
