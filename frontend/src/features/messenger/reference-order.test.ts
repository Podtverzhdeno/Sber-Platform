import { describe, expect, it } from "vitest";

import { referenceChannels } from "./reference-fixtures";
import { deriveDialogRows, emptyPrefs } from "./view-model";

const orderFor = (selectedId: string | null, pinned: Record<string, boolean> = {}) =>
  deriveDialogRows({
    channels: referenceChannels,
    viewerId: "reference:me",
    viewerName: "Алекс Речной",
    selectedId,
    prefs: { ...emptyPrefs(), pinned },
    drafts: {},
  }).map((row) => row.channel.id);

describe("Impulse Messages ZIP dialog-list order", () => {
  it("matches the empty-state 02.png initial list order", () => {
    expect(orderFor(null).slice(0, 9)).toEqual([
      "reference:mentor", "reference:roman", "reference:proto",
      "reference:mayaki", "reference:aidev", "reference:sberkot",
      "reference:zlata", "reference:grants", "reference:school21",
    ]);
  });

  it("matches the community 01.png placement of Mayaki, grants and School 21", () => {
    expect(orderFor("reference:mayaki").slice(0, 6)).toEqual([
      "reference:mayaki", "reference:grants", "reference:school21",
      "reference:mentor", "reference:roman", "reference:proto",
    ]);
  });

  it("keeps the Elena personal screenshot's order without moving live chats", () => {
    expect(orderFor("reference:mentor").slice(0, 4)).toEqual([
      "reference:mentor", "reference:roman", "reference:proto", "reference:aidev",
    ]);
  });

  it("continues to respect an explicit pinned preference", () => {
    expect(orderFor(null, { "reference:school21": true })[0]).toBe("reference:school21");
  });
});
