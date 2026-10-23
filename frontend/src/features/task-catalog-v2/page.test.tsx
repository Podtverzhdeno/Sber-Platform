import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { clearApiReadCache } from "../../api/client";
import { catalogItem, catalogPage, catalogTerms, insufficientItem } from "./fixture";
import { TaskCatalogV2 } from "./page";

const fetchMock = vi.fn<typeof fetch>();

function requestPath(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function requestBody(init?: RequestInit): string {
  return typeof init?.body === "string" ? init.body : "";
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function defaultFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const path = requestPath(input);
  const method = init?.method ?? "GET";
  if (path.startsWith("/api/v1/me/task-recommendations?")) {
    const params = new URLSearchParams(path.split("?")[1]);
    if (params.get("q") === "none") return Promise.resolve(json(catalogPage([])));
    if (params.get("saved") === "true") return Promise.resolve(json(catalogPage([insufficientItem])));
    return Promise.resolve(json(catalogPage([catalogItem, insufficientItem])));
  }
  if (path.endsWith("/terms") && method === "GET") return Promise.resolve(json(catalogTerms));
  if (path.endsWith("/terms/revalidate")) return Promise.resolve(json({ terms_version: 3 }));
  if (path.endsWith("/terms-consent")) return Promise.resolve(json({}));
  if (path.endsWith("/applications")) return Promise.resolve(json({ status: "applied" }));
  if (path.endsWith("/bookmark")) {
    const body = JSON.parse(requestBody(init)) as { saved: boolean };
    return Promise.resolve(json({ task_id: catalogItem.task_id, saved: body.saved }));
  }
  if (path.includes("/api/v1/me/task-recommendations/")) {
    return Promise.resolve(json(path.endsWith("102") ? insufficientItem : catalogItem));
  }
  return Promise.resolve(json({ code: "NOT_FOUND", message: "Not found" }, 404));
}

function renderCatalog(initialEntry = "/workspace/2") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onOpenWorkspace = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <TaskCatalogV2 onOpenWorkspace={onOpenWorkspace} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { client, onOpenWorkspace };
}

beforeEach(() => {
  sessionStorage.clear();
  sessionStorage.setItem("impulse_csrf", "test-csrf");
  clearApiReadCache();
  fetchMock.mockReset();
  fetchMock.mockImplementation(defaultFetch);
  vi.stubGlobal("fetch", fetchMock);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("task catalog v2", () => {
  it("renders authoritative match and insufficient-data states without a fake zero", async () => {
    renderCatalog();
    expect(await screen.findByText(catalogItem.title)).toBeInTheDocument();
    expect(screen.getByText("84% релевантности")).toBeInTheDocument();
    expect(screen.getByText("Недостаточно данных")).toBeInTheDocument();
    expect(screen.queryByText("0% релевантности")).not.toBeInTheDocument();
    expect(screen.getByText("доступно для отклика · из 2")).toBeInTheDocument();
    expect(screen.getByText(/Период: без ограничения/)).toBeInTheDocument();
    expect(screen.getByText(/не обещает отбор, оффер или найм/)).toBeInTheDocument();
  });

  it("uses the same projection in list layout and opens its detail", async () => {
    renderCatalog("/workspace/2?catalog_view=list");
    expect(await screen.findByText(catalogItem.title)).toBeInTheDocument();
    expect(document.querySelector(".catalog-v2-results--list")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Список" })).toHaveAttribute("aria-pressed", "true");
    const rows = document.querySelectorAll<HTMLElement>(".catalog-v2-table-row");
    const firstRow = rows[0];
    if (firstRow === undefined) throw new Error("List row is missing");
    firstRow.focus();
    fireEvent.keyDown(firstRow, { key: "ArrowDown" });
    expect(rows[1]).toHaveFocus();
    const detailButton = screen.getAllByRole("button", { name: "Подробнее" })[0];
    if (detailButton === undefined) throw new Error("Detail button is missing");
    fireEvent.click(detailButton);
    expect(await screen.findByRole("heading", { name: "Почему задача рекомендована" })).toBeInTheDocument();
    expect(document.querySelector(".catalog-v2-match-ring-value")).not.toBeNull();
    expect(screen.getAllByText(catalogItem.title).length).toBeGreaterThan(1);
  });

  it("shares only a canonical task URL without private filter text", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    renderCatalog("/workspace/2?q=private-search");
    expect(await screen.findByText(catalogItem.title)).toBeInTheDocument();
    const shareButtons = screen.getAllByRole("button", { name: "Поделиться" });
    const shareButton = shareButtons[0];
    if (shareButton === undefined) throw new Error("Share button is missing");
    fireEvent.click(shareButton);
    await waitFor(() => { expect(writeText).toHaveBeenCalledOnce(); });
    const copied = String(writeText.mock.calls[0]?.[0]);
    expect(copied).toContain(`task=${catalogItem.task_id}`);
    expect(copied).not.toContain("private-search");
    expect(copied).not.toContain("q=");
  });

  it("loads the next keyset page without duplicate task keys", async () => {
    fetchMock.mockImplementation((input, init) => {
      const path = requestPath(input);
      if (path.startsWith("/api/v1/me/task-recommendations?")) {
        const params = new URLSearchParams(path.split("?")[1]);
        return Promise.resolve(json(params.get("cursor") === "next"
          ? catalogPage([insufficientItem])
          : catalogPage([catalogItem], "next")));
      }
      return defaultFetch(input, init);
    });
    renderCatalog();
    expect(await screen.findByText(catalogItem.title)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Показать ещё" }));
    expect(await screen.findByText(insufficientItem.title)).toBeInTheDocument();
    expect(document.querySelectorAll(".catalog-v2-results > [role=\"listitem\"]")).toHaveLength(2);
  });

  it("shows an honest filtered empty state", async () => {
    renderCatalog("/workspace/2?q=none");
    expect(await screen.findByRole("heading", { name: "Подходящих задач не найдено" })).toBeInTheDocument();
    expect(screen.getByText(/не подставляем демонстрационные задачи/)).toBeInTheDocument();
  });

  it("persists a bookmark through the CSRF-protected server mutation", async () => {
    renderCatalog();
    expect(await screen.findByText(catalogItem.title)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    expect(await screen.findByText(/Задача сохранена/)).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([input, init]) =>
      requestPath(input).endsWith("/bookmark")
      && init?.method === "PUT"
      && requestBody(init).includes('"saved":true')
      && new Headers(init.headers).get("X-CSRF-Token") === "test-csrf"
    )).toBe(true);
  });

  it("requires explicit consent and runs revalidate, accept and canonical apply", async () => {
    renderCatalog();
    expect(await screen.findByText(catalogItem.title)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Условия и отклик" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(await screen.findByText(catalogTerms.deliverable)).toBeInTheDocument();
    expect(screen.getByText(/Нагрузка в неделю: 4 ч 0 мин/)).toBeInTheDocument();
    const submit = screen.getByRole("button", { name: "Подтвердить и отправить отклик" });
    expect(submit).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: /Я прочитал/ }));
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    expect(await screen.findByText(/Отклик отправлен заказчику/)).toBeInTheDocument();
    const mutations = fetchMock.mock.calls.filter(([input]) => {
      const path = requestPath(input);
      return path.endsWith("/terms/revalidate") || path.endsWith("/terms-consent") || path.endsWith("/applications");
    }).map(([input]) => requestPath(input));
    expect(mutations).toEqual([
      `/api/v1/me/task-recommendations/${catalogItem.task_id}/terms/revalidate`,
      `/api/v1/me/tasks/${catalogItem.task_id}/terms-consent`,
      `/api/v1/me/tasks/${catalogItem.task_id}/applications`,
    ]);
    const applyCall = fetchMock.mock.calls.find(([input]) => requestPath(input).endsWith("/applications"));
    expect(applyCall).toBeDefined();
    if (applyCall !== undefined) {
      const key = new Headers(applyCall[1]?.headers).get("Idempotency-Key");
      expect(key).toMatch(/^apply:|^[0-9a-f-]{36}$/);
    }
  });

  it("reloads terms and clears consent after TERMS_CHANGED", async () => {
    let termsReads = 0;
    fetchMock.mockImplementation((input, init) => {
      const path = requestPath(input);
      if (path.endsWith("/terms") && (init?.method ?? "GET") === "GET") {
        termsReads += 1;
        return Promise.resolve(json(termsReads === 1 ? catalogTerms : { ...catalogTerms, terms_version: 4, version_token: '"terms-marker-2"' }));
      }
      if (path.endsWith("/terms/revalidate")) {
        return Promise.resolve(json({ code: "TERMS_CHANGED", message: "Условия изменились" }, 409));
      }
      return defaultFetch(input, init);
    });
    renderCatalog();
    expect(await screen.findByText(catalogItem.title)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Условия и отклик" }));
    const consent = await screen.findByRole("checkbox", { name: /Я прочитал/ });
    fireEvent.click(consent);
    fireEvent.click(screen.getByRole("button", { name: "Подтвердить и отправить отклик" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Условия изменились");
    const refreshed = await screen.findByRole("checkbox", { name: /версии 4/ });
    await waitFor(() => { expect(refreshed).not.toBeChecked(); });
    expect(fetchMock.mock.calls.some(([input]) => requestPath(input).endsWith("/terms-consent"))).toBe(false);
  });

  it("serializes direction, skill and timeframe filters into the server query", async () => {
    renderCatalog();
    expect(await screen.findByText(catalogItem.title)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Навык"), { target: { value: "python" } });
    fireEvent.change(screen.getByLabelText("Направление"), { target: { value: "ml" } });
    fireEvent.change(screen.getByLabelText("Срок"), { target: { value: "30d" } });
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([input]) => {
        const path = requestPath(input);
        if (!path.startsWith("/api/v1/me/task-recommendations?")) return false;
        const params = new URLSearchParams(path.split("?")[1]);
        return params.get("competency") === "python" && params.get("direction") === "ml" && params.get("timeframe") === "30d";
      })).toBe(true);
    });
  });

  it("preserves the selected task when switching cards and list layouts", async () => {
    renderCatalog();
    expect(await screen.findByText(catalogItem.title)).toBeInTheDocument();
    const detailButton = screen.getAllByRole("button", { name: "Подробнее" })[0];
    if (detailButton === undefined) throw new Error("Detail button is missing");
    fireEvent.click(detailButton);
    expect(await screen.findByRole("heading", { name: "Почему задача рекомендована" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Список" }));
    expect(screen.getByRole("heading", { name: "Почему задача рекомендована" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Список" })).toHaveAttribute("aria-pressed", "true");
  });

  it("opens a list row with Enter and exposes row selection semantics", async () => {
    renderCatalog("/workspace/2?catalog_view=list");
    expect(await screen.findByText(catalogItem.title)).toBeInTheDocument();
    const row = screen.getAllByRole("row").find((candidate) => candidate.textContent.includes(catalogItem.title));
    expect(row).toBeDefined();
    if (row === undefined) return;
    fireEvent.keyDown(row, { key: "Enter" });
    expect(await screen.findByRole("heading", { name: "Почему задача рекомендована" })).toBeInTheDocument();
    expect(row).toHaveAttribute("aria-selected", "true");
  });

  it("traps focus in conditions and returns it to the trigger on Escape", async () => {
    renderCatalog();
    const trigger = await screen.findByRole("button", { name: "Условия и отклик" });
    fireEvent.click(trigger);
    const close = await screen.findByRole("button", { name: "Закрыть условия" });
    await waitFor(() => { expect(close).toHaveFocus(); });
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => { expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); });
    expect(trigger).toHaveFocus();
  });
});

