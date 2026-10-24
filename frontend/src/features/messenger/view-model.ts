import type {
  ApiChannelView,
  ApiMessageView,
  ApiParticipantView,
} from "./contracts";

export type DialogTab = "Все" | "Архив" | "Контакты";

export const DIALOG_TABS: readonly DialogTab[] = ["Все", "Архив", "Контакты"];

export const DIALOG_PREFS_KEY = "impulse.messenger.dialog-prefs";
export const DIALOG_DRAFTS_KEY = "impulse.messenger.drafts";
export const DIALOG_SCROLL_KEY = "impulse.messenger.dialog-scroll";

export type DialogPrefs = {
  pinned: Record<string, boolean>;
  archived: Record<string, boolean>;
};

export type DialogDrafts = Record<string, string>;

export type KeyValueStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export const emptyPrefs = (): DialogPrefs => ({ pinned: {}, archived: {} });

export function readDialogPrefs(storage: KeyValueStorage): DialogPrefs {
  try {
    const raw = storage.getItem(DIALOG_PREFS_KEY);
    if (!raw) return emptyPrefs();
    const parsed = JSON.parse(raw) as Partial<DialogPrefs> | null;
    return {
      pinned: parsed?.pinned && typeof parsed.pinned === "object" ? parsed.pinned : {},
      archived:
        parsed?.archived && typeof parsed.archived === "object" ? parsed.archived : {},
    };
  } catch {
    return emptyPrefs();
  }
}

export function writeDialogPrefs(storage: KeyValueStorage, prefs: DialogPrefs): void {
  try {
    storage.setItem(DIALOG_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* Ограниченный storage не должен ломать список. */
  }
}

export function setDialogPref(
  storage: KeyValueStorage,
  field: "pinned" | "archived",
  channelId: string,
  value: boolean,
): DialogPrefs {
  const prefs = readDialogPrefs(storage);
  prefs[field] = { ...prefs[field], [channelId]: value };
  writeDialogPrefs(storage, prefs);
  return prefs;
}

export function readDialogScroll(storage: KeyValueStorage): number {
  try {
    const raw = storage.getItem(DIALOG_SCROLL_KEY);
    const parsed = raw === null ? Number.NaN : Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

export function writeDialogScroll(storage: KeyValueStorage, scrollTop: number): void {
  try {
    storage.setItem(DIALOG_SCROLL_KEY, String(Math.max(0, Math.round(scrollTop))));
  } catch {
    /* ignore */
  }
}

export function clearDialogScroll(storage: KeyValueStorage): void {
  try {
    storage.removeItem(DIALOG_SCROLL_KEY);
  } catch {
    /* ignore */
  }
}

// Draft-регистр живёт в ./drafts.ts (подписка через useSyncExternalStore),
// здесь остаются только prefs и scroll-персистентность.

export function dialogDraftText(drafts: DialogDrafts, channelId: string): string | null {
  const text = drafts[channelId];
  return typeof text === "string" && text.trim() ? text : null;
}

const channelKindLabels: Record<string, string> = {
  personal: "Личный чат",
  community: "Сообщество",
  task_team: "Команда задачи",
  customer: "Канал заказчика",
  operator_case: "Служебный канал",
};

const participantRoleLabels: Record<string, string> = {
  customer: "заказчик",
  mentor: "ментор",
  member: "участник",
  support: "оператор",
};

export function dialogKindLabel(kind: string): string {
  return channelKindLabels[kind] ?? kind;
}

export function participantRoleLabel(role: string): string {
  return participantRoleLabels[role] ?? role;
}

export function dialogTitle(channel: ApiChannelView, viewerId: string | null): string {
  const peers = channel.participants
    .filter((person) => person.id !== viewerId && person.display_name)
    .map((person) => person.display_name);
  if (channel.kind === "personal" && viewerId && channel.participants.some((person) => person.id === viewerId) && peers.length) {
    return peers.join(", ");
  }
  return channel.title || (peers.length ? peers.join(", ") : "Личный чат");
}

export function dialogTimeLabel(iso: string, now: Date = new Date()): string {
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return "";
  const sameDay =
    value.getFullYear() === now.getFullYear() &&
    value.getMonth() === now.getMonth() &&
    value.getDate() === now.getDate();
  if (sameDay) {
    return value.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  }
  const month = value.toLocaleDateString("ru-RU", { month: "short" }).replace(".", "");
  return `${String(value.getDate())} ${month}`;
}

export function singleLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export type DialogRow = {
  channel: ApiChannelView;
  title: string;
  kindLabel: string;
  initial: string;
  lastSender: string | null;
  preview: string | null;
  timeLabel: string;
  timeIso: string | null;
  unread: number;
  muted: boolean;
  pinned: boolean;
  archived: boolean;
  hasDraft: boolean;
  mention: boolean;
  selected: boolean;
  senderEnabled: boolean;
  status: string;
};;

export function deriveDialogRow(input: {
  channel: ApiChannelView;
  viewerId: string | null;
  viewerName: string | null;
  selectedId: string | null;
  prefs: DialogPrefs;
  drafts: DialogDrafts;
  now?: Date;
}): DialogRow {
  const { channel, viewerId, viewerName, selectedId, prefs, drafts } = input;
  const last = channel.last_message;
  const draft = dialogDraftText(drafts, channel.id);
  const ownLast = last !== null && last.author_id !== null && last.author_id === viewerId;
  const lastSender = last === null ? null : ownLast ? "Вы" : last.author_name || "Участник";
  const mention =
    channel.unread > 0 &&
    Boolean(viewerName) &&
    last !== null &&
    last.author_id !== null &&
    last.author_id !== viewerId &&
    last.body.toLowerCase().includes(`@${String(viewerName).toLowerCase()}`);
  return {
    channel,
    title: dialogTitle(channel, viewerId),
    kindLabel: dialogKindLabel(channel.kind),
    initial: (dialogTitle(channel, viewerId).trim()[0] ?? "к").toUpperCase(),
    lastSender,
    preview: draft ? singleLine(draft) : last ? singleLine(last.body) : null,
    timeLabel: last ? channel.id.startsWith("reference:") ? last.created_at.slice(11, 16) : dialogTimeLabel(last.created_at, input.now) : "",
    timeIso: last ? last.created_at : channel.created_at,
    unread: channel.unread,
    muted: channel.muted,
    pinned: Boolean(prefs.pinned[channel.id]),
    archived: Boolean(prefs.archived[channel.id]),
    hasDraft: Boolean(draft),
    mention,
    selected: selectedId === channel.id,
    senderEnabled: channel.sender_enabled,
    status: channel.status,
  };
}

const timeDesc = (a: DialogRow, b: DialogRow): number => {
  const left = a.timeIso ? Date.parse(a.timeIso) : Date.parse(a.channel.created_at);
  const right = b.timeIso ? Date.parse(b.timeIso) : Date.parse(b.channel.created_at);
  if (left !== right) return right - left;
  return a.channel.id.localeCompare(b.channel.id);
};

export function deriveDialogRows(input: {
  channels: readonly ApiChannelView[];
  viewerId: string | null;
  viewerName: string | null;
  selectedId: string | null;
  prefs: DialogPrefs;
  drafts: DialogDrafts;
  now?: Date;
}): DialogRow[] {
  const rows = input.channels
    .filter((channel) => channel.status === "active" || (channel.status === "preview" && channel.id.startsWith("reference:")))
    .map((channel) => deriveDialogRow({ ...input, channel }));
  const approvedOrder = ["mentor", "roman", "proto", "mayaki", "aidev", "sberkot", "zlata", "news", "curator", "taskteam", "common", "grants", "school21"];
  return rows.sort((a, b) => {
    const aPreview = a.channel.id.startsWith("reference:");
    const bPreview = b.channel.id.startsWith("reference:");
    if (aPreview && bPreview) {
      if (a.channel.id === "reference:mayaki" && a.selected) return -1;
      if (b.channel.id === "reference:mayaki" && b.selected) return 1;
      const aIndex = approvedOrder.indexOf(a.channel.id.slice("reference:".length));
      const bIndex = approvedOrder.indexOf(b.channel.id.slice("reference:".length));
      if (aIndex !== bIndex) return aIndex - bIndex;
    }
    if (aPreview !== bPreview) return aPreview ? 1 : -1;
    if (a.archived !== b.archived) return a.archived ? 1 : -1;
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.mention !== b.mention) return a.mention ? -1 : 1;
    if (Boolean(a.unread) !== Boolean(b.unread)) return a.unread ? -1 : 1;
    return timeDesc(a, b);
  });
}

export function matchesQuery(row: DialogRow, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  const haystack = [
    row.title,
    row.lastSender ?? "",
    row.preview ?? "",
    row.kindLabel,
    row.channel.participants.map((person) => person.display_name).join(" "),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(normalized);
}

export function visibleDialogRows(rows: DialogRow[], tab: DialogTab, query: string): DialogRow[] {
  const matched = rows.filter((row) => matchesQuery(row, query));
  if (tab === "Архив") return matched.filter((row) => row.archived);
  return matched.filter((row) => !row.archived);
}

export type DialogContact = {
  id: string;
  display_name: string;
  role: string;
  roleLabel: string;
  sharedTitles: string[];
};

export function contactsOfChannels(
  channels: readonly ApiChannelView[],
  viewerId: string | null,
): DialogContact[] {
  const byId = new Map<string, DialogContact>();
  for (const channel of channels) {
    if (channel.status !== "active") continue;
    for (const person of channel.participants) {
      if (person.id === viewerId || !person.display_name) continue;
      const existing = byId.get(person.id);
      const sharedTitle = channel.title || channel.kind;
      if (existing) {
        if (!existing.sharedTitles.includes(sharedTitle)) {
          existing.sharedTitles = [...existing.sharedTitles, sharedTitle];
        }
        continue;
      }
      byId.set(person.id, {
        id: person.id,
        display_name: person.display_name,
        role: person.role,
        roleLabel: participantRoleLabel(person.role),
        sharedTitles: [sharedTitle],
      });
    }
  }
  return [...byId.values()].sort((a, b) => a.display_name.localeCompare(b.display_name));
}

export function describesReadState(row: DialogRow): string {
  if (row.unread > 0) {
    const count = `непрочитанных: ${String(row.unread)}`;
    return row.mention ? `${count}, есть упоминание` : count;
  }
  return "прочитано";
}

export type {
  ApiChannelView,
  ApiMessageView,
  ApiParticipantView,
};
