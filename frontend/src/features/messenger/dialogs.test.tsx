import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ApiChannelView } from "./contracts";
import {
  DIALOG_DRAFTS_KEY,
  DIALOG_PREFS_KEY,
  DIALOG_SCROLL_KEY,
  type DialogPrefs,
} from "./view-model";
import { DialogList } from "./dialogs";
import {
  dialogDraftText,
  resetDialogDrafts,
  setDialogDraft,
  type DialogDrafts,
} from "./drafts";

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

function message(
  id: string,
  authorId: string | null,
  authorName: string | null,
  body: string,
  sequence: number,
  createdAt: string,
) {
  return {
    id,
    author_id: authorId,
    author_name: authorName,
    kind: "text",
    body,
    artifact_refs: [] as string[],
    sequence,
    created_at: createdAt,
  };
}

function channel(partial: Partial<ApiChannelView> & { id: string }): ApiChannelView {
  return {
    kind: "task_team",
    title: "",
    status: "active",
    task_id: null,
    role: "member",
    muted: false,
    sender_enabled: true,
    unread: 0,
    participants: [],
    last_message: null,
    created_at: "2026-10-20T09:00:00+03:00",
    ...partial,
  };
}

const CHANNELS: ApiChannelView[] = [
  channel({
    id: "ch-task",
    kind: "task_team",
    title: "Заказ №382 · команда",
    task_id: "30000000-0000-0000-0000-000000000003",
    unread: 2,
    last_message: message(
      "m-3",
      "p-roman",
      "Роман Мягков",
      "Нужен диагноз калибровки, @Алексей Смирнов, и ссылка на протокол",
      3,
      "2026-10-20T09:10:00+03:00",
    ),
    participants: [
      { id: VIEWER_ID, display_name: VIEWER_NAME, role: "member" },
      { id: "p-roman", display_name: "Роман Мягков", role: "customer" },
      { id: "p-elena", display_name: "Елена Васильева", role: "mentor" },
    ],
  }),
  channel({
    id: "ch-mute",
    kind: "operator_case",
    title: "Поддержка · стенд",
    unread: 1,
    muted: true,
    last_message: message(
      "m-2",
      "p-anna",
      "Анна Иванова",
      "Открыли второй SLA-инцидент",
      2,
      "2026-10-20T09:12:00+03:00",
    ),
    participants: [
      { id: VIEWER_ID, display_name: VIEWER_NAME, role: "support" },
      { id: "p-anna", display_name: "Анна Иванова", role: "support" },
    ],
  }),
  channel({
    id: "ch-personal",
    kind: "personal",
    title: "",
    last_message: message(
      "m-1",
      VIEWER_ID,
      VIEWER_NAME,
      "Тогда свяжемся после стенда",
      1,
      "2026-10-20T09:05:00+03:00",
    ),
    participants: [
      { id: VIEWER_ID, display_name: VIEWER_NAME, role: "member" },
      { id: "p-elena", display_name: "Елена Васильева", role: "mentor" },
    ],
  }),
  channel({
    id: "ch-closed",
    kind: "personal",
    title: "Закрытый чат",
    status: "closed",
    last_message: message(
      "m-0",
      VIEWER_ID,
      VIEWER_NAME,
      "закрыт",
      1,
      "2026-10-20T08:00:00+03:00",
    ),
    participants: [
      { id: VIEWER_ID, display_name: VIEWER_NAME, role: "member" },
      { id: "p-secret", display_name: "Скрытый Контакт", role: "member" },
    ],
  }),
];

function renderList(storage: MemoryStorage, props?: { selectedId?: string | null }) {
  const onCreateDialog = vi.fn<(peerId: string) => void>();
  const onSelect = vi.fn<(channelId: string) => void>();
  const view = render(
    <DialogList
      channels={CHANNELS}
      viewerId={VIEWER_ID}
      viewerName={VIEWER_NAME}
      selectedId={props?.selectedId ?? null}
      onSelect={onSelect}
      onCreateDialog={onCreateDialog}
      storage={storage}
    />,
  );
  return { ...view, onCreateDialog, onSelect };
}

function rowButtons(root: HTMLElement): HTMLButtonElement[] {
  return Array.from(root.querySelectorAll<HTMLButtonElement>("button.msg-dialog-list__row"));
}

function rowButtonByTitle(root: HTMLElement, title: string): HTMLButtonElement {
  const match = rowButtons(root).find((row) => row.textContent.includes(title));
  if (!match) {
    throw new Error(`Диалог «${title}» не найден`);
  }
  return match;
}

function actionButtonsOf(row: HTMLButtonElement): { pin: HTMLButtonElement; archive: HTMLButtonElement } {
  const item = row.closest(".msg-dialog-list__row-item");
  if (!(item instanceof HTMLElement)) {
    throw new Error("Строка без родителя-элемента списка");
  }
  const actions = Array.from(item.querySelectorAll<HTMLButtonElement>(".msg-dialog-list__row-action"));
  const pin = actions[0];
  const archive = actions[1];
  if (!pin || !archive) {
    throw new Error("Строка без пары действий (закрепление и архивация)");
  }
  return { pin, archive };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-20T10:00:00+03:00"));
  window.localStorage.clear();
  resetDialogDrafts();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("DialogList", () => {
  it("отображает вкладки и отсортированные строки (закреплённые, непрочитанные, упоминания)", () => {
    const storage = new MemoryStorage();
    const prefs: DialogPrefs = { pinned: { "ch-personal": true }, archived: {} };
    storage.setItem(DIALOG_PREFS_KEY, JSON.stringify(prefs));
    const { container } = renderList(storage);

    expect(screen.getByRole("tablist", { name: "Разделы диалогов" })).toBeTruthy();
    expect(rowButtons(container).length).toBe(3);
    expect(rowButtons(container)[0]?.textContent).toContain("Елена Васильева");

    const badge = container.querySelector(".msg-dialog-list__unread");
    expect(badge?.textContent ?? "").toContain("2");
    expect(container.querySelector(".msg-dialog-list__mention")?.textContent ?? "").toContain("упоминание");
    expect(container.querySelectorAll(".msg-dialog-list__row-item").length).toBe(3);
  });

  it("не показывает закрытые каналы даже при архивной метке", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      DIALOG_PREFS_KEY,
      JSON.stringify({ pinned: {}, archived: { "ch-closed": true } }),
    );
    const { container } = renderList(storage);
    fireEvent.click(screen.getByRole("tab", { name: "Архив" }));
    expect(rowButtons(container)).toHaveLength(0);
    expect(screen.getByText("Архивных диалогов нет.")).toBeTruthy();
    expect(screen.queryByText("Закрытый чат")).toBeNull();
  });

  it("фильтрует строки по поиску и озвучивает количество", () => {
    const { container } = renderList(new MemoryStorage());
    const search = screen.getByRole("searchbox", { name: "Поиск диалогов" });
    fireEvent.change(search, { target: { value: "SLA-инцидент" } });
    expect(rowButtons(container)).toHaveLength(1);
    expect(rowButtons(container)[0]?.textContent).toContain("Поддержка · стенд");
    expect(screen.getByText("Диалогов показано: 1")).toBeTruthy();
  });

  it("закрепление и архивация пишутся в storage и не теряются при перерендере", () => {
    const storage = new MemoryStorage();
    const { container, unmount } = renderList(storage);
    const supportRow = rowButtonByTitle(container, "Поддержка · стенд");
    const { pin, archive } = actionButtonsOf(supportRow);

    fireEvent.click(pin);
    const afterPin = JSON.parse(storage.getItem(DIALOG_PREFS_KEY) ?? "{}") as DialogPrefs;
    expect(afterPin.pinned["ch-mute"]).toBe(true);

    fireEvent.click(archive);
    const afterArchive = JSON.parse(storage.getItem(DIALOG_PREFS_KEY) ?? "{}") as DialogPrefs;
    expect(afterArchive.archived["ch-mute"]).toBe(true);
    expect(rowButtons(container).length).toBe(2);

    unmount();
    render(
      <DialogList
        channels={CHANNELS}
        viewerId={VIEWER_ID}
        viewerName={VIEWER_NAME}
        selectedId={null}
        onSelect={() => {}}
        storage={storage}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Архив" }));
    expect(rowButtons(screen.getByRole("list", { name: "Архивные диалоги" })).length).toBe(1);
    expect(
      rowButtons(screen.getByRole("list", { name: "Архивные диалоги" }))[0]?.textContent,
    ).toContain("Поддержка · стенд");
  });

  it("вкладка «Контакты» выводит контакты и вызывает onCreateDialog для пика", () => {
    const { container, onCreateDialog } = renderList(new MemoryStorage());
    fireEvent.click(screen.getByRole("tab", { name: "Контакты" }));
    const contacts = container.querySelectorAll(".msg-dialog-list__contacts li");
    expect(contacts.length).toBe(3);
    expect(container.textContent).toContain("Роман Мягков");
    expect(container.textContent).toContain("заказчик");

    fireEvent.click(screen.getByRole("button", { name: "Создать диалог" }));
    const menu = screen.getByRole("menu", { name: "Контакты для нового диалога" });
    const menuButton = Array.from(menu.querySelectorAll("button")).find((button) =>
      button.textContent.includes("Елена Васильева"),
    );
    if (!menuButton) {
      throw new Error("Контакт «Елена Васильева» не найден в меню");
    }
    fireEvent.click(menuButton);

    expect(onCreateDialog).toHaveBeenCalledTimes(1);
    expect(onCreateDialog).toHaveBeenCalledWith("p-elena");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("озвучивает количество контактов и учитывает поисковый запрос на вкладке «Контакты»", () => {
    const { container } = renderList(new MemoryStorage());
    fireEvent.click(screen.getByRole("tab", { name: "Контакты" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Поиск диалогов" }), {
      target: { value: "мягков" },
    });
    expect(container.querySelectorAll(".msg-dialog-list__contacts li").length).toBe(1);
    expect(screen.getByText("Контактов: 1")).toBeTruthy();
  });

  it("черновик из dialog-регистра отражается в превью строки", () => {
    const storage = new MemoryStorage();
    storage.setItem(DIALOG_DRAFTS_KEY, JSON.stringify({ "ch-task": "Уточню по заказу" }));
    const { container } = renderList(storage);
    expect(container.textContent).toContain("Черновик: Уточню по заказу");
    const draftsDump = JSON.parse(storage.getItem(DIALOG_DRAFTS_KEY) ?? "{}") as DialogDrafts;
    expect(dialogDraftText(draftsDump, "ch-task")).toBe("Уточню по заказу");
  });

  it("обновляет превью при записи черновика через общий регистр", async () => {
    const storage = new MemoryStorage();
    const { container } = renderList(storage);
    expect(container.textContent).not.toContain("Черновик:");
    await act(() => {
      setDialogDraft(storage, "ch-mute", "Беру на себя тикет");
      return Promise.resolve();
    });
    expect(container.textContent).toContain("Черновик: Беру на себя тикет");
  });

  it("клавиатура: стрелки перемещают фокус по строкам, Escape закрывает меню", () => {
    const { container } = renderList(new MemoryStorage());
    const rows = rowButtons(container);
    expect(rows.length).toBeGreaterThan(0);
    const first = rows[0];
    const second = rows[1];
    if (!first || !second) {
      throw new Error("Нет двух строк для навигации");
    }
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowDown" });
    expect(document.activeElement).toBe(second);
    fireEvent.keyDown(second, { key: "Home" });
    expect(document.activeElement).toBe(first);

    fireEvent.click(screen.getByRole("button", { name: "Создать диалог" }));
    const menu = screen.getByRole("menu");
    fireEvent.keyDown(menu, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("пишет позицию прокрутки в storage и хранит её между установками", () => {
    const storage = new MemoryStorage();
    const first = renderList(storage);
    const scrollPane = first.container.querySelector(".msg-dialog-list__scroll") as HTMLElement;
    scrollPane.scrollTop = 40;
    fireEvent.scroll(scrollPane);
    expect(storage.getItem(DIALOG_SCROLL_KEY)).toBe("40");

    first.unmount();
    const second = renderList(storage);
    const restoredPane = second.container.querySelector(
      ".msg-dialog-list__scroll",
    ) as HTMLElement;
    expect(restoredPane.scrollTop).toBe(40);
    expect(storage.getItem(DIALOG_SCROLL_KEY)).toBe("40");

    restoredPane.scrollTop = 80;
    fireEvent.scroll(restoredPane);
    expect(storage.getItem(DIALOG_SCROLL_KEY)).toBe("80");
  });

  it("выбранная строка помечена aria-current и вызывает onSelect", () => {
    const { container, onSelect } = renderList(new MemoryStorage(), { selectedId: "ch-task" });
    const rows = rowButtons(container);
    expect(rows.length).toBeGreaterThan(0);
    const selected = rows.find((row) => row.getAttribute("aria-current") === "true");
    if (!selected) {
      throw new Error("Не найдена выбранная строка");
    }
    expect(selected.textContent).toContain("Заказ №382 · команда");
    const first = rows[0];
    if (!first) {
      throw new Error("Нет первой строки для выбора");
    }
    fireEvent.click(first);
    expect(onSelect).toHaveBeenCalledWith("ch-task");
  });
});
