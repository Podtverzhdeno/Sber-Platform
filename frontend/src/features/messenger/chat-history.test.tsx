import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ApiChannelView, ApiMessageView } from "./contracts";
import { CHAT_PINS_KEY, CHAT_REACTIONS_KEY } from "./chat-model";
import { ChatHistory } from "./chat-history";

const VIEWER_ID = "u-alex";
const VIEWER_NAME = "Алексей Смирнов";

class MemoryStorage {
  private map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }
}

type ChatFixtureMessage = ApiMessageView & {
  edited?: boolean;
  reply_to?: { author: string; body: string };
};

function message(partial: Partial<ChatFixtureMessage> & { id: string; sequence: number }): ChatFixtureMessage {
  return {
    author_id: "p-elena",
    author_name: "Елена Васильева",
    kind: "text",
    body: "Сообщение",
    artifact_refs: [] as string[],
    created_at: "2026-10-20T09:10:00+03:00",
    ...partial,
  };
}

function channelView(): ApiChannelView {
  return {
    id: "ch-task",
    kind: "task_team",
    title: "Заказ №382 · команда",
    status: "active",
    task_id: "30000000-0000-0000-0000-000000000003",
    role: "member",
    muted: false,
    sender_enabled: true,
    unread: 0,
    participants: [
      { id: VIEWER_ID, display_name: VIEWER_NAME, role: "member" },
      { id: "p-elena", display_name: "Елена Васильева", role: "mentor" },
    ],
    last_message: null,
    created_at: "2026-10-20T09:00:00+03:00",
  };
}

const BASE_HISTORY: ChatFixtureMessage[] = [
  message({
    id: "m-0",
    sequence: 1,
    body: "Диалог открыт системно",
    kind: "system",
    author_id: null,
    author_name: null,
    created_at: "2026-10-20T09:01:00+03:00",
  }),
  message({
    id: "m-1",
    sequence: 2,
    body: "Привет! Готов обсуждать.",
    created_at: "2026-10-20T09:05:00+03:00",
  }),
  message({
    id: "m-2",
    sequence: 3,
    body: "Тоже готов. Свяжемся после стенда.",
    author_id: VIEWER_ID,
    author_name: VIEWER_NAME,
    created_at: "2026-10-20T09:06:00+03:00",
  }),
];

function renderChat(
  storage: MemoryStorage,
  overrides?: Partial<
    Parameters<typeof ChatHistory>[0] & {
      messages?: readonly (ApiMessageView & { edited?: boolean; reply_to?: { author: string; body: string } })[];
    }
  >,
) {
  const onLoadOlder = vi.fn<() => void>();
  const onReply = vi.fn<(messageId: string) => void>();
  const onRetryPending = vi.fn<(messageId: string) => void>();
  const props: Parameters<typeof ChatHistory>[0] = {
    channel: channelView(),
    viewerId: VIEWER_ID,
    messages: overrides?.messages ?? BASE_HISTORY,
    storage,
    onLoadOlder,
    onReply,
    onRetryPending,
    ...overrides,
  };
  const view = render(<ChatHistory {...props} />);
  return { ...view, onLoadOlder, onReply, onRetryPending };
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ChatHistory", () => {
  it("names a direct chat after the other participant, not both people in the backend title", () => {
    const direct: ApiChannelView = {
      ...channelView(),
      kind: "personal",
      title: "Алексей Смирнов, Елена Васильева",
      task_id: null,
    };
    const { container } = renderChat(new MemoryStorage(), { channel: direct });
    expect(container.querySelector(".msg-chat__header-title strong")?.textContent).toBe("Елена Васильева");
    expect(container.querySelector(".msg-chat__avatar")?.textContent).toBe("Е");
    expect(container.querySelector(".msg-chat__header-title")?.textContent).not.toContain("Алексей Смирнов");
  });

  it("отображает состояния: загрузка, пусто, read-only и offline баннер", () => {
    const storage = new MemoryStorage();
    const initial = renderChat(storage, { isLoadingInitial: true, messages: [] });
    expect(initial.container.textContent).toContain("Загружаем историю");
    initial.unmount();

    const empty = renderChat(storage, { messages: [] });
    expect(empty.container.textContent).toContain("Сообщений пока нет.");
    empty.unmount();

    const readonly = renderChat(storage, { canSend: false });
    expect(readonly.container.textContent).toContain("только для чтения");
    readonly.unmount();

    const offline = renderChat(storage, { connectionState: "offline" });
    expect(offline.container.textContent).toContain("Нет сети");
  });

  it("делит историю датами и на сервисные события, группирует и маркирует доставку последнего исходящего", () => {
    const storage = new MemoryStorage();
    const { container } = renderChat(storage);
    const rows = container.querySelectorAll(".msg-chat__rows > li");
    expect(rows[0]?.className).toContain("divider");
    expect(rows[1]?.className).toContain("service");

    const groups = container.querySelectorAll(".msg-chat__group");
    expect(groups[0]?.textContent).toContain("Елена Васильева");
    expect(groups[1]?.className).toContain("outgoing");
    expect(container.querySelector(".msg-chat__delivered")?.textContent ?? "").toContain("доставлено");
    expect(container.querySelectorAll(".msg-chat__group-author")).toHaveLength(2);
  });

  it("показывает marker «изменено» и reply-превью из контракта расширений", () => {
    const storage = new MemoryStorage();
    const messages: ApiMessageView[] = [
      message({
        id: "m-1",
        sequence: 1,
        body: "Уточнил состав команды.",
        author_id: VIEWER_ID,
        author_name: VIEWER_NAME,
      }),
      message({
        id: "m-2",
        sequence: 2,
        body: "Принято.",
        edited: true,
        reply_to: { author: "Вы", body: "Уточнил состав команды." },
      }),
    ];
    const { container } = renderChat(storage, { messages });
    expect(container.textContent).toContain("изменено");
    expect(container.textContent).toContain("Уточнил состав команды.");
    expect(container.querySelectorAll(".msg-chat__reply")).toHaveLength(1);
  });

  it("подсвечивает упоминания в теле сообщения", () => {
    const storage = new MemoryStorage();
    const messages: ApiMessageView[] = [
      message({ id: "m-1", sequence: 1, body: "Обсудим @Алексей Смирнов после стенда" }),
    ];
    const { container } = renderChat(storage, { messages });
    const mention = container.querySelector(".msg-chat__mention");
    expect(mention?.textContent ?? "").toContain("@Алексей");
  });

  it("выводит ссылки на артефакты в сообщении чипами", () => {
    const storage = new MemoryStorage();
    const messages: ApiMessageView[] = [
      message({ id: "m-1", sequence: 1, body: "Прототип готов.", artifact_refs: ["repository", "review-sheet"] }),
    ];
    const { container } = renderChat(storage, { messages });
    const chips = container.querySelectorAll(".msg-chat__artifact-ref");
    expect(chips).toHaveLength(2);
    expect(chips[0]?.textContent ?? "").toContain("repository");
    expect(chips[1]?.textContent ?? "").toContain("review-sheet");
  });

  it("реакции живут локально, отображаются чипами и объявляются текстом", () => {
    const storage = new MemoryStorage();
    const { container } = renderChat(storage);
    const action = Array.from(container.querySelectorAll<HTMLButtonElement>(".msg-chat__action"))
      .find((button) => button.getAttribute("title")?.includes("Поставить реакцию 👍"));
    if (!action) throw new Error("Нет кнопки реакции");
    fireEvent.click(action);
    const chip = container.querySelector(".msg-chat__reaction");
    expect(chip?.textContent ?? "").toContain("👍");
    expect(chip?.textContent ?? "").toContain("Реакция 👍: 1");
    const collapsed = JSON.parse(storage.getItem(CHAT_REACTIONS_KEY) ?? "{}") as Record<
      string,
      Record<string, string[]>
    >;
    expect(collapsed["m-1"]?.["👍"]).toEqual(["Вы"]);

    fireEvent.click(chip as HTMLElement);
    expect(JSON.parse(storage.getItem(CHAT_REACTIONS_KEY) ?? "{\"m-1\":{}}")).toEqual({ "m-1": {} });
  });

  it("закрепляет сообщение и выводит панель закреплённого", () => {
    const storage = new MemoryStorage();
    const { container } = renderChat(storage);
    const pin = Array.from(container.querySelectorAll<HTMLButtonElement>(".msg-chat__action"))
      .find((button) => button.getAttribute("title") === "Закрепить сообщение");
    if (!pin) throw new Error("Нет кнопки закрепления");
    fireEvent.click(pin);
    expect(container.textContent).toContain("Тоже готов. Свяжемся после стенда.");
    const pins = JSON.parse(storage.getItem(CHAT_PINS_KEY) ?? "{}") as Record<string, string>;
    expect(pins["ch-task"]).toBe("m-1");
    expect(container.textContent).toContain("Привет! Готов обсуждать.");

    const unpin = screen.getAllByRole("button", { name: "Снять закрепление сообщения" })[0];
    if (!(unpin instanceof HTMLElement)) throw new Error("Нет кнопки снятия закрепления");
    fireEvent.click(unpin);
    expect(storage.getItem(CHAT_PINS_KEY)).toBe("{}");
  });

  it("подгружает старую историю поScroll'у, склеивает дубли и не прыгает экраном", async () => {
    const storage = new MemoryStorage();
    const { onLoadOlder, rerender } = renderChat(storage, { hasMoreOlder: true });
    const scrollPane = document.querySelector(".msg-chat__scroll") as HTMLElement;
    scrollPane.scrollTop = 0;
    fireEvent.scroll(scrollPane);
    expect(onLoadOlder).toHaveBeenCalledTimes(1);

    const olderPage: ApiMessageView[] = [
      message({ id: "m-1", sequence: 2, body: "Привет! Готов обсуждать." }),
      message({ id: "m-2", sequence: 3, body: "Тоже готов. Свяжемся после стенда.", author_id: VIEWER_ID, author_name: VIEWER_NAME }),
      message({
        id: "m-0",
        sequence: 1,
        body: "Диалог открыт системно",
        kind: "system",
        author_id: null,
        author_name: null,
        created_at: "2026-10-20T09:01:00+03:00",
      }),
    ];
    await act(() => {
      rerender(
        <ChatHistory
          channel={channelView()}
          viewerId={VIEWER_ID}
          messages={[...BASE_HISTORY, ...olderPage, ...BASE_HISTORY]}
          storage={storage}
          hasMoreOlder={false}
          onLoadOlder={onLoadOlder}
          onReply={vi.fn<(messageId: string) => void>()}
          onRetryPending={vi.fn<(messageId: string) => void>()}
        />,
      );
      return Promise.resolve();
    });
    await waitFor(() => {
      expect(document.querySelectorAll(".msg-chat__bubble").length).toBe(2);
    });
    expect(scrollPane.scrollTop).toBe(0);
  });

  it("показывает ненавязчивый индикатор «новые ниже» при входящих издалека", () => {
    const storage = new MemoryStorage();
    const { container, rerender } = renderChat(storage);
    const scrollPane = document.querySelector(".msg-chat__scroll") as HTMLElement;
    Object.defineProperty(scrollPane, "scrollHeight", { configurable: true, get: () => 1200 });
    Object.defineProperty(scrollPane, "clientHeight", { configurable: true, get: () => 200 });
    scrollPane.scrollTop = 100;
    fireEvent.scroll(scrollPane);

    const fresh: ApiMessageView = message({
      id: "m-3",
      sequence: 4,
      body: "Новое сообщение снизу",
    });
    rerender(
      <ChatHistory
        channel={channelView()}
        viewerId={VIEWER_ID}
        messages={[...BASE_HISTORY, fresh]}
        storage={storage}
        onLoadOlder={vi.fn<() => void>()}
        onReply={vi.fn<(messageId: string) => void>()}
        onRetryPending={vi.fn<(messageId: string) => void>()}
      />,
    );
    const pill = container.querySelector(".msg-chat__below-jump");
    expect(pill?.textContent ?? "").toContain("Новые сообщения: 1");
    fireEvent.click(pill as HTMLElement);
    expect(container.querySelector(".msg-chat__below-jump")).toBeNull();
    expect(scrollPane.scrollTop).toBe(1200);
  });

  it("поиск по загруженной истории фильтрует и озвучивает количество", () => {
    const storage = new MemoryStorage();
    const { container } = renderChat(storage);
    fireEvent.click(screen.getAllByRole("button", { name: "Поиск в чате" })[0] as Element);
    const input = screen.getByRole("searchbox", { name: "Поиск по сообщениям чата" });
    fireEvent.change(input, { target: { value: "стенд" } });
    expect(document.querySelectorAll(".msg-chat__bubble").length).toBe(1);
    expect(container.textContent).toContain("Найдено сообщений: 1 из 3");
    fireEvent.change(input, { target: { value: "несуществующее слово" } });
    expect(container.textContent).toContain("По этому запросу ничего не найдено.");
  });

  it("отмечает статусы ожидания отправки и позволяет повторить неудавшийся", () => {
    const storage = new MemoryStorage();
    const { container, rerender, onRetryPending } = renderChat(storage, {
      messages: [],
      pendingMessages: [
        { id: "p-1", body: "Короткое сообщение", author: "Вы", state: "failed" },
      ],
    });
    expect(container.textContent).toContain("Не отправлено");
    const retry = Array.from(container.querySelectorAll<HTMLButtonElement>(".msg-chat__action"))
      .find((button) => button.getAttribute("title") === "Отправить повторно");
    if (!retry) throw new Error("Нет кнопки повтора");
    fireEvent.click(retry);
    expect(onRetryPending).toHaveBeenCalledWith("p-1");

    rerender(
      <ChatHistory
        channel={channelView()}
        viewerId={VIEWER_ID}
        messages={[]}
        storage={storage}
        pendingMessages={[{ id: "p-1", body: "Короткое сообщение", author: "Вы", state: "sending" }]}
        onLoadOlder={vi.fn<() => void>()}
        onReply={vi.fn<(messageId: string) => void>()}
        onRetryPending={onRetryPending}
      />,
    );
    expect(container.textContent).toContain("Отправляется");
  });
});
