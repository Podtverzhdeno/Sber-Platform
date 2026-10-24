import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import { Composer } from "./composer";
import { validateArtifactRef } from "./composer-model";
import { hydrateDialogDrafts, resetDialogDrafts, setDialogDraft } from "./drafts";
import { DIALOG_DRAFTS_KEY } from "./view-model";

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

  clear(): void {
    this.map.clear();
  }
}

const participants = [
  { id: "u1", display_name: "Алексей Смирнов", role: "member" },
  { id: "u2", display_name: "Ментор Е", role: "mentor" },
];

type ComposerToggles = {
  canSend?: boolean;
  sending?: boolean;
  sendState?: "idle" | "sending" | "failed";
  connectionState?: "online" | "reconnecting" | "offline";
  replySummary?: { id: string; summary: string } | null;
};

type OnSend = Mock<(payload: { body: string; artifact_refs: string[] }) => void>;

function baseProps(overrides: ComposerToggles = {}) {
  return {
    channelId: "ch-demo",
    participants,
    storage: new MemoryStorage() as unknown as Storage,
    canSend: overrides.canSend ?? true,
    sending: overrides.sending ?? false,
    sendState: overrides.sendState ?? "idle",
    connectionState: overrides.connectionState ?? "online",
    replySummary: overrides.replySummary ?? null,
  };
}

function renderComposer(overrides: ComposerToggles = {}) {
  const props = baseProps(overrides);
  const onSend: OnSend = vi.fn();
  const onClearReply = vi.fn<() => void>();
  const view = render(
    <Composer {...props} onSend={onSend} onClearReply={onClearReply} />,
  );
  const rerender = (next: ComposerToggles) => {
    view.rerender(
      <Composer
        {...props}
        {...next}
        onSend={onSend}
        onClearReply={onClearReply}
      />,
    );
  };
  return { onSend, onClearReply, storage: props.storage, rerender };
}

function textarea(): HTMLTextAreaElement {
  const area = screen.getByTestId("composer-textarea");
  if (!(area instanceof HTMLTextAreaElement)) throw new Error("нет textarea");
  return area;
}

function savedDrafts(storage: Storage): Record<string, string> {
  return JSON.parse(storage.getItem(DIALOG_DRAFTS_KEY) ?? "{}") as Record<string, string>;
}

beforeEach(() => {
  window.localStorage.clear();
  resetDialogDrafts();
});

describe("Composer", () => {
  it("восстанавливает черновик диалога из реестра", () => {
    const props = baseProps();
    hydrateDialogDrafts(props.storage, true);
    setDialogDraft(props.storage, "ch-demo", "Продолжим завтра");
    render(<Composer {...props} onSend={vi.fn()} />);
    expect(textarea().value).toBe("Продолжим завтра");
  });

  it("сохраняет черновик в реестр при вводе и при переключении диалога", () => {
    const { storage } = renderComposer();
    fireEvent.change(textarea(), { target: { value: "Набросок" } });
    expect(savedDrafts(storage)["ch-demo"]).toBe("Набросок");
  });

  it("Enter отправляет сообщение и приложенные артефакты", () => {
    const props = baseProps();
    const onSend: OnSend = vi.fn();
    render(
      <Composer
        {...props}
        connectionState="online"
        onSend={onSend}
        key="with-refs"
      />,
    );
    const area = textarea();
    fireEvent.change(area, { target: { value: "Текст задачи" } });
    fireEvent.click(screen.getByRole("button", { name: "Вложения" }));
    fireEvent.change(screen.getByTestId("composer-ref-input"), {
      target: { value: "artifact:mvp" },
    });
    fireEvent.click(screen.getByText("Добавить"));
    fireEvent.keyDown(area, { key: "Enter" });
    expect(onSend).toHaveBeenCalledTimes(1);
    const firstCall = onSend.mock.calls[0];
    if (!firstCall) throw new Error("нет вызова onSend");
    expect(firstCall[0]).toEqual({
      body: "Текст задачи",
      artifact_refs: ["artifact:mvp"],
    });
  });

  it("Shift+Enter добавляет перевод строки вместо отправки", () => {
    const { onSend } = renderComposer();
    const area = textarea();
    fireEvent.change(area, { target: { value: "Первая строка" } });
    fireEvent.keyDown(area, { key: "Enter", shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
    expect(area.value).toBe("Первая строка");
  });

  it("эмодзи-панель вставляет символ и закрывается", () => {
    const { onSend } = renderComposer();
    fireEvent.click(screen.getByRole("button", { name: "Эмодзи" }));
    fireEvent.click(screen.getByRole("button", { name: "Вставить 🙏" }));
    expect(textarea().value).toBe("🙏");
    expect(screen.queryByRole("dialog", { name: "Эмодзи" })).toBeNull();
    expect(onSend).not.toHaveBeenCalled();
  });

  it("кнопка @ действительно запускает выбор участника без ручного ввода", () => {
    renderComposer();
    fireEvent.click(screen.getByRole("button", { name: "Упомянуть участника" }));
    expect(textarea().value).toBe("@");
    const mentions = screen.getByRole("listbox", { name: "Упоминания" });
    fireEvent.click(within(mentions).getByRole("option", { name: "@Ментор Е" }));
    expect(textarea().value).toBe("@Ментор Е ");
  });

  it("@-упоминание открывает список и вставляет имя", () => {
    const { onSend } = renderComposer();
    fireEvent.change(textarea(), { target: { value: "@ал" } });
    const listbox = screen.getByTestId("composer-mentions");
    fireEvent.click(within(listbox).getByRole("option", { name: "@Алексей Смирнов" }));
    expect(textarea().value).toBe("@Алексей Смирнов ");
    expect(screen.queryByTestId("composer-mentions")).toBeNull();
    expect(onSend).not.toHaveBeenCalled();
  });

  it("вложения: добавляет, убирает и валидирует артефакты", () => {
    renderComposer();
    fireEvent.click(screen.getByRole("button", { name: "Вложения" }));
    const input = screen.getByTestId("composer-ref-input");
    fireEvent.change(input, { target: { value: "artifact:mvp" } });
    fireEvent.click(screen.getByText("Добавить"));
    expect(screen.getByTestId("composer-ref-list")).toHaveTextContent("artifact:mvp");
    fireEvent.change(input, { target: { value: "artifact:mvp" } });
    fireEvent.click(screen.getByText("Добавить"));
    expect(screen.getByTestId("composer-ref-error")).toHaveTextContent("уже прикреплён");
    fireEvent.change(input, { target: { value: "bad ref" } });
    fireEvent.click(screen.getByText("Добавить"));
    expect(screen.getByTestId("composer-ref-error")).toHaveTextContent("не должен содержать пробелов");
    fireEvent.click(screen.getByRole("button", { name: "Убрать вложение artifact:mvp" }));
    expect(screen.queryByTestId("composer-ref-list")).toBeNull();
  });

  it("read-only: композер заменяется на notice, ввод недоступен", () => {
    renderComposer({ canSend: false });
    expect(screen.getByTestId("composer-readonly")).toHaveTextContent("право писать");
    expect(screen.queryByTestId("composer-textarea")).toBeNull();
    expect(screen.queryByTestId("composer-send")).toBeNull();
  });

  it("offline блокирует отправку, восстановление связи сохраняет черновик", () => {
    const { onSend, storage, rerender } = renderComposer({ connectionState: "offline" });
    expect(screen.getByTestId("composer-offline")).toHaveTextContent("Нет соединения");
    fireEvent.change(textarea(), { target: { value: "Черновик на потом" } });
    expect(screen.getByTestId("composer-send")).toBeDisabled();
    expect(savedDrafts(storage)["ch-demo"]).toBe("Черновик на потом");
    fireEvent.click(screen.getByTestId("composer-send"));
    expect(onSend).not.toHaveBeenCalled();
    rerender({ connectionState: "online" });
    expect(screen.getByTestId("composer-send")).toBeEnabled();
    fireEvent.click(screen.getByTestId("composer-send"));
    expect(onSend).toHaveBeenCalledTimes(1);
    const offlineCall = onSend.mock.calls[0];
    if (!offlineCall) throw new Error("нет вызова onSend");
    expect(offlineCall[0].body).toBe("Черновик на потом");
  });

  it("idempotent guard: повторная отправка заблокирована на pending", () => {
    const { onSend } = renderComposer({ sending: true, sendState: "sending" });
    const send = screen.getByTestId("composer-send");
    expect(send).toBeDisabled();
    fireEvent.click(send);
    expect(onSend).toHaveBeenCalledTimes(0);
  });

  it("sending→idle: черновик и вложения очищаются после успешной отправки", () => {
    const { onSend, storage, rerender } = renderComposer();
    fireEvent.change(textarea(), { target: { value: "Очередь" } });
    fireEvent.click(screen.getByTestId("composer-send"));
    expect(onSend).toHaveBeenCalledTimes(1);
    rerender({ sendState: "sending" });
    expect(screen.getByTestId("composer-send")).toBeDisabled();
    rerender({ sendState: "idle" });
    expect(textarea().value).toBe("");
    expect(savedDrafts(storage)["ch-demo"] ?? "").toBe("");
  });

  it("failed: черновик сохраняется и ошибка показана", () => {
    const { rerender } = renderComposer();
    fireEvent.change(textarea(), { target: { value: "Важное сообщение" } });
    rerender({ sendState: "failed" });
    expect(screen.getByTestId("composer-failed")).toHaveTextContent("Не удалось");
    expect(textarea().value).toBe("Важное сообщение");
  });

  it("XSS-плейлоад отображается как текст: img не создаётся", () => {
    renderComposer();
    const payload = "<img src=x onerror=alert(1)>";
    fireEvent.change(textarea(), { target: { value: payload } });
    const container = textarea().closest(".msg-composer");
    if (!(container instanceof HTMLElement)) throw new Error("нет контейнера");
    expect(container.querySelectorAll("img")).toHaveLength(0);
    expect(textarea().value).toBe(payload);
  });

  it("reply-баннер показывает резюме и отменяет контекст", () => {
    const { onClearReply } = renderComposer({
      replySummary: { id: "m-7", summary: "Привет! Готов обсуждать." },
    });
    expect(screen.getByText(/Ответ на:/)).toHaveTextContent("Привет! Готов обсуждать.");
    fireEvent.click(screen.getByRole("button", { name: "Отменить ответ" }));
    expect(onClearReply).toHaveBeenCalledTimes(1);
  });

  describe("validateArtifactRef", () => {
    it("отклоняет пустой ключ, пробелы, дубликаты и больше 24", () => {
      expect(validateArtifactRef("  ", [])).toBe("Введите ключ артефакта");
      expect(validateArtifactRef("a b", [])).toBe("Ключ артефакта не должен содержать пробелов");
      expect(validateArtifactRef("repository", ["repository"])).toBe("Артефакт уже прикреплён");
      const full = Array.from({ length: 24 }, (_, index) => `r${String(index)}`);
      expect(validateArtifactRef("extra", full)).toBe("Не больше 24 вложений на сообщение");
      expect(validateArtifactRef("artifact:good", full.slice(0, 23))).toBeNull();
    });
  });
});
