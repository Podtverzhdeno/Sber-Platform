
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
});
