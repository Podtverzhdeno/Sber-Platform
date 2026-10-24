import type { ApiChannelView } from "./contracts";
import { referenceDescriptions } from "./reference-fixtures";
import { referenceAvatarFor, referenceAvatarSpriteIndexFor } from "./reference-avatars";
import { FileText, FolderOpen, Link2, Users } from "lucide-react";
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
  isReferencePreview?: boolean;
  sharedFiles?: readonly string[];
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
  isReferencePreview = false,
  sharedFiles = [],
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
  const isCommunity = channel.kind === "community";
  const description = isReferencePreview ? referenceDescriptions[channel.id] : undefined;
  return (
    <aside className={classes} id="messenger-context-panel" aria-label="Контекст диалога">
      {onClose !== undefined && (
        <button type="button" className="msg-context__close" onClick={onClose}>
          ←
          <span className="sr-only">К чату</span>
        </button>
      )}
      <div className="msg-context__heading">
        <p className="msg-context__eyebrow">Контекст</p>
      </div>
      <div className="msg-context__profile">
        <span
          className="msg-context__avatar"
          aria-hidden="true"
          data-reference-tone={referenceAvatarFor(channel.id)?.tone}
          data-reference-index={referenceAvatarSpriteIndexFor(channel.id) ?? undefined}
        >
          {referenceAvatarFor(channel.id)?.glyph ?? (dialogTitle(channel, viewerId).trim().charAt(0).toUpperCase() || "?")}
        </span>
        <div className="msg-context__profile-copy">
          <h2 className="msg-context__title">{dialogTitle(channel, viewerId)}</h2>
          <span className={`msg-context__badge${channel.muted ? " msg-context__badge--muted" : ""}`}>
            {dialogKindLabel(channel.kind)}
          </span>
          {roleInChannel !== null && (
            <span className="msg-context__role" data-testid="context-your-role">
              ваша роль: {participantRoleLabel(roleInChannel)}
            </span>
          )}
          {isReferencePreview && (
            <span className="msg-context__reference-online"><span aria-hidden="true" />В сети</span>
          )}
        </div>
      </div>
      {description && <p className="msg-context__description">{description}</p>}
      {isReferencePreview && !isCommunity && (
        <div className="msg-context__intro-actions">
          <button type="button" disabled title="Профиль доступен после подключения соответствующего API">Профиль</button>
          <span>Демо</span>
        </div>
      )}
            {isCommunity && isReferencePreview && (
        <div className="msg-context__intro-actions">
          <button type="button" disabled title="Приглашения доступны после подключения API сообщества"><Users size={17} /> Пригласить участников</button>
          <span>Демо</span>
        </div>
      )}
      <h3 className="msg-context__about-heading">{isCommunity ? "О сообществе" : "О чате"}</h3>
      <dl className="msg-context__facts">
        {isReferencePreview ? (
          <>
            <div><dt>Тип</dt><dd>{isCommunity ? "Сообщество" : "Личный чат"}</dd></div>
            <div><dt>Участников</dt><dd>{isCommunity ? "248" : "2"}</dd></div>
            <div><dt>Создано</dt><dd>{isCommunity ? "12 марта 2024" : "20 октября 2026"}</dd></div>
            <div><dt>{isCommunity ? "Ссылка" : "Уведомления"}</dt><dd>{isCommunity ? "t.me/impulse_mayaki" : "Включены"}</dd></div>
          </>
        ) : (
          <>
            <div><dt>Непрочитанных</dt><dd>{String(channel.unread)}</dd></div>
            <div><dt>Статус</dt><dd>{channel.status === "active" ? "активен" : "закрыт"}</dd></div>
            <div><dt>Участников</dt><dd>{String(channel.participants.length)}</dd></div>
          </>
        )}
      </dl>
      {!isCommunity && (channel.task_id !== null || workContext !== null) && (
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
      )}
      {isCommunity && isReferencePreview && (
        <section className="msg-context__section ref-context-community" aria-label="Администраторы и модераторы">
          <h3 className="msg-context__section-title">Администраторы и модераторы</h3>
          <ul>
            {["Анна Ковалева · Администратор", "Иван Петров · Модератор", "Мария Лебедева · Модератор"].map((name)=>(
              <li key={name}><span className="ref-context-user-icon">{name.charAt(0)}</span><span>{name}</span></li>
            ))}
          </ul>
        </section>
      )}
      <section className="msg-context__section ref-context-linked" aria-label="Связанные объекты">
        <h3 className="msg-context__section-title">Связанные объекты</h3>
        {workContext?.task_title ? (
          <button type="button" onClick={()=> {if(channel.task_id) onOpenTask?.(channel.task_id);}} disabled={!channel.task_id || !onOpenTask}>
            <FolderOpen size={17} aria-hidden="true" />
            <span><small>Задача</small><strong>{workContext.task_title}</strong></span>
          </button>
        ) : isReferencePreview && channel.id === "reference:mentor" ? (
          <div className="ref-context-linked__preview">
            <div className="ref-context-linked__item">
              <FolderOpen size={17} aria-hidden="true" />
              <span><small>Проект · пример</small><strong>Эксперимент с рекомендателем</strong></span>
            </div>
            <div className="ref-context-linked__item">
              <FileText size={17} aria-hidden="true" />
              <span><small>Задача · пример</small><strong>Анализ метрик эксперимента</strong></span>
            </div>
          </div>
        ) : <p className="ref-context-placeholder-text">Связанные объекты пока отсутствуют</p>}
      </section>
      {isCommunity && isReferencePreview && (
        <section className="msg-context__section ref-context-resources" aria-label="Полезные материалы">
          <h3 className="msg-context__section-title">Полезные материалы</h3>
          {["Календарь мероприятий", "Возможности для студентов", "Гайд: как попасть на стажировку", "Записи прошедших встреч"].map((name)=>(
            <div className="ref-context-resource" key={name}><Link2 size={17} aria-hidden="true" /><span>{name}</span></div>
          ))}
        </section>
      )}
      <section className="msg-context__section ref-context-files" aria-label="Связанные файлы">
        <h3 className="msg-context__section-title">Связанные файлы {sharedFiles.length > 0 && <small>{sharedFiles.length}</small>}</h3>
        {sharedFiles.length ? (
          <ul>
            {sharedFiles.map((file)=> <li key={file}><FileText aria-hidden="true" size={18}/><span title={file}>{file}</span></li>)}
          </ul>
        ) : <p className="ref-context-placeholder-text">Общих файлов пока нет</p>}
      </section>
      <section className="msg-context__section" aria-label="Участники">
        <h3 className="msg-context__section-title">Участники</h3>
        <ul className="msg-context__people">
          {channel.participants.map((person) => (
            <li key={person.id} data-testid="context-participant">
              <span className="msg-context__member-avatar" aria-hidden="true">
                {person.display_name.trim().charAt(0).toUpperCase() || "?"}
              </span>
              <span className="msg-context__member-copy">
                <span>{person.display_name || "Без имени"}</span>
                <small> · {participantRoleLabel(person.role)}</small>
              </span>
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
