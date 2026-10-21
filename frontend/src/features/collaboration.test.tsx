import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MessagingWorkspace } from "./collaboration";

const channelId = "00000000-0000-0000-0000-000000000101";

const channelFixture = {
  id: channelId,
  kind: "task_team",
  title: "Команда проекта Альфа",
  status: "active",
  task_id: "task-alpha",
  role: "member",
  muted: false,
  sender_enabled: true,
  unread: 0,
  participants: [
    { id: "person-safe", display_name: "Участник проекта", role: "member" },
  ],
  last_message: {
    id: "message-last",
    author_id: "person-safe",
    author_name: "Участник проекта",
    kind: "text",
    body: "Проверяемый статус проекта",
    artifact_refs: [],
    sequence: 1,
    created_at: "2026-10-20T09:00:00Z",
  },
  created_at: "2026-10-20T08:00:00Z",
};

const messageFixture = {
  id: "message-last",
  author_id: "person-safe",
  author_name: "Участник проекта",
  kind: "text",
  body: "Проверяемый статус проекта",
  artifact_refs: [],
  sequence: 1,
  created_at: "2026-10-20T09:00:00Z",
};

const personalChannelId = "00000000-0000-0000-0000-000000000102";

type ChannelFixture = Omit<typeof channelFixture, "task_id" | "last_message"> & {
  task_id: string | null;
  last_message: typeof channelFixture.last_message | null;
};

const personalChannelFixture: ChannelFixture = {
  ...channelFixture,
  id: personalChannelId,
  kind: "personal",
  title: "Личный диалог",
  task_id: null,
  last_message: null,
  created_at: "2026-10-20T07:00:00Z",
};

afterEach(() => {
  vi.restoreAllMocks();
  window.sessionStorage.clear();
  window.localStorage.clear();
});

function mockMessagingApi(channels: ChannelFixture[] = [channelFixture]) {
  vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
    const path = input instanceof Request ? new URL(input.url).pathname : String(input);
    if (path === "/api/v1/me/messaging/channels") {
      return Promise.resolve(new Response(JSON.stringify(channels), { status: 200 }));
    }
    for (const channel of channels) {
      if (path === `/api/v1/me/messaging/channels/${channel.id}/messages`) {
        return Promise.resolve(new Response(JSON.stringify(channel.last_message ? [messageFixture] : []), { status: 200 }));
      }
    }
    return Promise.resolve(new Response(null, { status: 404 }));
  });
}

function renderWorkspace(role: "participant" | "mentor" = "participant") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MessagingWorkspace role={role} personId={personIdFor(role)} />
    </QueryClientProvider>,
  );
}

function personIdFor(role: "participant" | "mentor"): string {
  return role === "participant" ? "viewer-safe" : "mentor-safe";
}

type MediaState = { narrow: boolean };
type Matches = { matches: boolean };

function narrowMode(state: MediaState): void {
  const mediaQuery = (query: string): Matches => ({
    matches: query.includes("max-width: 959px") ? state.narrow : false,
  });
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      ...mediaQuery(query),
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
}

describe("SberChat-style messenger shell", () => {
  it("renders safe API data in three panes and lets the user collapse context", async () => {
    window.history.replaceState({}, "", "/workspace/10");
    mockMessagingApi();
    renderWorkspace();

    expect((await screen.findAllByText("Проверяемый статус проекта")).length).toBeGreaterThan(0);
    const container = document.querySelector('[data-visual-reference="R-MSG-01"]');
    expect(container).not.toBeNull();
    expect(screen.getByRole("complementary", { name: "Список диалогов" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Текущий чат" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Контекст диалога" })).toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: "Скрыть контекст" });
    fireEvent.click(toggle);
    await waitFor(() => {
      expect(screen.queryByRole("complementary", { name: "Контекст диалога" })).not.toBeInTheDocument();
    });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("mobile single-pane: выбор диалога открывает чат, назад возвращается к списку", async () => {
    const state = { narrow: true };
    narrowMode(state);
    mockMessagingApi();
    renderWorkspace();
    await screen.findByText("Команда проекта Альфа");
    expect(screen.queryByRole("region", { name: /Текущий чат/ })).toBeNull();
    const mobileRow = screen.getAllByRole("button", { name: /Команда проекта Альфа/ })[0];
    if (!mobileRow) throw new Error("диалоговая строка не найдена");
    fireEvent.click(mobileRow);
    await screen.findByRole("region", { name: "Текущий чат" });
    expect(screen.queryByRole("complementary", { name: "Список диалогов" })).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: /К списку диалогов/ })[0] as Element);
    await screen.findByRole("complementary", { name: "Список диалогов" });
    state.narrow = false;
  });

  it("выбор диалога сохраняется в sessionStorage (Back и theme switch не теряют состояние)", async () => {
    window.sessionStorage.clear();
    mockMessagingApi();
    renderWorkspace();
    const list = await screen.findByRole("complementary", { name: "Список диалогов" });
    const row = within(list)
      .getAllByRole("button", { name: /Команда проекта Альфа/ })
      .find((el) => el.classList.contains("msg-dialog-list__row"));
    if (!row) throw new Error("диалоговая строка не найдена");
    fireEvent.click(row);
    await waitFor(() => {
      expect(window.sessionStorage.getItem("impulse.messenger.selected-channel")).toBe(channelId);
    });
  });

  it("Escape закрывает поиск в чате и очищает запрос", async () => {
    mockMessagingApi();
    renderWorkspace();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Поиск в чате" })).toBeTruthy();
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Поиск в чате" })[0] as Element);
    const input = await screen.findByRole("searchbox", { name: "Поиск по сообщениям чата" });
    fireEvent.change(input, { target: { value: "проекта" } });
    await screen.findByText(/Найдено сообщений/);
    fireEvent.keyDown(input, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("searchbox", { name: "Поиск по сообщениям чата" })).toBeNull();
    });
  });

  it("глубокая ссылка ?task=<task_id> открывает чат команды задачи, а не первый диалог", async () => {
    window.history.replaceState({}, "", "/workspace/10?task=task-alpha");
    mockMessagingApi([personalChannelFixture, channelFixture]);
    renderWorkspace();

    await screen.findByRole("region", { name: "Текущий чат · Команда проекта Альфа" });
    expect(screen.getByRole("region", { name: "Текущий чат · Команда проекта Альфа" })).toBeInTheDocument();
    expect(window.sessionStorage.getItem("impulse.messenger.selected-channel")).toBe(channelId);
  });
});
