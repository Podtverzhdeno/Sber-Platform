import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

function renderCatalog(initialEntry = "/workspace/2?catalog_view=cards") {
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
  it("defaults to a list and still supports explicit card layout", async () => {
    renderCatalog("/workspace/2");
    expect((await screen.findAllByText(catalogItem.title)).length).toBeGreaterThan(0);
    expect(document.querySelector(".catalog-v2-results--list")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Список" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Карточки" }));
    expect(screen.getByRole("button", { name: "Карточки" })).toHaveAttribute("aria-pressed", "true");
    expect(document.querySelector(".catalog-v2-results--cards")).not.toBeNull();
  });

  it("renders authoritative match and insufficient-data states without a fake zero", async () => {
    renderCatalog();
    expect((await screen.findAllByText(catalogItem.title)).length).toBeGreaterThan(0);
    expect(screen.getAllByText("84% релевантности").length).toBeGreaterThan(0);
    expect(screen.getByText("Недостаточно данных")).toBeInTheDocument();
    expect(screen.queryByText("0% релевантности")).not.toBeInTheDocument();
    expect(screen.getByText("Доступно для отклика во всём каталоге")).toBeInTheDocument();
    expect(screen.getByText(/По 1 из 2 загруженных/)).toBeInTheDocument();
    expect(screen.getByText(/Релевантность не означает вероятность отбора/)).toBeInTheDocument();
  });

  it("does not treat unsupported or self-service tasks as mentored support", async () => {
    const unsupported = { ...catalogItem, support_model: "none" };
    const selfService = { ...insufficientItem, support_model: "self_service" };
    fetchMock.mockImplementation((input, init) => {
      const path = requestPath(input);
      if (path.startsWith("/api/v1/me/task-recommendations?")) {
        return Promise.resolve(json(catalogPage([unsupported, selfService])));
      }
      return defaultFetch(input, init);
    });
    renderCatalog();
    await screen.findAllByText(catalogItem.title);
    const kpi = screen.getByText("с поддержкой").closest(".catalog-v2-kpi");
    if (!(kpi instanceof HTMLElement)) throw new Error("Support KPI missing");
    expect(within(kpi).getByText("0")).toBeInTheDocument();
    expect(screen.getByText("Сопровождение не предусмотрено")).toBeInTheDocument();
  });

  it("labels an unverified customer without a verified-partner badge", async () => {
    const unverified = {
      ...catalogItem,
      customer: { ...catalogItem.customer, verification: "unverified" as const },
    };
    fetchMock.mockImplementation((input, init) => {
      const path = requestPath(input);
      if (path.startsWith("/api/v1/me/task-recommendations?")) {
        return Promise.resolve(json(catalogPage([unverified])));
      }
      return defaultFetch(input, init);
    });
    renderCatalog();
    expect((await screen.findAllByText(/Заказчик не верифицирован/)).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Проверенный заказчик/)).not.toBeInTheDocument();
  });

  it("uses the same projection in list layout and opens its detail", async () => {
    renderCatalog("/workspace/2?catalog_view=list");
    expect((await screen.findAllByText(catalogItem.title)).length).toBeGreaterThan(0);
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
    expect(await screen.findByRole("heading", { name: "Почему подходит" })).toBeInTheDocument();
    expect(document.querySelector(".catalog-v2-match-ring-value")).not.toBeNull();
    expect(screen.getAllByText(catalogItem.title).length).toBeGreaterThan(1);
    expect(screen.getAllByText(/R&D лаборатория · Демо-заказчик/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/9 ч 0 мин/).length).toBeGreaterThan(0);
    expect(screen.getByText(catalogItem.match.source_snapshot_version)).toBeInTheDocument();
    expect(screen.getByText(/Алгоритм: task-match-v1 · расчёт:/)).toBeInTheDocument();
  });

  it("removes a cached deep-linked detail when the server revokes access", async () => {
    let removed = false;
    fetchMock.mockImplementation((input, init) => {
      const path = requestPath(input);
      if (path.startsWith("/api/v1/me/task-recommendations?")) {
        return Promise.resolve(json(catalogPage([])));
      }
      if (path.endsWith(`/${catalogItem.task_id}`)) {
        return Promise.resolve(
          removed
            ? json({ code: "RESOURCE_NOT_FOUND", message: "Unavailable" }, 404)
            : json(catalogItem),
        );
      }
      return defaultFetch(input, init);
    });
    const { client } = renderCatalog(`/workspace/2?task=${catalogItem.task_id}`);
    expect(await screen.findByRole("heading", { name: catalogItem.title })).toBeInTheDocument();

    removed = true;
    await act(async () => {
      await client.invalidateQueries({ queryKey: ["task-catalog-v2-detail"] });
    });

    expect(await screen.findByText("Раздел недоступен")).toBeInTheDocument();
    expect(screen.queryByText(catalogItem.title)).not.toBeInTheDocument();
    expect(screen.queryByText(catalogItem.brief_summary)).not.toBeInTheDocument();
  });

  it("shares only a canonical task URL without private filter text", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    renderCatalog("/workspace/2?q=private-search");
    expect((await screen.findAllByText(catalogItem.title)).length).toBeGreaterThan(0);
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
    expect((await screen.findAllByText(catalogItem.title)).length).toBeGreaterThan(0);
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
    expect((await screen.findAllByText(catalogItem.title)).length).toBeGreaterThan(0);
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
    expect((await screen.findAllByText(catalogItem.title)).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Условия и отклик" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect((await screen.findAllByText(catalogTerms.deliverable)).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Критерии приёмки" })).toBeInTheDocument();
    for (const criterion of catalogTerms.acceptance_criteria) {
      expect(screen.getByText(criterion)).toBeInTheDocument();
    }
    expect(screen.getByText("Нагрузка в неделю")).toBeInTheDocument();
    expect(screen.getByText("4 ч 0 мин")).toBeInTheDocument();
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
    expect((await screen.findAllByText(catalogItem.title)).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Условия и отклик" }));
    const consent = await screen.findByRole("checkbox", { name: /Я прочитал/ });
    fireEvent.click(consent);
    fireEvent.click(screen.getByRole("button", { name: "Подтвердить и отправить отклик" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Условия изменились");
    const refreshed = await screen.findByRole("checkbox", { name: /версии 4/ });
    await waitFor(() => { expect(refreshed).not.toBeChecked(); });
    expect(fetchMock.mock.calls.some(([input]) => requestPath(input).endsWith("/terms-consent"))).toBe(false);
  });

  it("removes cached conditions when the terms endpoint revokes access", async () => {
    let revoked = false;
    fetchMock.mockImplementation((input, init) => {
      const path = requestPath(input);
      if (path.endsWith("/terms") && (init?.method ?? "GET") === "GET") {
        return Promise.resolve(
          revoked
            ? json({ code: "RESOURCE_NOT_FOUND", message: "Unavailable" }, 404)
            : json(catalogTerms),
        );
      }
      return defaultFetch(input, init);
    });
    const { client } = renderCatalog();
    expect((await screen.findAllByText(catalogItem.title)).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Условия и отклик" }));
    const dialog = await screen.findByRole("dialog");
    expect((await within(dialog).findAllByText(catalogTerms.deliverable)).length).toBeGreaterThan(0);

    revoked = true;
    await act(async () => {
      await client.invalidateQueries({ queryKey: ["task-catalog-v2-terms"] });
    });

    expect(await within(dialog).findByText("Раздел недоступен")).toBeInTheDocument();
    expect(within(dialog).queryAllByText(catalogTerms.deliverable)).toHaveLength(0);
    expect(within(dialog).queryByText(new RegExp(catalogItem.title))).not.toBeInTheDocument();
    expect(within(dialog).queryByText(catalogItem.customer.display_name, { exact: false })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("list", { name: "Компетенции задачи" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("serializes direction, skill and timeframe filters into the server query", async () => {
    renderCatalog();
    expect((await screen.findAllByText(catalogItem.title)).length).toBeGreaterThan(0);
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
    expect((await screen.findAllByText(catalogItem.title)).length).toBeGreaterThan(0);
    const detailButton = screen.getAllByRole("button", { name: "Подробнее" })[0];
    if (detailButton === undefined) throw new Error("Detail button is missing");
    fireEvent.click(detailButton);
    expect(await screen.findByRole("heading", { name: "Почему подходит" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Список" }));
    expect(screen.getByRole("heading", { name: "Почему подходит" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Список" })).toHaveAttribute("aria-pressed", "true");
  });

  it("opens a list row with Enter and exposes row selection semantics", async () => {
    renderCatalog("/workspace/2?catalog_view=list");
    expect((await screen.findAllByText(catalogItem.title)).length).toBeGreaterThan(0);
    const row = screen.getAllByRole("row").find((candidate) => candidate.textContent.includes(catalogItem.title));
    expect(row).toBeDefined();
    if (row === undefined) return;
    fireEvent.keyDown(row, { key: "Enter" });
    expect(await screen.findByRole("heading", { name: "Почему подходит" })).toBeInTheDocument();
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
  it("keeps catalog and selected detail in separate regions with a neutral stage plan", async () => {
    renderCatalog();
    expect((await screen.findAllByText(catalogItem.title)).length).toBeGreaterThan(0);
    const workspace = document.querySelector(".catalog-v2-workspace");
    expect(workspace).not.toBeNull();
    expect(workspace).toHaveAttribute("data-layout", "cards");
    expect(screen.getByRole("complementary", { name: "Предпросмотр рекомендованной задачи" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Работа над задачей" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Выберите задачу" })).not.toBeInTheDocument();
    const detailButton = screen.getAllByRole("button", { name: "Подробнее" })[0];
    if (detailButton === undefined) throw new Error("Detail button is missing");
    fireEvent.click(detailButton);
    expect(await screen.findByRole("heading", { name: "Работа над задачей" })).toBeInTheDocument();
    fireEvent.click(screen.getByText(/План выполнения/));
    const plannedStages = document.querySelectorAll(".catalog-v2-workflow-extra ol li");
    expect(plannedStages.length).toBe(catalogItem.stage_plan.stages.length);
    expect(screen.getByText(/Это план, а не прогресс/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Итог" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Статистика навыков задачи" })).toBeInTheDocument();
    expect(document.querySelector(".catalog-skill-stats__overview")).not.toBeNull();
    expect(screen.getByText("Оценка после проверки")).toBeInTheDocument();
  });

  it("provides readable mobile list labels without changing task ordering", async () => {
    renderCatalog("/workspace/2?catalog_view=list");
    expect((await screen.findAllByText(catalogItem.title)).length).toBeGreaterThan(0);
    const first = document.querySelector(".catalog-v2-table-row");
    expect(first?.querySelector('[data-label="Соответствие"]')).not.toBeNull();
    expect(first?.querySelector('[data-label="Срок"]')).not.toBeNull();
    expect(first?.querySelector('[data-label="Действия"]')).not.toBeNull();
  });

});
