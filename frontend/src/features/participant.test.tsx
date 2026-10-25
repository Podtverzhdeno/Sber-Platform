import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ParticipantBuddy, ParticipantSettings } from "./participant";

const profile = {
  person_id: "00000000-0000-0000-0000-000000000001",
  display_name: "Алекс Речной",
  city: "Москва",
  university: "МГТУ",
  study_year: "4 курс",
  primary_track: "Python-разработчик",
  email: "alex@example.test",
  telegram: "@alex",
  about: "Backend и аналитика",
  avatar_url: "",
  locale: "ru-RU" as const,
  theme: "dark" as const,
  timezone: "Europe/Moscow",
  skills: [
    { title: "SQL", origin: "verified_course", verified: true },
    { title: "FastAPI", origin: "self_reported", verified: false },
  ],
};

afterEach(() => { vi.restoreAllMocks(); });

describe("participant settings", () => {
  it("loads provenance and persists profile preferences", async () => {
    let savedBody: Record<string, unknown> | undefined;
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const path = input instanceof Request ? new URL(input.url).pathname : input instanceof URL ? input.pathname : input;
      if (path === "/api/v1/me") {
        return Promise.resolve(new Response(JSON.stringify({ consent_scopes: [] }), { status: 200 }));
      }
      if (path === "/api/v1/me/profile" && init?.method === "PUT") {
        savedBody = JSON.parse(typeof init.body === "string" ? init.body : "{}") as Record<string, unknown>;
        return Promise.resolve(new Response(JSON.stringify({ ...profile, ...savedBody, skills: profile.skills }), { status: 200 }));
      }
      if (path === "/api/v1/me/profile") {
        return Promise.resolve(new Response(JSON.stringify(profile), { status: 200 }));
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ParticipantSettings actorName="Алекс Речной" consentScopes={[]} />
      </QueryClientProvider>,
    );

    await waitFor(() => { expect(screen.getByDisplayValue("Москва")).toBeInTheDocument(); });
    expect(screen.getByText("SQL · подтверждён")).toBeInTheDocument();
    fireEvent.change(screen.getByDisplayValue("Москва"), { target: { value: "Амман" } });
    fireEvent.click(screen.getByRole("button", { name: /Предпочтения/ }));
    fireEvent.change(screen.getByLabelText("Язык"), { target: { value: "en-US" } });
    fireEvent.change(screen.getByLabelText("Часовой пояс"), { target: { value: "Asia/Amman" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить изменения" }));

    await waitFor(() => { expect(savedBody).toMatchObject({ city: "Амман", locale: "en-US", timezone: "Asia/Amman", skills: ["FastAPI"] }); });
    expect(screen.getByText("Профиль и предпочтения сохранены")).toBeInTheDocument();
  });

  it("hides non-functional 2FA and external identity flows behind honest disabled states", async () => {
    const queries = [
      { path: "/api/v1/me", payload: { consent_scopes: [] } },
    ];
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const path = input instanceof Request ? new URL(input.url).pathname : input instanceof URL ? input.pathname : input;
      const match = queries.find((item) => item.path === path);
      if (match) return Promise.resolve(new Response(JSON.stringify(match.payload), { status: 200 }));
      return Promise.resolve(new Response(JSON.stringify({ ...profile, buddy_enabled: true }), { status: 200 }));
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ParticipantSettings actorName="Алекс Речной" consentScopes={[]} />
      </QueryClientProvider>,
    );
    await waitFor(() => { expect(screen.getByRole("button", { name: /Безопасность/ })).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole("button", { name: /Безопасность/ }));
    expect(screen.getByText("Двухфакторная аутентификация")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Недоступно в MVP" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Недоступно в MVP" }).every((element) => element.hasAttribute("disabled"))).toBe(true);
    expect(screen.getByText("Внешний вход (SSO / Google / GitHub)")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Недоступно в MVP" })).toHaveLength(2);
    expect(screen.getByText(/Не поддерживается в демо-режиме/)).toBeInTheDocument();
    expect(screen.getByText("Провайдер входа")).toBeInTheDocument();
  });

  it("splits the notification matrix into mandatory, product and marketing groups", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const path = input instanceof Request ? new URL(input.url).pathname : input instanceof URL ? input.pathname : input;
      if (path === "/api/v1/me") return Promise.resolve(new Response(JSON.stringify({ consent_scopes: [] }), { status: 200 }));
      return Promise.resolve(new Response(JSON.stringify({ ...profile, buddy_enabled: true }), { status: 200 }));
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ParticipantSettings actorName="Алекс Речной" consentScopes={[]} />
      </QueryClientProvider>,
    );
    await waitFor(() => { expect(screen.getByRole("button", { name: /Уведомления/ })).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole("button", { name: /Уведомления/ }));
    expect(screen.getByText("Обязательные")).toBeInTheDocument();
    expect(screen.getAllByText("Всегда включено")).toHaveLength(2);
    expect(screen.getByText("Продуктовые")).toBeInTheDocument();
    expect(screen.getByText("Маркетинговые")).toBeInTheDocument();
    const marketingToggle = screen.getByLabelText("Маркетинговые материалы");
    expect(marketingToggle).not.toBeChecked();
    fireEvent.click(marketingToggle);
    expect(screen.getByLabelText("Маркетинговые материалы")).toBeChecked();
    expect(screen.getByText("Статусы задач")).toBeInTheDocument();
  });

  it("persists the AI-Buddy opt-out through the profile save", async () => {
    let savedBody: Record<string, unknown> | undefined;
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const path = input instanceof Request ? new URL(input.url).pathname : input instanceof URL ? input.pathname : input;
      if (path === "/api/v1/me") return Promise.resolve(new Response(JSON.stringify({ consent_scopes: [] }), { status: 200 }));
      if (path === "/api/v1/me/profile" && init?.method === "PUT") {
        savedBody = JSON.parse(typeof init.body === "string" ? init.body : "{}") as Record<string, unknown>;
        return Promise.resolve(new Response(JSON.stringify({ ...profile, ...savedBody, skills: profile.skills }), { status: 200 }));
      }
      return Promise.resolve(new Response(JSON.stringify({ ...profile, buddy_enabled: true }), { status: 200 }));
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ParticipantSettings actorName="Алекс Речной" consentScopes={[]} />
      </QueryClientProvider>,
    );
    await waitFor(() => { expect(screen.getByRole("button", { name: /AI-Buddy/ })).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole("button", { name: /AI-Buddy/ }));
    await waitFor(() => { expect(screen.getByLabelText("AI-Buddy включён")).toBeChecked(); });
    fireEvent.click(screen.getByLabelText("AI-Buddy включён"));
    expect(screen.getByText(/Модельные вызовы остановлены/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Сохранить изменения" }));
    await waitFor(() => { expect(savedBody).toMatchObject({ buddy_enabled: false }); });
    expect(screen.getByText("Профиль и предпочтения сохранены")).toBeInTheDocument();
  });

  it("shows the opt-out panel instead of model calls when buddy is disabled", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const path = input instanceof Request ? new URL(input.url).pathname : input instanceof URL ? input.pathname : input;
      if (path === "/api/v1/me/profile") return Promise.resolve(new Response(JSON.stringify({ ...profile, buddy_enabled: false }), { status: 200 }));
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ParticipantBuddy />
      </QueryClientProvider>,
    );
    await waitFor(() => { expect(screen.getByText("AI-Buddy выключен — модельные вызовы не выполняются")).toBeInTheDocument(); });
    expect(screen.queryByText("Привет! Я вижу ваш прогресс в Python и текущий проект. Могу объяснить следующий шаг или подобрать задачу.")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Сообщение AI-Buddy")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Открыть настройки" })).toBeInTheDocument();
  });

  it("keeps the chat working when AI-Buddy stays enabled", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const path = input instanceof Request ? new URL(input.url).pathname : input instanceof URL ? input.pathname : input;
      if (path === "/api/v1/me/profile") return Promise.resolve(new Response(JSON.stringify({ ...profile, buddy_enabled: true }), { status: 200 }));
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter><ParticipantBuddy /></MemoryRouter>
      </QueryClientProvider>,
    );
    await waitFor(() => { expect(screen.getByLabelText("Сообщение AI-Buddy")).toBeInTheDocument(); });
    expect(screen.getByText(/Помогаю разбираться в задачах/)).toBeInTheDocument();
  });
});
