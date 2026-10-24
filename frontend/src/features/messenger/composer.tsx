import { AtSign, Paperclip, Send, Smile } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

import {
  getDialogDraftsSnapshot,
  hydrateDialogDrafts,
  setDialogDraft,
  subscribeDialogDrafts,
} from "./drafts";
import {
  COMPOSER_EMOJIS,
  type ComposerConnectionState,
  type ComposerSendPayload,
  type ComposerSendState,
  validateArtifactRef,
} from "./composer-model";
import type { ApiParticipantView, KeyValueStorage } from "./view-model";
import "./composer.scss";

export type ComposerProps = {
  channelId: string;
  participants: readonly ApiParticipantView[];
  storage: KeyValueStorage;
  canSend: boolean;
  sending: boolean;
  sendState: ComposerSendState;
  connectionState: ComposerConnectionState;
  replySummary?: { id: string; summary: string } | null;
  onSend: (payload: ComposerSendPayload) => void;
  onClearReply?: () => void;
  className?: string;
};

function mentionNames(participants: readonly ApiParticipantView[]): string[] {
  const names: string[] = [];
  for (const person of participants) {
    const name = person.display_name.trim();
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

export function Composer({
  channelId,
  participants,
  storage,
  canSend,
  sending,
  sendState,
  connectionState,
  replySummary = null,
  onSend,
  onClearReply,
  className,
}: ComposerProps) {
  const drafts = useSyncExternalStore(subscribeDialogDrafts, getDialogDraftsSnapshot);
  const draft = drafts[channelId] ?? "";
  const [refs, setRefs] = useState<string[]>([]);
  const [refInput, setRefInput] = useState("");
  const [refError, setRefError] = useState("");
  const [refsOpen, setRefsOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const wasSendingRef = useRef(false);

  useEffect(() => {
    hydrateDialogDrafts(storage, true);
  }, [storage]);

  useEffect(() => {
    setRefs([]);
    setRefInput("");
    setRefError("");
    setRefsOpen(false);
    setEmojiOpen(false);
    setMentionQuery(null);
  }, [channelId]);

  useEffect(() => {
    if (sendState === "sending") {
      wasSendingRef.current = true;
      return;
    }
    if (!wasSendingRef.current) return;
    wasSendingRef.current = false;
    if (sendState === "idle") {
      setDialogDraft(storage, channelId, "");
      setRefs([]);
      setRefInput("");
      setRefsOpen(false);
      setEmojiOpen(false);
    }
  }, [channelId, sendState, storage]);

  const mentionCandidates = useMemo(() => {
    if (mentionQuery === null) return [];
    const query = mentionQuery.toLowerCase();
    return mentionNames(participants).filter((name) =>
      name.toLowerCase().includes(query),
    );
  }, [mentionQuery, participants]);

  const sendDisabled = (
    !canSend
    || sending
    || sendState === "sending"
    || connectionState !== "online"
    || draft.trim().length === 0
  );

  const updateDraft = (next: string) => {
    setDialogDraft(storage, channelId, next);
    const caret = textareaRef.current?.selectionStart ?? next.length;
    const upToCaret = next.slice(0, caret);
    const match = /@([^\s@]*)$/u.exec(upToCaret);
    if (match && typeof match[1] === "string") {
      setMentionQuery(match[1]);
    } else {
      setMentionQuery(null);
    }
  };

  const insertAtCaret = (snippet: string) => {
    const area = textareaRef.current;
    const caret = area?.selectionStart ?? draft.length;
    const next = `${draft.slice(0, caret)}${snippet}${draft.slice(caret)}`;
    setDialogDraft(storage, channelId, next);
    const restorableCaret = caret + snippet.length;
    requestAnimationFrame(() => {
      const fresh = textareaRef.current;
      if (!fresh) return;
      fresh.focus();
      fresh.setSelectionRange(restorableCaret, restorableCaret);
    });
  };

  const applyMention = (name: string) => {
    const area = textareaRef.current;
    const caret = area?.selectionStart ?? draft.length;
    const before = draft.slice(0, caret);
    const startIndex = before.lastIndexOf("@");
    if (startIndex === -1) {
      insertAtCaret(`@${name} `);
      return;
    }
    const next = `${draft.slice(0, startIndex)}@${name} ${draft.slice(caret)}`;
    setDialogDraft(storage, channelId, next);
    const restorableCaret = startIndex + name.length + 2;
    requestAnimationFrame(() => {
      const fresh = textareaRef.current;
      if (!fresh) return;
      fresh.focus();
      fresh.setSelectionRange(restorableCaret, restorableCaret);
    });
    setMentionQuery(null);
  };

  const submit = () => {
    if (sendDisabled) return;
    onSend({ body: draft.trim(), artifact_refs: [...refs] });
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionCandidates.length > 0 && event.key === "Enter") {
      event.preventDefault();
      const first = mentionCandidates[0];
      if (typeof first === "string") applyMention(first);
      return;
    }
    if (mentionCandidates.length > 0 && event.key === "Escape") {
      event.preventDefault();
      setMentionQuery(null);
      return;
    }
    if (event.key !== "Enter") return;
    if (event.shiftKey) return;
    event.preventDefault();
    submit();
  };

  const addRef = () => {
    const problem = validateArtifactRef(refInput, refs);
    if (problem) {
      setRefError(problem);
      return;
    }
    setRefs((current) => [...current, refInput.trim()]);
    setRefInput("");
    setRefError("");
  };

  const composerClasses = [
    "msg-composer",
    connectionState !== "online" ? "msg-composer--offline" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  if (!canSend) {
    return (
      <div className={composerClasses} role="region" aria-label="Композер сообщения">
        <p className="msg-composer__notice" data-testid="composer-readonly">
          Отправка недоступна: у вас отозвано право писать в этот чат.
          История сообщений сохранена.
        </p>
      </div>
    );
  }

  return (
    <div className={composerClasses} role="region" aria-label="Композер сообщения">
      {replySummary !== null && (
        <div className="msg-composer__banner msg-composer__banner--reply">
          <span>
            Ответ на: {replySummary.summary}
          </span>
          <button
            type="button"
            className="msg-composer__chip-action"
            onClick={() => {
              onClearReply?.();
            }}
          >
            Отменить ответ
          </button>
        </div>
      )}
      {connectionState !== "online" && (
        <p className="msg-composer__banner msg-composer__banner--offline" data-testid="composer-offline">
          Нет соединения — отправка приостановлена. Текст сохранён в черновике
          и будет готов, когда связь восстановится.
        </p>
      )}
      <form
        className="msg-composer__fieldset"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="msg-composer__tools">
          <button
            type="button"
            className="msg-composer__tool"
            aria-expanded={emojiOpen}
            aria-label="Эмодзи"
            onClick={(event) => {
              event.preventDefault();
              setEmojiOpen((current) => !current);
            }}
          >
            <Smile aria-hidden="true" size={19} />
          </button>
          <button
            type="button"
            className="msg-composer__tool"
            aria-expanded={refsOpen}
            aria-label="Вложения"
            onClick={(event) => {
              event.preventDefault();
              setRefsOpen((current) => !current);
            }}
          >
            <Paperclip aria-hidden="true" size={19} />
          </button>
          <button
            type="button"
            className="msg-composer__mention-hint"
            aria-label="Упомянуть участника"
            title="Упомянуть участника"
            onClick={() => insertAtCaret("@")}
          >
            <AtSign aria-hidden="true" size={19} />
          </button>
        </div>
        <div className="msg-composer__input-shell">
          {mentionCandidates.length > 0 && (
            <ul
              className="msg-composer__mentions"
              role="listbox"
              aria-label="Упоминания"
              data-testid="composer-mentions"
            >
              {mentionCandidates.map((name) => (
                <li key={name}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={(event) => {
                      event.preventDefault();
                      applyMention(name);
                    }}
                  >
                    @{name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <label className="msg-composer__sr-only" htmlFor={`composer-draft-${channelId}`}>
            Текст сообщения
          </label>
          <textarea
            id={`composer-draft-${channelId}`}
            ref={textareaRef}
            value={draft}
            onChange={(event) => {
              updateDraft(event.target.value);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Напишите сообщение…"
            title="Enter — отправить, Shift+Enter — новая строка, @ — упоминание"
            className="msg-composer__textarea"
            data-testid="composer-textarea"
          />
        </div>
        <button
          type="submit"
          className="msg-composer__send"
          disabled={sendDisabled}
          data-testid="composer-send"
        >
          <Send aria-hidden="true" size={19} />
          <span className="msg-composer__send-label">{sendState === "sending" ? "Отправляем…" : "Отправить"}</span>
        </button>
      </form>
      {emojiOpen && (
        <div className="msg-composer__panel" role="dialog" aria-label="Эмодзи" data-testid="composer-emoji">
          {COMPOSER_EMOJIS.map((emoji) => (
            <button
              type="button"
              key={emoji}
              className="msg-composer__emoji"
              aria-label={`Вставить ${emoji}`}
              onClick={(event) => {
                event.preventDefault();
                insertAtCaret(emoji);
                setEmojiOpen(false);
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
      {refsOpen && (
        <div className="msg-composer__panel msg-composer__panel--refs" data-testid="composer-attachments">
          <label className="msg-composer__sr-only" htmlFor={`composer-ref-${channelId}`}>
            Ключ артефакта
          </label>
          <input
            id={`composer-ref-${channelId}`}
            value={refInput}
            onChange={(event) => {
              setRefInput(event.target.value);
            }}
            placeholder="Например: repository или artifact:mvp"
            className="msg-composer__ref-input"
            data-testid="composer-ref-input"
          />
          <button
            type="button"
            className="msg-composer__tool"
            onClick={(event) => {
              event.preventDefault();
              addRef();
            }}
          >
            Добавить
          </button>
          {refError && (
            <p className="msg-composer__ref-error" role="alert" data-testid="composer-ref-error">
              {refError}
            </p>
          )}
        </div>
      )}
      {refs.length > 0 && (
        <ul className="msg-composer__refs" data-testid="composer-ref-list">
          {refs.map((ref) => (
            <li key={ref}>
              <button
                type="button"
                className="msg-composer__chip"
                aria-label={`Убрать вложение ${ref}`}
                onClick={(event) => {
                  event.preventDefault();
                  setRefs((current) => current.filter((item) => item !== ref));
                }}
              >
                {ref} ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      {sendState === "failed" && (
        <p className="msg-composer__notice msg-composer__notice--error" role="alert" data-testid="composer-failed">
          Не удалось отправить сообщение. Черновик сохранён — исправьте текст
          или повторите отправку.
        </p>
      )}
    </div>
  );
}
