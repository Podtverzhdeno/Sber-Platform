export const COMPOSER_MAX_ARTIFACT_REFS = 24;

export const COMPOSER_EMOJIS: readonly string[] = [
  "👍",
  "❤️",
  "😀",
  "😂",
  "🙏",
  "🔥",
  "✅",
  "❗",
];

export type ComposerSendState = "idle" | "sending" | "failed";

export type ComposerConnectionState = "online" | "reconnecting" | "offline";

export type ComposerSendPayload = {
  body: string;
  artifact_refs: string[];
};

export function validateArtifactRef(
  value: string,
  existing: readonly string[],
): string | null {
  const candidate = value.trim();
  if (!candidate) return "Введите ключ артефакта";
  if (/\s/u.test(candidate)) return "Ключ артефакта не должен содержать пробелов";
  if (existing.includes(candidate)) return "Артефакт уже прикреплён";
  if (existing.length >= COMPOSER_MAX_ARTIFACT_REFS) {
    return `Не больше ${String(COMPOSER_MAX_ARTIFACT_REFS)} вложений на сообщение`;
  }
  return null;
}
