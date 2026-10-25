import { Bell, BellOff, FileText, Link2, Users, X } from "lucide-react";
import { useState } from "react";
import type { ApiChannelView, ApiMessageView } from "./contracts";
import type { DirectoryContact } from "./group-creator";
import { CommunityDetails } from "./community-details";
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
  onToggleMute?: () => void;
  messageRefs?: string[];
  messages?: readonly ApiMessageView[];
  contacts?: readonly DirectoryContact[];
  onOpenMember?: (personId: string) => Promise<void>;
  onInvite?: (personIds: string[]) => Promise<void>;
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
  onToggleMute,
  messageRefs = [],
  messages = [],
  contacts = [],
  onOpenMember,
  onInvite,
  className,
}: ContextPanelProps) {
  const [copyStatus, setCopyStatus] = useState<"ready" | "copied" | "unavailable">("ready");
  const [showAllPeople, setShowAllPeople] = useState(false);
  if (!open) return null;
  const classes = ["msg-context", "chat-context", className ?? ""].filter(Boolean).join(" ");
  const roleInChannel = viewerId
    ? channel.participants.find((person) => person.id === viewerId)?.role ?? null
    : null;
  const isChannelTeam = channel.task_id !== null;
  const isCommunity = channel.kind === "community";
  const moderators = channel.participants.filter((person) => ["owner", "admin", "moderator"].includes(person.role));
  const visiblePeople = showAllPeople ? channel.participants : channel.participants.slice(0, 4);
  if (isCommunity) {
    return <CommunityDetails key={channel.id} channel={channel} viewerId={viewerId}
      messages={messages} attachmentRefs={messageRefs} contacts={contacts}
      onClose={onClose} onToggleMute={onToggleMute}
      onOpenMember={onOpenMember} onInvite={onInvite} />;
  }
  return (
    <aside className={classes} id="messenger-context-panel" aria-label="Контекст диалога">
      {onClose !== undefined && (
        <button type="button" className="msg-context__close" onClick={onClose}>
          <X size={19} aria-hidden="true" />
          <span className="sr-only">К чату</span>
        </button>
      )}
      <p className="msg-context__eyebrow">Контекст</p>
      <div className="msg-context__profile">
        <span className="msg-context__avatar" aria-hidden="true">
          {channel.title.trim().toLowerCase() === "маяки"
            ? <img src="/messages-reference/mayaki-avatar.svg" alt="" />
            : (dialogTitle(channel, viewerId).trim()[0] ?? "Ч").toUpperCase()}
        </span>
        <div className="msg-context__identity">
          <h2 className="msg-context__title">{dialogTitle(channel, viewerId)}</h2>
          <span className={`msg-context__badge${channel.muted ? " msg-context__badge--muted" : ""}`}>
            {dialogKindLabel(channel.kind)}
          </span>
          {roleInChannel !== null && (
            <span className="msg-context__role" data-testid="context-your-role">
              ваша роль: {participantRoleLabel(roleInChannel)}
            </span>
          )}
        </div>
        <span className="msg-context__online" role="status">{channel.status === "active" ? "● Активен" : "Закрыт"}</span>
      </div>
      {channel.kind === "community" && channel.title.trim().toLowerCase() === "маяки" && (
        <p className="msg-context__description">
          Сообщество студентов, которые развиваются, создают проекты и находят возможности вместе.
          Маяки — это люди, идеи и движение вперёд.
        </p>
      )}
      <section className="msg-context__section msg-context__about" aria-label="О чате">
        <h3 className="msg-context__section-title">{channel.kind === "community" ? "О сообществе" : "О чате"}</h3>
      <dl className="msg-context__facts">
        <div><dt>Тип чата</dt><dd>{dialogKindLabel(channel.kind)}</dd></div>
        <div><dt>Создан</dt><dd>{new Intl.DateTimeFormat("ru-RU", {day:"numeric",month:"long",year:"numeric"}).format(new Date(channel.created_at))}</dd></div>
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
      </section>
      <section className="msg-context__section" aria-label="Задача">
        <h3 className="msg-context__section-title">Связанные объекты</h3>

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
      <section className="msg-context__section msg-context__files" aria-label="Связанные файлы">
        <h3 className="msg-context__section-title"><FileText size={17}/>Связанные файлы <span>{String(messageRefs.length)}</span></h3>
        {messageRefs.length === 0 ? (
          <p className="msg-context__no-files">В этом диалоге ещё нет прикреплённых файлов</p>
        ) : (
          <ul className="msg-context__file-list">
            {Array.from(new Set(messageRefs)).map((ref) => (
              <li key={ref}>
                <FileText size={20} aria-hidden="true"/>
                <span title={ref}>{ref.split("/").pop() || ref}</span>
                <button type="button" aria-label={`Скопировать ссылку или идентификатор файла ${ref.split("/").pop() || ref}`} onClick={() => {
                  void (async () => {
                    try {
                      await navigator.clipboard.writeText(ref);
                      setCopyStatus("copied");
                    } catch {
                      setCopyStatus("unavailable");
                    }
                  })();
                }}><Link2 size={16}/></button>
              </li>
            ))}
          </ul>
        )}
        <p role="status" aria-live="polite" className="msg-context__copy-status">
          {copyStatus === "copied" ? "Ссылка или идентификатор скопированы" : copyStatus === "unavailable" ? "Не удалось скопировать. Выберите текст файла вручную." : ""}
        </p>
      </section>
      {isCommunity && (
        <section className="msg-context__section msg-context__moderators" aria-label="Администраторы и модераторы">
          <h3 className="msg-context__section-title">Администраторы и модераторы <span>{String(moderators.length)}</span></h3>
          {moderators.length === 0 ? (
            <p className="msg-context__no-files">Модераторы в списке участников не указаны</p>
          ) : (
            <ul className="msg-context__people">
              {moderators.slice(0,3).map((person) => (
                <li key={person.id}>
                  <span>{person.display_name || "Без имени"}</span>
                  <small>{participantRoleLabel(person.role)}</small>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {isCommunity && (
        <section className="msg-context__section msg-context__materials" aria-label="Полезные материалы">
          <h3 className="msg-context__section-title">Полезные материалы <span>{String(new Set(messageRefs).size)}</span></h3>
          {messageRefs.length === 0 ? (
            <p className="msg-context__no-files">Материалы появятся после публикации сообщений с вложениями</p>
          ) : <p className="msg-context__no-files">Вложения сообщества перечислены выше в разделе «Связанные файлы»</p>}
        </section>
      )}
      <section className="msg-context__section" aria-label="Участники">
        <h3 className="msg-context__section-title"><Users size={17}/>Участники <span>{String(channel.participants.length)}</span>
        {channel.participants.length > 4 && <button className="msg-context__show-all" type="button" onClick={() => { setShowAllPeople((value) => !value); }}>{showAllPeople ? "Свернуть" : "Все"}</button>}</h3>
        <ul className="msg-context__people">
          {visiblePeople.map((person) => (
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
      {onToggleMute && (
        <button type="button" className="msg-context__notification-action" onClick={onToggleMute}>
          {channel.muted ? <Bell size={17}/> : <BellOff size={17}/>}
          {channel.muted ? "Включить уведомления" : "Отключить уведомления"}
        </button>
      )}
      <small className="msg-context__disclaimer" data-testid="context-disclaimer">
        Сообщения не изменяют официальные статусы: формальные приёмка вклада,
        оценка, выплата и оффер выполняются только в доменных экранах.
      </small>
    </aside>
  );
}
