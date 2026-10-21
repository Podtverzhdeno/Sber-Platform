import type { ApiMessageView } from "./contracts";

export const CHAT_REACTIONS_KEY = "impulse.messenger.message-reactions";
export const CHAT_PINS_KEY = "impulse.messenger.message-pins";

export const CHAT_REACTION_EMOJIS: readonly string[] = ["👍", "❤️", "😂", "😮", "🙏"];

export type ReactionRecord = Record<string, Record<string, string[]>>;

export type ChatMessageRow =
  | { type: "datedivider"; key: string; label: string }
  | { type: "service"; key: string; message: ApiMessageView }
  | { type: "group"; key: string; authorId: string | null; authorName: string | null; items: ApiMessageView[] };

export type ChatDirection = "incoming" | "outgoing";

export type MentionSegment = { text: string; mention: boolean };

export function messageDirection(message: ApiMessageView, viewerId: string | null): ChatDirection {
  return message.author_id !== null && message.author_id === viewerId ? "outgoing" : "incoming";
}

export function chatMessageKey(message: Pick<ApiMessageView, "id" | "created_at" | "sequence">): string {
  return [message.id, String(message.sequence), message.created_at].join("|");
}

/** Сливает страницы истории и отбрасывает дубликаты (повторная подгрузка, гонки запросов). */
export function mergeHistory(
  incoming: readonly ApiMessageView[],
  baseline: readonly ApiMessageView[],
): ApiMessageView[] {
  const byId = new Map<string, ApiMessageView>();
  for (const message of [...baseline, ...incoming]) {
    if (message.id.length === 0) continue;
    byId.set(message.id, message);
  }
  return [...byId.values()].sort((a, b) => {
    if (a.sequence !== b.sequence) return a.sequence - b.sequence;
    const diff = Date.parse(a.created_at) - Date.parse(b.created_at);
    return diff !== 0 ? diff : a.id.localeCompare(b.id);
  });
}

export function historyTopSequence(messages: readonly ApiMessageView[]): number | null {
  const first = messages[0];
  return first === undefined ? null : first.sequence;
}

const GROUP_GAP_MS = 5 * 60 * 1000;

function startOfDay(value: Date): number {
  return Date.UTC(value.getFullYear(), value.getMonth(), value.getDate());
}

export function formatDateDividerLabel(iso: string, now: Date = new Date()): string {
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return "";
  const today = startOfDay(now);
  const that = startOfDay(value);
  if (that === today) return "Сегодня";
  if (that === today - 24 * 60 * 60 * 1000) return "Вчера";
  const month = value.toLocaleDateString("ru-RU", { month: "long" });
  const base = `${String(value.getDate())} ${month}`;
  return value.getFullYear() === now.getFullYear() ? base : `${base} ${String(value.getFullYear())}`;
}

export function dateDividerKey(iso: string): string {
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return "";
  return ["date", String(value.getFullYear()), String(value.getMonth() + 1), String(value.getDate())].join("-");
}

export function buildChatRows(
  messages: readonly ApiMessageView[],
  now: Date = new Date(),
): ChatMessageRow[] {
  const rows: ChatMessageRow[] = [];
  let lastDividerKey = "";
  let lastGroup: Extract<ChatMessageRow, { type: "group" }> | null = null;
  let lastMessage: ApiMessageView | null = null;

  for (const message of messages) {
    const dividerKey = dateDividerKey(message.created_at);
    if (dividerKey !== lastDividerKey) {
      const label = formatDateDividerLabel(message.created_at, now);
      if (label) {
        rows.push({ type: "datedivider", key: dividerKey || chatMessageKey(message), label });
      }
      lastDividerKey = dividerKey;
      lastGroup = null;
    }

    if (message.kind === "system") {
      rows.push({ type: "service", key: chatMessageKey(message), message });
      lastGroup = null;
      lastMessage = message;
      continue;
    }

    const time = Date.parse(message.created_at);
    const sameAuthor =
      lastGroup !== null &&
      lastMessage !== null &&
      lastMessage.author_id === message.author_id &&
      lastMessage.author_name === message.author_name &&
      Date.parse(lastMessage.created_at) >= 0 &&
      time - Date.parse(lastMessage.created_at) <= GROUP_GAP_MS;

    if (sameAuthor && lastGroup !== null) {
      lastGroup.items = [...lastGroup.items, message];
      lastMessage = message;
      continue;
    }

    const fresh: Extract<ChatMessageRow, { type: "group" }> = {
      type: "group",
      key: chatMessageKey(message) + "-group",
      authorId: message.author_id,
      authorName: message.author_name,
      items: [message],
    };
    rows.push(fresh);
    lastGroup = fresh;
    lastMessage = message;
  }
  return rows;
}

/** Разбивает тело сообщения на сегменты с подсветкой упоминаний @Имя. */
export function mentionSegments(body: string): MentionSegment[] {
  const segments: MentionSegment[] = [];
  const pattern = /@[\wа-яё-]+/gi;
  let cursor = 0;
  for (const match of body.matchAll(pattern)) {
    const index = match.index;
    if (index > cursor) segments.push({ text: body.slice(cursor, index), mention: false });
    const token = match[0];
    if (token.length > 0) {
      segments.push({ text: token, mention: true });
      cursor = index + token.length;
    }
  }
  if (cursor < body.length) segments.push({ text: body.slice(cursor), mention: false });
  return segments.length > 0 ? segments : [{ text: body, mention: false }];
}

export function chatScrollKey(channelId: string): string {
  return `impulse.messenger.chat-scroll:${channelId}`;
}

export function readReactions(storage: KeyValueStorage): ReactionRecord {
  try {
    const raw = storage.getItem(CHAT_REACTIONS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ReactionRecord | null;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function writeReactions(storage: KeyValueStorage, record: ReactionRecord): void {
  try {
    storage.setItem(CHAT_REACTIONS_KEY, JSON.stringify(record));
  } catch {
    /* Ограниченный storage не должен ломать чат. */
  }
}

export function toggleReaction(
  storage: KeyValueStorage,
  messageId: string,
  emoji: string,
  author: string,
): ReactionRecord {
  const record = readReactions(storage);
  const perMessage = { ...(record[messageId] ?? {}) };
  const authors = perMessage[emoji] ?? [];
  if (authors.includes(author)) {
    const next: Record<string, string[]> = {};
    for (const [key, list] of Object.entries(perMessage)) {
      if (key !== emoji) next[key] = list;
    }
    record[messageId] = next;
  } else {
    record[messageId] = { ...perMessage, [emoji]: [...authors, author] };
  }
  writeReactions(storage, record);
  return record;
}

export type PinRecord = Record<string, string>;

export function readPinnedMessageId(storage: KeyValueStorage, channelId: string): string | null {
  try {
    const raw = storage.getItem(CHAT_PINS_KEY);
    const parsed = raw === null ? null : (JSON.parse(raw) as PinRecord);
    return parsed ? (parsed[channelId] ?? null) : null;
  } catch {
    return null;
  }
}

export function writePinnedMessageId(
  storage: KeyValueStorage,
  channelId: string,
  messageId: string | null,
): PinRecord {
  let record: PinRecord = {};
  try {
    const raw = storage.getItem(CHAT_PINS_KEY);
    if (raw !== null) {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === "object" && parsed !== null) {
        record = parsed as PinRecord;
      }
    }
  } catch {
    record = {};
  }
  const next: PinRecord = {};
  for (const [existingChannel, existingMessage] of Object.entries(record)) {
    if (existingChannel !== channelId) next[existingChannel] = existingMessage;
  }
  if (messageId !== null) next[channelId] = messageId;
  try {
    storage.setItem(CHAT_PINS_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

type KeyValueStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};
