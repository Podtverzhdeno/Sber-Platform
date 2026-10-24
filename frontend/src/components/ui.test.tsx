import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Badge, Card, DataTable, Drawer, Funnel, Modal, SafeExternalLink, StatePanel, Timeline, Tooltip } from "./ui";

describe("UI foundation", () => {
  it("blocks executable and data URL schemes", () => {
    render(<SafeExternalLink href="javascript:alert(1)">unsafe</SafeExternalLink>);
    expect(screen.getByRole("link", { name: /unsafe/ })).toHaveAttribute("href", "#");
  });

  it("renders every product state with an actionable explanation", () => {
    for (const kind of ["loading", "empty", "restricted", "stale", "error", "offline"] as const) {
      const { unmount } = render(<StatePanel kind={kind} action="Продолжить" />);
      expect(screen.getByRole("heading", { level: 2 })).toBeVisible();
      expect(screen.getByRole("button", { name: "Продолжить" })).toBeEnabled();
      unmount();
    }
  });

  it("provides semantic cards, tables, timeline and funnel", () => {
    render(<><Badge tone="success">Проверено</Badge><Card title="Результат"><p>Описание</p></Card><DataTable caption="Проекты" headers={["Название"]} rows={[["R&D"]]} /><Timeline items={[{ title: "Старт", detail: "Сегодня" }]} /><Funnel label="Воронка участника" steps={[{ label: "Начали", value: 10 }, { label: "Завершили", value: 5 }]} /></>);
    expect(screen.getByRole("table", { name: "Проекты" })).toBeVisible();
    expect(screen.getByRole("img", { name: "Воронка участника" })).toBeVisible();
    expect(screen.getByText("Сегодня")).toBeVisible();
  });

  it("supports keyboard-focused tooltip and dialog dismissal", () => {
    const close = vi.fn();
    render(<><Tooltip label="Подробное пояснение">Проверено</Tooltip><Modal title="Подтверждение" open onClose={close}><p>Проверка</p></Modal></>);
    expect(screen.getByRole("button", { name: "Закрыть" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(close).toHaveBeenCalledOnce();
    expect(screen.getByRole("tooltip")).toHaveTextContent("Подробное пояснение");
  });

  it("uses safe external-link attributes and exposes drawer semantics", () => {
    render(<><SafeExternalLink href="https://example.test">Источник</SafeExternalLink><Drawer title="Детали" open onClose={() => undefined}><p>Содержимое</p></Drawer></>);
    const link = screen.getByRole("link", { name: /Источник/ });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByRole("dialog", { name: "Детали" })).toHaveAttribute("aria-modal", "true");
  });
  it("cycles focus within a dialog and returns it to the opener", () => {
    const close = vi.fn();
    const dialog = (open: boolean) => (
      <>
        <button type="button">Открыть параметры</button>
        <Modal title="Параметры" open={open} onClose={close}>
          <button type="button">Первое действие</button>
          <button type="button">Последнее действие</button>
        </Modal>
      </>
    );
    const { rerender } = render(dialog(false));
    const opener = screen.getByRole("button", { name: "Открыть параметры" });
    opener.focus();
    rerender(dialog(true));
    const modal = screen.getByRole("dialog", { name: "Параметры" });
    const closer = screen.getByRole("button", { name: "Закрыть" });
    const last = screen.getByRole("button", { name: "Последнее действие" });
    expect(closer).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(modal, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
    fireEvent.keyDown(modal, { key: "Tab" });
    expect(closer).toHaveFocus();
    rerender(dialog(false));
    expect(opener).toHaveFocus();
    expect(document.body.style.overflow).not.toBe("hidden");
  });

});
