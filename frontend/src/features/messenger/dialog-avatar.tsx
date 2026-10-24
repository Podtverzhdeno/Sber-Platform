import { Box, MessageCircle, Radio, UsersRound } from "lucide-react";

type ReferenceKind = "trophy" | "school" | "team" | "ai" | "cat" | "technology" | "pulse" | "community" | null;

/** Named badges originate in the approved reference's dialog list.
 * Ordinary, unrelated channels continue to use their real initials. */
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

export function DialogAvatar({ title, initials, className = "" }: {
  title: string;
  initials: string;
  className?: string;
}) {
  const name = title.trim();
  const picture = Object.prototype.hasOwnProperty.call(pictureByTitle, name)
    ? pictureByTitle[name]
    : null;
  const mode = name.toLowerCase() === "маяки" ? "lighthouse" : picture;
  return (
    <span className={`msg-dialog-list__avatar msg-reference-avatar ${mode ? "msg-reference-avatar--" + mode : ""} ${className}`} aria-hidden="true">
      {mode === "lighthouse" && <img src="/messages-reference/mayaki-avatar.svg" alt="" />}
      {mode === "trophy" && <span className="msg-reference-avatar-symbol">🏆</span>}
      {mode === "school" && <span className="msg-reference-avatar-symbol school">21</span>}
      {mode === "team" && <UsersRound size={24} strokeWidth={1.7} />}
      {mode === "ai" && <span className="msg-reference-avatar-symbol ai">◕<small>GOOD</small></span>}
      {mode === "cat" && <span className="msg-reference-avatar-symbol">🐱</span>}
      {mode === "technology" && <Box size={26} strokeWidth={1.7} />}
      {mode === "pulse" && <Radio size={23} strokeWidth={1.7} />}
      {mode === null && initials}
    </span>
  );
}
