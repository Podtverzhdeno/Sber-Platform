import { describe, expect, it } from "vitest";
import { authorizedMessagesRoute } from "./message-route";

describe("rating to messages authorized route", () => {
  it("finds messages from the server-owned navigation order", () => {
    expect(authorizedMessagesRoute({
      active_role: "participant",
      navigation: ["Главная", "Сообщения", "Рейтинг"],
    })).toBe("/workspace/1");
    expect(authorizedMessagesRoute({
      active_role: "participant",
      navigation: ["Главная", "Рейтинг", "Достижения", "Сообщения"],
    })).toBe("/workspace/3");
  });
  it("never assumes section 10 or a fixed fallback index", () => {
    expect(authorizedMessagesRoute({ active_role: "participant", navigation: ["Главная", "Рейтинг"] })).toBeNull();
  });
  it("does not expose a participant route for another role", () => {
    expect(authorizedMessagesRoute({ active_role: "customer", navigation: ["Сообщения", "Главная"] })).toBeNull();
  });
  it("handles the unloaded actor without leaking an unsafe destination", () => {
    expect(authorizedMessagesRoute(undefined)).toBeNull();
    expect(authorizedMessagesRoute(null)).toBeNull();
  });
});
