import { DIALOG_DRAFTS_KEY, type KeyValueStorage } from "./view-model";

export type DialogDrafts = Record<string, string>;

let draftsSnapshot: DialogDrafts = {};
let hydrated = false;

const draftListeners = new Set<() => void>();

function applyDrafts(next: DialogDrafts): void {
  draftsSnapshot = next;
  for (const listener of draftListeners) listener();
}

export function readDialogDrafts(storage: KeyValueStorage): DialogDrafts {
  try {
    const raw = storage.getItem(DIALOG_DRAFTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as DialogDrafts | null;
    if (!parsed || typeof parsed !== "object") return {};
    const clean: DialogDrafts = {};
    for (const [id, text] of Object.entries(parsed)) {
      if (typeof text === "string" && text.trim()) clean[id] = text;
    }
    return clean;
  } catch {
    return {};
  }
}

export function hydrateDialogDrafts(storage: KeyValueStorage, force = false): void {
  if (hydrated && !force) return;
  hydrated = true;
  applyDrafts(readDialogDrafts(storage));
}

/** Test/teardown helper: clears the registry and re-enables hydration. */
export function resetDialogDrafts(next: DialogDrafts = {}): void {
  hydrated = false;
  applyDrafts(next);
}

export function subscribeDialogDrafts(listener: () => void): () => void {
  draftListeners.add(listener);
  return () => {
    draftListeners.delete(listener);
  };
}

export function getDialogDraftsSnapshot(): DialogDrafts {
  return draftsSnapshot;
}

export function dialogDraftText(drafts: DialogDrafts, channelId: string): string | null {
  const text = drafts[channelId];
  return typeof text === "string" && text.trim() ? text : null;
}

export function setDialogDraft(
  storage: KeyValueStorage,
  channelId: string,
  text: string,
): void {
  const next: DialogDrafts = {};
  for (const [id, stored] of Object.entries(draftsSnapshot)) {
    if (id !== channelId) next[id] = stored;
  }
  if (text.trim()) next[channelId] = text;
  try {
    storage.setItem(DIALOG_DRAFTS_KEY, JSON.stringify(next));
  } catch {
    /* Ограниченный storage не должен ломать редактор. */
  }
  applyDrafts(next);
}
