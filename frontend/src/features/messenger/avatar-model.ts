/** Privacy-safe fallback for contacts without verified image identity. */
export function avatarInitials(name: string): string {
  const words = name.trim().split(/\s+/u).filter(Boolean);
  if (words.length === 0) return "?";
  return words.slice(0, 2).map(word => (word[0] ?? "").toLocaleUpperCase("ru-RU")).join("");
}
