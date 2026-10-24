import { describe, expect, it } from "vitest";
import { referenceAvatarFor } from "./reference-avatars";

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
});
