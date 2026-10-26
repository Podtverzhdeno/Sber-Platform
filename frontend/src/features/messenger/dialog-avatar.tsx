import { Box, Cat, Radio, Sparkles, Trophy, UsersRound } from "lucide-react";

type ReferenceKind = "trophy" | "school" | "team" | "ai" | "cat" | "technology" | "pulse" | "lighthouse" | null;

/** Recognised community identities. Unknown groups use a styled monogram. */
const pictureByTitle: Record<string, ReferenceKind> = {
  "Грантовый конкурс": "trophy",
  "Школа 21": "school",
  "Прототип рекомендателя": "team",
  "AI в Dev Community": "ai",
  "AI in Dev Community": "ai",
  СберКот: "cat",
  "Новости технологий": "technology",
  "Импульс — Общий чат": "pulse",
  "Импульс - Общий чат": "pulse",
  "Команда задачи": "team",
};

/** Portraits already identified by the existing Mayaki reference. Never assign
 * them to another person merely because they share a given name. */
const verifiedPortraits: Record<string, string> = {
  "Анна Ковалёва": "/messages-reference/anna-avatar.svg",
  "Анна Ковалева": "/messages-reference/anna-avatar.svg",
  "Дмитрий Соколов": "/messages-reference/dmitry-avatar.svg",
  "Мария Лебедева": "/messages-reference/maria-avatar.svg",
};

export function avatarInitials(name: string): string {
  const words = name.trim().split(/\s+/u).filter(Boolean);
  if (words.length === 0) return "?";
  return words.slice(0, 2).map(word => (word[0] ?? "").toLocaleUpperCase("ru-RU")).join("");
}

export function DialogAvatar({ title, initials, kind, className = "msg-dialog-list__avatar" }: {
  title: string;
  initials?: string;
  kind?: string;
  className?: string;
}) {
  const name = title.trim();
  const isGroup = kind !== "personal";
  const icon = isGroup
    ? (name.toLocaleLowerCase("ru-RU") === "маяки" ? "lighthouse" : pictureByTitle[name] ?? null)
    : null;
  const portrait = !isGroup ? verifiedPortraits[name] : undefined;
  const tone = [...name].reduce((value, char) => value + (char.codePointAt(0) ?? 0), 0) % 5;
  const modeClass = icon ? `msg-reference-avatar--${icon}` : `msg-avatar--contact msg-avatar--tone-${String(tone)}`;
  return (
    <span className={`msg-avatar msg-reference-avatar ${modeClass} ${className}`.trim()} aria-hidden="true">
      {portrait ? <img src={portrait} alt="" loading="lazy" />
        : icon === "lighthouse" ? <img src="/messages-reference/mayaki-avatar.svg" alt="" loading="lazy" />
        : icon === "trophy" ? <Trophy aria-hidden="true" strokeWidth={2.1} />
        : icon === "school" ? <span className="msg-reference-avatar-symbol school">21</span>
        : icon === "team" ? <UsersRound aria-hidden="true" strokeWidth={1.8} />
        : icon === "ai" ? <Sparkles aria-hidden="true" strokeWidth={1.9} />
        : icon === "cat" ? <Cat aria-hidden="true" strokeWidth={1.9} />
        : icon === "technology" ? <Box aria-hidden="true" strokeWidth={1.8} />
        : icon === "pulse" ? <Radio aria-hidden="true" strokeWidth={1.8} />
        : <span className="msg-avatar__initials">{initials ?? avatarInitials(name)}</span>}
    </span>
  );
}
