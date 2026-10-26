import { Box, Cat, Radio, Sparkles, Trophy, UsersRound } from "lucide-react";
import { avatarInitials } from "./avatar-model";

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
  let sum = 0;
  for (let index = 0; index < name.length; index++) sum += name.charCodeAt(index);
  const tone = sum % 5;
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
