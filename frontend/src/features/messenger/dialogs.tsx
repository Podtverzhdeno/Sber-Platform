import {
  ArchiveRestore,
  ArchiveX,
  AtSign,
  BellOff,
  Pin,
  PinOff,
  Plus,
  Search,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import type { ApiChannelView } from "./contracts";
import {
  getDialogDraftsSnapshot,
  hydrateDialogDrafts,
  subscribeDialogDrafts,
} from "./drafts";
import {
  DIALOG_TABS,
  contactsOfChannels,
  deriveDialogRows,
  readDialogPrefs,
  readDialogScroll,
  setDialogPref,
  visibleDialogRows,
  writeDialogScroll,
  type KeyValueStorage,
} from "./view-model";
import { DialogAvatar } from "./dialog-avatar";
import { GroupCreator, type DirectoryContact } from "./group-creator";
import "./dialogs.scss";

const windowStorage = (): KeyValueStorage => window.localStorage;

export type DialogListProps = {
  channels: readonly ApiChannelView[];
  directoryContacts?: readonly DirectoryContact[];
  onCreateGroup?: (title: string, ids: string[]) => Promise<void>;
  actionError?: string;
  viewerId: string | null;
  viewerName?: string | null;
  selectedId: string | null;
  createSignal?: number;
  findSignal?: number;
  onSelect: (channelId: string) => void;
  onCreateDialog?: (peerId: string) => Promise<void> | void;
  /** Test seam: deterministic dm state in jsdom. */
  storage?: KeyValueStorage;
  className?: string;
};

export function DialogList({
  channels,
  directoryContacts = [],
  onCreateGroup,
  actionError = "",
  viewerId,
  viewerName = null,
  selectedId,
  createSignal = 0,
  findSignal = 0,
  onSelect,
  onCreateDialog,
  storage = windowStorage(),
  className,
}: DialogListProps) {
  const [tab, setTab] = useState<"Все" | "Архив" | "Контакты">("Все");
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [prefs, setPrefsState] = useState(() => readDialogPrefs(storage));
  const drafts = useSyncExternalStore(
    subscribeDialogDrafts,
    getDialogDraftsSnapshot,
    getDialogDraftsSnapshot,
  );
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const handledCreateSignal = useRef(0);
  const previousSelectedId = useRef(selectedId);

  useEffect(() => {
    hydrateDialogDrafts(storage, true);
    if (scrollRef.current) {
      scrollRef.current.scrollTop = readDialogScroll(storage);
    }
    // Restore fires once per mount (Back / reload path); storage identity is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(
    () =>
      deriveDialogRows({
        channels,
        viewerId,
        viewerName,
        selectedId,
        prefs,
        drafts,
      }),
    [channels, viewerId, viewerName, selectedId, prefs, drafts],
  );
  const visible = useMemo(
    () => visibleDialogRows(rows, tab, query),
    [rows, tab, query],
  );
  const contacts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const mapped = new Map(contactsOfChannels(channels, viewerId).map((contact) => [contact.id, contact]));
    for (const person of directoryContacts) {
      if (person.id === viewerId || mapped.has(person.id)) continue;
      mapped.set(person.id, {
        id:person.id, display_name:person.display_name, role:person.role,
        roleLabel:person.role, sharedTitles:[],
      });
    }
    return [...mapped.values()].filter((contact) =>
      normalized ? contact.display_name.toLowerCase().includes(normalized) : true,
    ).sort((a,b)=>a.display_name.localeCompare(b.display_name,"ru"));
  }, [channels, directoryContacts, viewerId, query]);

  useEffect(() => {
    if (createSignal === 0 || handledCreateSignal.current === createSignal) return;
    handledCreateSignal.current = createSignal;
    setTab("Контакты");
    setQuery("");
    setMenuOpen(contactsOfChannels(channels, viewerId).length > 0);
  }, [createSignal, channels, viewerId]);

  useEffect(() => {
    if (menuOpen) menuRef.current?.focus();
  }, [menuOpen]);

  useEffect(() => {
    if (findSignal === 0) return;
    setTab("Все");
    setQuery("Маяки");
    setMenuOpen(false);
  }, [findSignal]);

  useEffect(() => {
    // A newly created/selected dialog should be visible immediately instead
    // of leaving its new card hidden behind the Contacts tab.
    if (selectedId !== null && previousSelectedId.current !== selectedId) {
      setTab("Все");
      setQuery("");
      setMenuOpen(false);
    }
    previousSelectedId.current = selectedId;
  }, [selectedId]);

  const onScroll = () => {
    if (scrollRef.current) writeDialogScroll(storage, scrollRef.current.scrollTop);
  };

  const togglePref = (field: "pinned" | "archived", channelId: string, value: boolean) => {
    setPrefsState(setDialogPref(storage, field, channelId, value));
  };

  const onKeyDownRows = (event: ReactKeyboardEvent<HTMLUListElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest(".msg-dialog-list__row-actions")) return;
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const rowButtons = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>("button.msg-dialog-list__row"),
    );
    const index = rowButtons.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0) return;
    event.preventDefault();
    const next =
      event.key === "ArrowDown"
        ? Math.min(rowButtons.length - 1, index + 1)
        : event.key === "ArrowUp"
          ? Math.max(0, index - 1)
          : event.key === "Home"
            ? 0
            : rowButtons.length - 1;
    rowButtons[next]?.focus();
  };

  return (
    <aside
      className={"msg-dialog-list" + (className ? ` ${className}` : "")}
      aria-label="Список диалогов"
    >
      <div className="msg-dialog-list__heading">
        <div><h2>Сообщения</h2><p>Диалоги и сообщества</p></div>
        <button
          type="button"
          className="msg-dialog-list__create-button msg-dialog-list__create-button--header"
          aria-haspopup={contacts.length > 0 ? "menu" : undefined}
          aria-expanded={contacts.length > 0 ? menuOpen : undefined}
          onClick={() => {
            setTab("Контакты");
            setQuery("");
            if (contacts.length > 0) setMenuOpen((open) => !open);
            else setMenuOpen(false);
          }}
        >
          <Plus aria-hidden="true" size={17}/> Создать чат
        </button>
      </div>
      <div className="msg-dialog-list__top">
        <label className="msg-dialog-list__search">
          <span className="msg-dialog-list__sr-only">Поиск диалогов</span>
          <span className="msg-dialog-list__search-field">
            <Search aria-hidden="true" size={15} />
            <input
              type="search"
              value={query}
              placeholder="Поиск диалогов..."
              aria-label="Поиск диалогов"
              onChange={(event) => {
                setQuery(event.target.value);
              }}
            />
          </span>
        </label>
        <div className="msg-dialog-list__create">
          <button
            type="button"
            className="msg-dialog-list__create-button"
            disabled={contacts.length === 0}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title={
              contacts.length === 0
                ? "Контакты появятся вместе с доступными каналами"
                : "Создать диалог с контактом"
            }
            onClick={() => {
              setMenuOpen((open) => !open);
            }}
          >
            <Plus aria-hidden="true" size={15} />
            Создать диалог
          </button>
          {menuOpen && contacts.length > 0 && (
            <div
              className="msg-dialog-list__create-menu"
              ref={menuRef}
              tabIndex={-1}
              role="menu"
              aria-label="Контакты для нового диалога"
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setMenuOpen(false);
                  event.currentTarget.closest(".msg-dialog-list")?.querySelector<HTMLButtonElement>(".msg-dialog-list__create-button--header")?.focus();
                }
              }}
            >
              {onCreateGroup && (
                <button type="button" role="menuitem" className="msg-group-create-trigger"
                  onClick={() => {setMenuOpen(false);setGroupOpen(true);}}>
                  <strong>Новый групповой чат</strong><small>Выбрать нескольких участников</small>
                </button>
              )}
              {contacts.map((contact) => (
                <button
                  key={contact.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    void Promise.resolve(onCreateDialog?.(contact.id)).catch(() => undefined);
                  }}
                >
                  <strong>{contact.display_name}</strong>
                  <small>{contact.roleLabel}</small>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div
        className="msg-dialog-list__tabs"
        role="tablist"
        aria-label="Разделы диалогов"
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const current = DIALOG_TABS.indexOf(tab);
          const next =
            event.key === "ArrowRight"
              ? (current + 1) % DIALOG_TABS.length
              : event.key === "ArrowLeft"
                ? (current - 1 + DIALOG_TABS.length) % DIALOG_TABS.length
                : event.key === "Home"
                  ? 0
                  : DIALOG_TABS.length - 1;
          setTab(DIALOG_TABS[next] as "Все" | "Архив" | "Контакты");
        }}
      >
        {DIALOG_TABS.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={tab === item}
            className={tab === item ? "active" : ""}
            onClick={() => {
              setTab(item);
            }}
          >
            {item}{item === "Все" && <span className="msg-dialog-list__count">{String(rows.length)}</span>}
          </button>
        ))}
      </div>
      <p aria-live="polite" className="msg-dialog-list__live sr-only">
        {tab === "Контакты"
          ? `Контактов: ${String(contacts.length)}`
          : `Диалогов показано: ${String(visible.length)}`}
      </p>
      {tab === "Контакты" ? (
        <ul className="msg-dialog-list__contacts" aria-label="Контакты">
          {contacts.length === 0 ? (
            <li className="msg-dialog-list__empty" aria-live="polite">
              <p>Контактов пока нет.</p>
              <p>Контакты появятся вместе с доступными каналами.</p>
            </li>
          ) : (
            contacts.map((contact) => (
              <li key={contact.id}>
                <button
                  type="button"
                  onClick={() => {
                    void Promise.resolve(onCreateDialog?.(contact.id)).catch(() => undefined);
                  }}
                >
                  <DialogAvatar title={contact.display_name} kind="personal" />
                  <span className="msg-dialog-list__contact-text">
                    <strong>{contact.display_name}</strong>
                    <small>{contact.roleLabel}</small>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : (
        <div className="msg-dialog-list__scroll" ref={scrollRef} onScroll={onScroll}>
          <ul
            className="msg-dialog-list__rows"
            aria-label={tab === "Архив" ? "Архивные диалоги" : "Диалоги"}
            onKeyDown={onKeyDownRows}
          >
            {visible.length === 0 ? (
              <li className="msg-dialog-list__empty" aria-live="polite">
                <p>
                  {query.trim()
                    ? "Ничего не найдено по этому запросу."
                    : tab === "Архив"
                      ? "Архивных диалогов нет."
                      : "Диалогов пока нет."}
                </p>
                <p>Список наполнится данными разрешённых каналов.</p>
              </li>
            ) : (
              visible.map((row) => (
                <li
                  key={row.channel.id}
                  className={
                    "msg-dialog-list__row-item" +
                    (row.selected ? " selected" : "") +
                    (row.muted ? " muted" : "")
                  }
                >
                  <button
                    type="button"
                    className="msg-dialog-list__row"
                    aria-current={row.selected ? "true" : undefined}
                    onClick={() => {
                      onSelect(row.channel.id);
                    }}
                  >
                    <DialogAvatar title={row.title} kind={row.channel.kind} />
                    <span className="msg-dialog-list__row-text">
                      <span className="msg-dialog-list__row-title">
                        <strong>{row.title}</strong>
                        {row.hasDraft && (
                          <em className="msg-dialog-list__draft">Черновик</em>
                        )}
                        {row.mention && (
                          <em className="msg-dialog-list__mention">
                            <AtSign aria-hidden="true" size={11} />
                            упоминание
                          </em>
                        )}
                        {row.muted && (
                          <span className="msg-dialog-list__muteinner">
                            <BellOff aria-hidden="true" size={13} />
                            <span className="sr-only">уведомления отключены</span>
                          </span>
                        )}
                      </span>
                      <small className="msg-dialog-list__preview">
                        {row.hasDraft
                          ? `Черновик: ${row.preview ?? ""}`
                          : row.lastSender
                            ? `${row.lastSender}: ${row.preview ?? ""}`
                            : (row.preview ?? "Сообщений пока нет")}
                      </small>
                      <small className="msg-dialog-list__kind">{row.kindLabel}</small>
                    </span>
                    <span className="msg-dialog-list__meta">
                      {row.timeIso !== null && (
                        <time dateTime={row.timeIso} aria-hidden="true">
                          {row.timeLabel}
                        </time>
                      )}
                      {row.unread > 0 && (
                        <b className="msg-dialog-list__unread">
                          {row.unread}
                          <span className="sr-only"> непрочитанных</span>
                        </b>
                      )}
                      {row.pinned && (
                        <span className="msg-dialog-list__pinflag" title="Закреплён">
                          <Pin aria-hidden="true" size={12} />
                          <span className="sr-only">закреплён</span>
                        </span>
                      )}
                    </span>
                  </button>
                  <span className="msg-dialog-list__row-actions">
                    <button
                      type="button"
                      className="msg-dialog-list__row-action"
                      aria-pressed={row.pinned}
                      title={row.pinned ? "Открепить" : "Закрепить"}
                      onClick={() => {
                        togglePref("pinned", row.channel.id, !row.pinned);
                      }}
                    >
                      {row.pinned ? (
                        <PinOff aria-hidden="true" size={14} />
                      ) : (
                        <Pin aria-hidden="true" size={14} />
                      )}
                      <span className="sr-only">
                        {row.pinned ? `Открепить диалог «${row.title}»` : `Закрепить диалог «${row.title}»`}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="msg-dialog-list__row-action"
                      aria-pressed={row.archived}
                      title={row.archived ? "Вернуть из архива" : "В архив"}
                      onClick={() => {
                        togglePref("archived", row.channel.id, !row.archived);
                      }}
                    >
                      {row.archived ? (
                        <ArchiveRestore aria-hidden="true" size={14} />
                      ) : (
                        <ArchiveX aria-hidden="true" size={14} />
                      )}
                      <span className="sr-only">
                        {row.archived
                          ? `Вернуть «${row.title}» из архива`
                          : `Перенести «${row.title}» в архив`}
                      </span>
                    </button>
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
      {actionError && <p className="msg-dialog-action-error" role="alert">{actionError}</p>}
      {groupOpen && onCreateGroup && (
        <GroupCreator contacts={directoryContacts} onCreate={onCreateGroup}
          onClose={() => {setGroupOpen(false);}} />
      )}
    </aside>
  );
}
