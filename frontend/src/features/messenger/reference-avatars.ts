/** Presentation-only glyphs transcribed from the approved Impulse Messages app.js.
 * Never applied to API-backed conversations, which retain their real identity.
 */
export type ReferenceAvatarTone = "blue" | "purple" | "orange" | "green" | "teal" | "neutral";
export type ReferenceAvatar = Readonly<{ glyph: string; tone: ReferenceAvatarTone }>;

const avatars: Readonly<Record<string, ReferenceAvatar>> = {
  "reference:mentor": { glyph: "E", tone: "teal" },
  "reference:mayaki": { glyph: "🗼", tone: "blue" },
  "reference:grants": { glyph: "🏆", tone: "orange" },
  "reference:school21": { glyph: "21", tone: "green" },
  "reference:roman": { glyph: "Р", tone: "neutral" },
  "reference:proto": { glyph: "◉", tone: "blue" },
  "reference:aidev": { glyph: "◐", tone: "purple" },
  "reference:sberkot": { glyph: "🟢", tone: "green" },
  "reference:zlata": { glyph: "👩", tone: "neutral" },
  "reference:news": { glyph: "⬢", tone: "blue" },
  "reference:curator": { glyph: "A", tone: "neutral" },
  "reference:taskteam": { glyph: "◎", tone: "teal" },
  "reference:common": { glyph: "∿", tone: "teal" },
};

export const referenceAvatarFor = (channelId: string): ReferenceAvatar | null =>
  Object.prototype.hasOwnProperty.call(avatars, channelId) ? avatars[channelId] : null;
