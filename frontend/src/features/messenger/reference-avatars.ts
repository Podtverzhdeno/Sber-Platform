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
  avatars[channelId] ?? null;

/** Layout-ordered fragments cropped from the user-provided approved 01.png.
 * Kept separate from the glyph/tone map, so existing demos/tests stay compatible.
 * Never applied to real API channels.
 */
const referenceSpriteOrder = [
  "reference:mayaki", "reference:grants", "reference:school21",
  "reference:mentor", "reference:roman", "reference:proto",
  "reference:aidev", "reference:sberkot", "reference:zlata",
  "reference:news", "reference:curator", "reference:taskteam", "reference:common",
] as const;
export const referenceAvatarSpriteIndexFor = (channelId: string): number | null => {
  const index = referenceSpriteOrder.indexOf(channelId as (typeof referenceSpriteOrder)[number]);
  return index < 0 ? null : index;
};
