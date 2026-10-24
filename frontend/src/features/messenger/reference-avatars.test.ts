import { describe, expect, it } from "vitest";
import { referenceAvatarFor, referenceAvatarSpriteIndexFor, referencePersonIndex } from "./reference-avatars";

describe("approved Messages ZIP avatar identity", () => {
  it("reproduces the distinct community icons from app.js", () => {
    expect(referenceAvatarFor("reference:mayaki")).toEqual({ glyph: "🗼", tone: "blue" });
    expect(referenceAvatarFor("reference:grants")).toEqual({ glyph: "🏆", tone: "orange" });
    expect(referenceAvatarFor("reference:school21")).toEqual({ glyph: "21", tone: "green" });
    expect(referenceAvatarFor("reference:aidev")).toEqual({ glyph: "◐", tone: "purple" });
  });

  it("does not overwrite real people or user-provided channel avatars", () => {
    expect(referenceAvatarFor("b6a24e2f-8a0e-4a41-9cea-5f5a2e39a10d")).toBeNull();
    expect(referenceAvatarFor("reference:unknown")).toBeNull();
  });
  it("maps the approved 01.png raster assets to the same identity across panes", () => {
    expect(referenceAvatarSpriteIndexFor("reference:mayaki")).toBe(0);
    expect(referenceAvatarSpriteIndexFor("reference:grants")).toBe(1);
    expect(referenceAvatarSpriteIndexFor("reference:mentor")).toBe(3);
    expect(referenceAvatarSpriteIndexFor("reference:zlata")).toBe(8);
    expect(referenceAvatarSpriteIndexFor("reference:common")).toBe(12);
    expect(referenceAvatarSpriteIndexFor("real-channel-id")).toBeNull();
  });

  it("keeps cropped photo identities out of API-backed chats", () => {
    expect(referencePersonIndex("Анна Ковалёва")).toBe(0);
    expect(referencePersonIndex("Дмитрий Соколов")).toBe(1);
    expect(referencePersonIndex("Мария Лебедева")).toBe(2);
    expect(referencePersonIndex("Иван Петров")).toBe(3);
    expect(referencePersonIndex("Реальный собеседник")).toBeNull();
  });
});
