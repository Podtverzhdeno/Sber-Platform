
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "../api/client";
import { BuddyChatV2 } from "./buddy-chat-v2";

vi.mock("../api/client", () => ({ apiRequest: vi.fn() }));
const profile = { person_id: "00000000-0000-0000-0000-000000000099", display_name: "Тестовый участник", primary_track: "Python" };
const thread = { id: "11111111-1111-4111-8111-111111111111", status: "active", content_deleted: false, messages: [] as {id:string;client_message_id:string;role:string;content:string}[] };
const courses = [{
  key: "api-course", title: "Работа с API", recommendation_reason: "Тренировка интеграций",
  availability: "available", source_url: "https://example.test/course", access_note: "", completion_status: null,
}];
const initialCalls = () => {
  vi.mocked(apiRequest).mockImplementation(async path => {
    await Promise.resolve();
    if (path === "/api/v1/development/courses") return courses;
    if (path === "/api/v1/agents/buddy/suggestion") return { suggestion: null };
    if (path === "/api/v1/agents/buddy/threads") return thread;
    if (path === "/api/v1/agents/buddy/threads/" + thread.id + "/messages") {
      const message = { id:"22222222-2222-4222-8222-222222222222", client_message_id:"client-msg", role:"user", content:"Как подключить API?" };
      thread.messages = [message];
      return message;
    }
    if (path === "/api/v1/agents/buddy/threads/" + thread.id) return thread;
    throw new Error("Unexpected endpoint: " + path);
  });
};
function view() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter>
    <BuddyChatV2 profile={profile} navigation={["Главная","Моя траектория","Bootcamp","Аналитика"]}/>
  </MemoryRouter></QueryClientProvider>);
}
beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  thread.messages = [];
  initialCalls();
});
describe("AI-Buddy single-pane conversation", () => {
  it("shows mockup content honestly without a right-side context panel", async () => {
    view();
    expect(await screen.findByText("Привет, я AI-Buddy!")).toBeVisible();
    expect(screen.getByText(/Пример возможностей/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Новый диалог" })).toBeVisible();
    expect(screen.queryByText("Ваш контекст")).not.toBeInTheDocument();
    expect(await screen.findByText("Работа с API")).toBeVisible();
    expect(screen.getAllByRole("button", {name:"Моя аналитика"}).length).toBeGreaterThan(0);
  });
  it("persists user messages on the server and restores their thread", async () => {
    view();
    fireEvent.change(screen.getByRole("textbox", {name:"Сообщение AI-Buddy"}), {target:{value:"Как подключить API?"}});
    fireEvent.click(screen.getByRole("button", {name:"Отправить сообщение"}));
    await waitFor(() => { expect(apiRequest).toHaveBeenCalledWith("/api/v1/agents/buddy/threads", expect.objectContaining({method:"POST"})); });
    await waitFor(() => { expect(screen.getAllByText("Как подключить API?").length).toBeGreaterThan(0); });
    expect(localStorage.getItem("impulse-buddy-dialogues:"+profile.person_id)).toContain(thread.id);
    expect(screen.getByText(/Автоматическая генерация ответов пока не подключена/)).toBeVisible();
  });
  it("does not invent an AI response when the network fails", async () => {
    vi.mocked(apiRequest).mockImplementation(async path => {
      await Promise.resolve();
      if (path === "/api/v1/development/courses") return [];
      if (path === "/api/v1/agents/buddy/suggestion") return {suggestion:null};
      throw new Error("Unavailable");
    });
    view();
    fireEvent.change(screen.getByRole("textbox", {name:"Сообщение AI-Buddy"}),{target:{value:"Помоги"}});
    fireEvent.click(screen.getByRole("button", {name:"Отправить сообщение"}));
    expect(await screen.findByText(/Сообщение не отправлено/)).toBeVisible();
    expect(screen.getByRole("textbox", {name:"Сообщение AI-Buddy"})).toHaveValue("Помоги");
  });
  it("dismisses the greeting banner and keeps it closed during the session", async () => {
    const first = view();
    expect(await screen.findByRole("button", { name: "Закрыть баннер AI-Buddy" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Закрыть баннер AI-Buddy" }));
    expect(screen.queryByText("Привет, я AI-Buddy!")).not.toBeInTheDocument();
    expect(sessionStorage.getItem("impulse-buddy-hero-dismissed:" + profile.person_id)).toBe("1");
    first.unmount();
    view();
    expect(screen.queryByRole("button", { name: "Закрыть баннер AI-Buddy" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Новый диалог" })).toBeVisible();
  });

  it("creates and activates a fresh server conversation without sending a message", async () => {
    const created = {
      id: "33333333-3333-4333-8333-333333333333",
      status: "active",
      content_deleted: false,
      messages: [] as { id: string; client_message_id: string; role: string; content: string }[],
    };
    const oldMessage = {
      id: "44444444-4444-4444-8444-444444444444",
      client_message_id: "old-message",
      role: "user",
      content: "Сохранённое сообщение старого диалога",
    };
    localStorage.setItem("impulse-buddy-dialogues:" + profile.person_id, JSON.stringify([
      { id: thread.id, title: "Предыдущая переписка", updated: "2026-10-25T08:00:00Z" },
    ]));
    vi.mocked(apiRequest).mockImplementation(async path => {
      await Promise.resolve();
      if (path === "/api/v1/development/courses") return courses;
      if (path === "/api/v1/agents/buddy/suggestion") return { suggestion: null };
      if (path === "/api/v1/agents/buddy/threads") return created;
      if (path === "/api/v1/agents/buddy/threads/" + thread.id) return { ...thread, messages: [oldMessage] };
      if (path === "/api/v1/agents/buddy/threads/" + created.id) return created;
      throw new Error("Unexpected endpoint: " + path);
    });
    const { container } = view();
    expect(await screen.findByText(oldMessage.content)).toBeVisible();
    fireEvent.change(screen.getByRole("textbox", { name: "Сообщение AI-Buddy" }), {
      target: { value: "Черновик старого диалога" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Новый диалог" }));
    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/api/v1/agents/buddy/threads", expect.objectContaining({ method: "POST" }),
      );
    });
    await waitFor(() => { expect(container.querySelector(".buddy2-dialog.active")).toHaveTextContent("Новый диалог"); });
    expect(screen.getByRole("textbox", { name: "Сообщение AI-Buddy" })).toHaveValue("");
    expect(screen.queryByText(oldMessage.content)).not.toBeInTheDocument();
    expect(screen.getByText(/Начните разговор: напишите вопрос/)).toBeVisible();
    expect(screen.queryByLabelText("Пример взаимодействия")).not.toBeInTheDocument();
    expect(localStorage.getItem("impulse-buddy-dialogues:" + profile.person_id)).toContain(created.id);
  });

  it("preserves the current conversation and draft when creating a new chat fails", async () => {
    const initial = vi.mocked(apiRequest).getMockImplementation();
    vi.mocked(apiRequest).mockImplementation(async (path, options) => {
      if (path === "/api/v1/agents/buddy/threads") throw new Error("Offline");
      if (!initial) throw new Error("Missing mock");
      return initial(path, options);
    });
    view();
    fireEvent.change(screen.getByRole("textbox", { name: "Сообщение AI-Buddy" }), {
      target: { value: "Важный черновик" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Новый диалог" }));
    expect(await screen.findByText(/Не удалось создать новый диалог/)).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Сообщение AI-Buddy" })).toHaveValue("Важный черновик");
    expect(localStorage.getItem("impulse-buddy-dialogues:" + profile.person_id)).toBeNull();
  });

});
