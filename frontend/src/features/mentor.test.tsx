import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { MessagingWorkspace } from "./collaboration";
import {
  MentorAnalytics,
  MentorAssistant,
  MentorParticipants,
  MentorProjects,
  MentorWeekPlan,
} from "./mentor";

describe("mentor workspace", () => {
  it("switches project and participant inspectors", () => {
    const { unmount } = render(
      <MemoryRouter>
        <MentorProjects />
      </MemoryRouter>,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Ассистент базы знаний/ }),
    );
    expect(screen.getAllByText("RAG evaluation").length).toBeGreaterThan(0);
    unmount();
    render(
      <MemoryRouter>
        <MentorParticipants />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Илья Кузнецов/ }));
    expect(
      screen.getByText("Нет активности по исправлению 3 дня"),
    ).toBeInTheDocument();
  });

  it("keeps AI output editable and creates a meeting", () => {
    const { unmount } = render(
      <MemoryRouter>
        <MentorAssistant />
      </MemoryRouter>,
    );
    const draft = screen.getByRole("textbox", {
      name: "Редактируемый AI-черновик",
    });
    fireEvent.change(draft, {
      target: { value: "Проверенный человеком черновик" },
    });
    expect(draft).toHaveValue("Проверенный человеком черновик");
    unmount();
    render(
      <MemoryRouter>
        <MentorWeekPlan />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Назначить встречу/ }));
    fireEvent.click(
      screen.getByRole("button", { name: "Создать и уведомить" }),
    );
    expect(screen.getByText("Встреча создана")).toBeInTheDocument();
  });

  it("opens analytics drill-down and loads real messaging channels", async () => {
    const { unmount } = render(
      <MemoryRouter>
        <MentorAnalytics />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Медиана ответа/ }));
    expect(
      screen.getByText("review decisions + assignments"),
    ).toBeInTheDocument();
    unmount();

    const viewerId = "e39256e2-6f56-5c58-9e73-b7b0d1a4b946";
    const channelId = "b6a24e2f-8a0e-4a41-9cea-5f5a2e39a113";
    const channels = [
      {
        id: channelId,
        kind: "task_team",
        title: "Рекомендательная система",
        status: "active",
        task_id: "30000000-0000-0000-0000-000000000003",
        role: "member",
        muted: false,
        sender_enabled: true,
        unread: 2,
        participants: [
          { id: viewerId, display_name: "Елена Наставник", role: "mentor" },
          {
            id: "7cf6de52-be5a-4c6f-b082-84ef2fb9079c",
            display_name: "Алекс Речной",
            role: "member",
          },
        ],
        last_message: {
          id: "5a1e2f2e-1c1b-4f14-a918-73fbb1097bf4",
          author_id: null,
          author_name: null,
          kind: "system",
          body: "Чат команды создан.",
          artifact_refs: [],
          sequence: 1,
          created_at: "2026-10-17T09:12:00+00:00",
        },
        created_at: "2026-10-17T09:00:00+00:00",
      },
    ];
    const messages = [
      {
        id: "6d1f3a3f-2d2c-4152-b029-84fcb2986cf5",
        author_id: viewerId,
        author_name: "Елена Наставник",
        kind: "text",
        body: "Пришлите сравнение метрик до пятницы.",
        artifact_refs: [],
        sequence: 2,
        created_at: "2026-10-17T09:40:00+00:00",
      },
      {
        id: "702f4b4f-3e3d-4363-b130-95fbcb086ea6",
        author_id: "7cf6de52-be5a-4c6f-b082-84ef2fb9079c",
        author_name: "Алекс Речной",
        kind: "text",
        body: "Прототип готов, выгружаю метрики.",
        artifact_refs: ["repository"],
        sequence: 3,
        created_at: "2026-10-17T09:52:00+00:00",
      },
    ];
    const contextPayload = {
      project_key: "impulse-demo",
      task_title: "Рекомендательная система",
      deadline_at: "2026-10-24T18:00:00+00:00",
      contribution_version: 3,
      contribution_accepted: false,
      review_status: "proposed",
    };
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      let body: unknown;
      let status = 200;
      if (url.includes("/read") || url.includes("/mute")) {
        body = { ...channels[0], unread: 0 };
      } else if (url.includes("/context")) {
        body = contextPayload;
      } else if (url.includes("/messages")) {
        body = messages;
      } else if (url.replace(/\/$/, "").endsWith("/channels")) {
        body = channels;
      } else {
        body = undefined;
        status = 404;
      }
      return Promise.resolve(new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }));
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock;
    try {
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      render(
        <MemoryRouter initialEntries={["/workspace/8"]}>
          <QueryClientProvider client={client}>
            <MessagingWorkspace
              role="mentor"
              personId={viewerId}
              quickTargets={{ task: 3, review: 1, plan: 6 }}
            />
          </QueryClientProvider>
        </MemoryRouter>,
      );
      await waitFor(() => {
        expect(
          screen
            .getAllByRole("button", { name: /Рекомендательная система/ })
            .some((el) => el.classList.contains("msg-dialog-list__row")),
        ).toBe(true);
      });
      const row = screen
        .getAllByRole("button", { name: /Рекомендательная система/ })
        .find((el) => el.classList.contains("msg-dialog-list__row"));
      if (!row) throw new Error("dialog row not found");
      fireEvent.click(row);
      await waitFor(() => {
        expect(
          screen.getByText("Пришлите сравнение метрик до пятницы."),
        ).toBeInTheDocument();
      });
      expect(screen.getByText("Прототип готов, выгружаю метрики.")).toBeInTheDocument();
      expect(screen.getAllByText("repository").length).toBeGreaterThan(0);

      expect(screen.getByText("Все")).toBeVisible();
      fireEvent.click(screen.getByRole("tab", { name: "Архив" }));
      // The currently opened conversation remains visible in the detail header.
      // Archive filtering applies to the dialogue list, not the open header.
      expect(
        screen.queryAllByRole("button", { name: /Рекомендательная система/ })
          .some((button) => button.classList.contains("msg-dialog-list__row")),
      ).toBe(false);
      fireEvent.click(screen.getByRole("tab", { name: /^Все/ }));
      await waitFor(() => {
        expect(
          screen
            .getAllByRole("button", { name: /Рекомендательная система/ })
            .some((el) => el.classList.contains("msg-dialog-list__row")),
        ).toBe(true);
      });

      expect(screen.getByText(/версия 3 · ожидает приёмки/)).toBeVisible();
      expect(screen.getByText("Оценка ожидает подтверждения")).toBeVisible();
      expect(screen.getAllByText("repository").length).toBeGreaterThan(0);
      expect(screen.getByTestId("context-disclaimer")).toBeVisible();
      expect(screen.getByRole("button", { name: "Открыть вклад задачи" })).toBeEnabled();
      const reviewButton = screen.getByRole("button", { name: "Открыть workspace оценки" });
      expect(reviewButton).toBeEnabled();
      expect(screen.getByRole("button", { name: "Запланировать встречу" })).toBeEnabled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
