import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CustomerWorkspace } from "./customer";

type Task = {
  id: string;
  status: string;
  title: string;
  deadline_at: string;
  application_count: number;
  assignment_count: number;
  pending_result_count: number;
  accepted_result_count: number;
};

const taskEconomy = {
  id: "task-economy",
  project_key: "proj-demo",
  task_key: "economy",
  title: "Оптимизация логистики региона",
  status: "published",
  nominated_mentor_id: null,
  support_mode: "platform",
  support_assignee_id: null,
  places: 3,
  application_count: 5,
  assignment_count: 2,
  pending_result_count: 1,
  accepted_result_count: 0,
  deadline_at: "2026-11-02T18:00:00Z",
};

const taskKnowledge = {
  id: "task-knowledge",
  project_key: "proj-demo",
  task_key: "knowledge",
  title: "Ревизия базы знаний поддержки",
  status: "published",
  nominated_mentor_id: null,
  support_mode: "platform",
  support_assignee_id: null,
  places: 2,
  application_count: 1,
  assignment_count: 0,
  pending_result_count: 0,
  accepted_result_count: 0,
  deadline_at: "2026-12-01T18:00:00Z",
};

const detail = (task: Task) => ({
  task,
  problem: "Собрать факты и посчитать эффект.",
  deliverable: "Прототип с метриками.",
  acceptance_criteria: ["Сравнение на данных"],
  data_constraints: "Демо-данные",
  ip_terms: "Авторство сохраняется",
  terms: { version: 1, deadline_at: task.deadline_at, compensation: { paid: false, base_amount_per_assignee: null, b_total: null, a_total: null } },
  applications: [{ id: "app-1", task_id: task.id, person_id: "p-alex", accepted_terms_version: 1, status: "applied", version: 1 }],
  assignments: [{ id: "asg-1", status: "active" }],
  contributions: [{ id: "c-1", personal_summary: "Сравнительный бенчмарк маршрутов.", status: "submitted", artifact_keys: ["repo"] }],
  decisions: [],
});

const analytics = {
  metrics: [
    { key: "customer_acceptance_rate", value: "67", numerator: 2, denominator: 3, unit: "percent" },
    { key: "customer_active_people", value: "4", numerator: 4, denominator: 4, unit: "people" },
  ],
};
const supportCatalog = {
  version: 1,
  models: [
    { code: "platform", name: "Сопровождение платформы", responsible: "Операционная команда платформы", activities: ["Маршрутизация вопросов", "Контроль статусов", "Эскалация блокеров"], response_time: "Ответ в течение 1 рабочего дня", restrictions: ["Не заменяет предметного ментора", "Не принимает результат за заказчика"], available: true, unavailable_reason: null, requires_assignee: false },
    { code: "assigned_mentor", name: "Назначенный ментор", responsible: "Выбранный ментор", activities: ["Checkpoint-сессии", "Ревью evidence"], response_time: "Ответ в течение 2 рабочих дней", restrictions: ["Требуется назначение"], available: true, unavailable_reason: null, requires_assignee: true },
    { code: "expert_consultations", name: "Экспертные консультации", responsible: "Эксперт", activities: ["Консультация"], response_time: "По расписанию", restrictions: ["Без регулярного ведения"], available: false, unavailable_reason: "Нет свободного экспертного пула", requires_assignee: false },
    { code: "customer_self", name: "Самостоятельное ведение заказчиком", responsible: "Заказчик", activities: ["Ответы на вопросы"], response_time: "По условиям", restrictions: ["Доступность обеспечивает заказчик"], available: true, unavailable_reason: null, requires_assignee: false },
  ],
};

function mockHome(
  tasks: Task[],
  createTask?: (body: Record<string, unknown>) => { id: string; status: string },
  applicationsOverride?: { id: string; task_id: string; person_id: string; accepted_terms_version: number; status: string; version: number; participant_name: string; verified_case_count: number }[],
  assistant?: (body: Record<string, unknown>) => Record<string, unknown> | Response,
) {
  return vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
    const path = input instanceof Request ? new URL(input.url).pathname : input instanceof URL ? input.pathname : input;
    const method = init?.method ?? "GET";
    if (path === "/api/v1/customer/projects/impulse-demo/tasks" && method === "POST" && createTask) {
      const rawBody = typeof init?.body === "string" ? init.body : "{}";
      const body = JSON.parse(rawBody) as Record<string, unknown>;
      return Promise.resolve(new Response(JSON.stringify(createTask(body)), { status: 200 }));
    }
    if (path === "/api/v1/me/assistant/customer-brief" && method === "POST" && assistant) {
      const rawBody = typeof init?.body === "string" ? init.body : "{}";
      const body = JSON.parse(rawBody) as Record<string, unknown>;
      const result = assistant(body);
      return Promise.resolve(result instanceof Response ? result : new Response(JSON.stringify(result), { status: 200 }));
    }
    if (path === "/api/v1/customer/tasks") {
      return Promise.resolve(new Response(JSON.stringify(tasks), { status: 200 }));
    }
    if (path === "/api/v1/config") {
      return Promise.resolve(new Response(JSON.stringify({ demo_mode: false }), { status: 200 }));
    }
    if (path === "/api/v1/analytics/role") {
      return Promise.resolve(new Response(JSON.stringify(analytics), { status: 200 }));
    }
    if (path === "/api/v1/customer/support-models") {
      return Promise.resolve(new Response(JSON.stringify(supportCatalog), { status: 200 }));
    }
    const match = /^\/api\/v1\/customer\/tasks\/([\w-]+)(\/applications)?$/.exec(path);
    if (match) {
      const task = tasks.find((item) => item.id === match[1]) ?? tasks[0];
      if (match[2]) {
        const payload = applicationsOverride ?? (task ? [detail(task).applications[0]] : []);
        return Promise.resolve(new Response(JSON.stringify(payload), { status: 200 }));
      }
      return Promise.resolve(new Response(JSON.stringify(detail(task ?? taskEconomy)), { status: 200 }));
    }
    return Promise.resolve(new Response(null, { status: 404 }));
  });
}

afterEach(() => { vi.restoreAllMocks(); });
beforeEach(() => { localStorage.clear(); });

function renderHome() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CustomerWorkspace />
    </QueryClientProvider>,
  );
}

function firstElement(list: HTMLElement[]): HTMLElement {
  const item = list[0];
  if (!item) throw new Error("Expected at least one element");
  return item;
}

function itemAt<T>(list: T[], index: number): T {
  const item = list[index];
  if (item === undefined) throw new Error(`Expected element at index ${String(index)}`);
  return item;
}

describe("customer home", () => {
  it("explains support models and disables unavailable policy options", async () => {
    mockHome([taskEconomy]);
    renderHome();
    await waitFor(() => { expect(screen.getAllByText("Оптимизация логистики региона").length).toBeGreaterThan(0); });
    fireEvent.click(screen.getByRole("button", { name: "+ Создать задачу" }));
    fireEvent.change(screen.getByLabelText("Название"), { target: { value: "Новая задача" } });
    fireEvent.change(screen.getByLabelText("Компетенции кейса через запятую"), { target: { value: "AI" } });
    fireEvent.click(screen.getByRole("button", { name: "Далее" }));
    fireEvent.change(screen.getByLabelText("Проблема"), { target: { value: "Нужно проверить гипотезу." } });
    fireEvent.change(screen.getByLabelText("Результат"), { target: { value: "Проверяемый прототип." } });
    fireEvent.change(screen.getByLabelText("Критерии приёмки построчно"), { target: { value: "Есть метрика" } });
    fireEvent.click(screen.getByRole("button", { name: "Далее" }));
    fireEvent.click(screen.getByRole("button", { name: "Далее" }));
    const selector = await screen.findByLabelText("Модель поддержки");
    expect(selector).toHaveValue("platform");
    expect(screen.getByText("Операционная команда платформы")).toBeInTheDocument();
    expect(screen.getByText(/Не заменяет предметного ментора/)).toBeInTheDocument();
    const expert = screen.getByRole("option", { name: /Экспертные консультации/ });
    expect(expert).toBeDisabled();
    fireEvent.change(selector, { target: { value: "assigned_mentor" } });
    expect(screen.getByLabelText("Назначение")).toHaveValue("request");
    expect(screen.getByText(/Checkpoint-сессии/)).toBeInTheDocument();
  });

  it("renders domain KPIs, deadlines and opens the priority task from CTA", async () => {
    mockHome([taskEconomy, taskKnowledge]);
    renderHome();

    await waitFor(() => { expect(screen.getAllByText("Оптимизация логистики региона").length).toBeGreaterThan(0); });
    for (const label of ["Опубликовано", "В работе", "На проверке", "Принято"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.getByText("Ближайшая задача под вашим контролем")).toBeInTheDocument();
    expect(screen.getByText(/результат(а|ов) ждут решения/)).toBeInTheDocument();
    expect(screen.getAllByText("Заявок").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Дедлайн").length).toBeGreaterThan(0);
    expect(screen.getByText("Доля принятых")).toBeInTheDocument();
    await waitFor(() => { expect(screen.getByText("67%")).toBeInTheDocument(); });
    expect(screen.getByText("2 из 3")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Открыть задачу →" }));
    await waitFor(() => { expect(screen.getByText("Прототип с метриками.")).toBeInTheDocument(); });
    expect(screen.getByText("Собрать факты и посчитать эффект.")).toBeInTheDocument();
    expect(screen.getByText("Заявки на выбранную задачу")).toBeInTheDocument();
    expect(screen.getByText("Принял условия версии 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Принять в работу" })).toBeInTheDocument();
  });

  it("shows the honest empty state without demo projection when demo_mode is false", async () => {
    mockHome([]);
    renderHome();

    await waitFor(() => { expect(screen.getAllByText("Здесь пока пусто").length).toBeGreaterThan(0); });
    expect(screen.queryByText("Ближайшая задача под вашим контролем")).not.toBeInTheDocument();
    expect(screen.queryByText("Прототип рекомендательной системы для научных статей")).not.toBeInTheDocument();
  });

  it("walks the five-step wizard, saves a draft and returns to the saved step", async () => {
    const created: Record<string, unknown>[] = [];
    mockHome([taskEconomy], (body) => {
      created.push(body);
      return { id: "task-new", status: "draft" };
    });
    renderHome();

    await waitFor(() => { expect(screen.getAllByText("Оптимизация логистики региона").length).toBeGreaterThan(0); });
    fireEvent.click(screen.getByRole("button", { name: "+ Создать задачу" }));
    expect(screen.getByText("Шаг 1 из 5")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Название"), { target: { value: "Дашборд продаж ритейла" } });
    expect(screen.getByLabelText("Название")).toHaveValue("Дашборд продаж ритейла");
    fireEvent.change(screen.getByLabelText("Компетенции кейса через запятую"), { target: { value: "NLP, CV" } });
    fireEvent.click(screen.getByRole("button", { name: "Далее" }));
    expect(screen.getByText("Шаг 2 из 5")).toBeInTheDocument();
    await screen.findByText("Проблема");

    fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
    fireEvent.click(screen.getByRole("button", { name: "+ Создать задачу" }));
    await screen.findByText("Шаг 2 из 5");
    fireEvent.click(screen.getByRole("button", { name: "Назад" }));
    expect(screen.getByText("Шаг 1 из 5")).toBeInTheDocument();
    expect(screen.getByLabelText("Название")).toHaveValue("Дашборд продаж ритейла");
    fireEvent.click(screen.getByRole("button", { name: "Далее" }));
    await screen.findByText("Проблема");

    fireEvent.change(screen.getByLabelText("Проблема"), { target: { value: "Продажи не сопоставлены с воронкой." } });
    fireEvent.change(screen.getByLabelText("Результат"), { target: { value: "Прототип дашборда." } });
    fireEvent.change(screen.getByLabelText("Критерии приёмки построчно"), { target: { value: "Сравнение на данных\nМетрика выше базовой" } });
    fireEvent.click(screen.getByRole("button", { name: "Далее" }));
    expect(screen.getByText("Шаг 3 из 5")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Рубрика · результат"), { target: { value: "Дашборд" } });
    fireEvent.change(screen.getByLabelText("Рубрика · ход решения"), { target: { value: "Описание шагов" } });
    fireEvent.change(screen.getByLabelText("Рубрика · неопределённость"), { target: { value: "Ограничения данных" } });
    fireEvent.change(screen.getByLabelText("Рубрика · использование ИИ"), { target: { value: "ИИ не использовался" } });
    fireEvent.change(screen.getByLabelText("Рубрика · защита решения"), { target: { value: "Защита перед заказчиком" } });
    fireEvent.click(screen.getByRole("button", { name: "Далее" }));
    expect(screen.getByText("Шаг 4 из 5")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Мест для участников"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Далее" }));
    expect(screen.getByText("Шаг 5 из 5")).toBeInTheDocument();
    expect(screen.getByText("Условия: версия 1 · открытая заявка")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Сохранить черновик" }));
    await waitFor(() => {
      expect(created[0]).toMatchObject({
        title: "Дашборд продаж ритейла",
        mode: "open",
        competency_tags: ["NLP", "CV"],
        acceptance_criteria: ["Сравнение на данных", "Метрика выше базовой"],
        places: 3,
      });
    });
    expect(screen.queryByText("Шаг 5 из 5")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "+ Создать задачу" }));
    await screen.findByText("Шаг 1 из 5");
    expect(screen.getByLabelText("Название")).toHaveValue("");
  });

  it("blocks publication of an incomplete brief at the final step", async () => {
    mockHome([]);
    renderHome();

    await waitFor(() => { expect(screen.getAllByText("Здесь пока пусто").length).toBeGreaterThan(0); });
    fireEvent.click(screen.getByRole("button", { name: "+ Создать задачу" }));
    fireEvent.change(screen.getByLabelText("Название"), { target: { value: "Неполный бриф" } });
    fireEvent.change(screen.getByLabelText("Компетенции кейса через запятую"), { target: { value: "NLP" } });
    fireEvent.click(screen.getByRole("button", { name: "Далее" }));
    fireEvent.change(screen.getByLabelText("Проблема"), { target: { value: "Проблема сформулирована." } });
    fireEvent.change(screen.getByLabelText("Результат"), { target: { value: "Результат описан." } });
    fireEvent.change(screen.getByLabelText("Критерии приёмки построчно"), { target: { value: "Проверка линии\nДанные без конфликтов" } });
    fireEvent.click(screen.getByRole("button", { name: "Далее" }));
    fireEvent.click(screen.getByRole("button", { name: "Далее" }));
    fireEvent.change(screen.getByLabelText("Мест для участников"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Далее" }));
    expect(screen.getByText("Предпросмотр участника")).toBeInTheDocument();
    await waitFor(() => { expect(screen.getByTestId("wizard-brief-complete")).toHaveTextContent(/количество мест/); });
    const publish = screen.getByRole("button", { name: "Отправить на модерацию" });
    expect(publish).toBeDisabled();
  });

  it("labels novice applications honestly and keeps a shortlist per task", async () => {
    const applications = [
      { id: "app-alex", task_id: "task-economy", person_id: "p-alex", accepted_terms_version: 1, status: "applied", version: 2, participant_name: "Алекс Речной", verified_case_count: 2 },
      { id: "app-igor", task_id: "task-economy", person_id: "p-igor", accepted_terms_version: 1, status: "applied", version: 1, participant_name: "Игорь Лесной", verified_case_count: 0 },
      { id: "app-maria", task_id: "task-economy", person_id: "p-maria", accepted_terms_version: 1, status: "accepted", version: 3, participant_name: "Мария Ковалёва", verified_case_count: 1 },
    ];
    mockHome([taskEconomy, taskKnowledge], undefined, applications);
    renderHome();

    await waitFor(() => { expect(screen.getAllByText("Оптимизация логистики региона").length).toBeGreaterThan(0); });
    fireEvent.click(screen.getByRole("button", { name: "Открыть задачу →" }));
    await waitFor(() => { expect(screen.getAllByTestId("application-row").length).toBe(3); });
    expect(screen.getByText("Кейсов подтверждено: 2")).toBeInTheDocument();
    expect(screen.getByText("Опыт не подтверждён")).toBeInTheDocument();
    expect(screen.getByText("Игорь Лесной")).toBeInTheDocument();

    fireEvent.click(firstElement(screen.getAllByTestId("shortlist-toggle")));
    expect(firstElement(screen.getAllByTestId("shortlist-toggle"))).toHaveTextContent("Убрать из шорт-листа");

    fireEvent.click(screen.getByRole("button", { name: "Ожидают решения" }));
    expect(screen.queryByText("Мария Ковалёва")).not.toBeInTheDocument();
    expect(screen.getByText("Алекс Речной")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Принятые" }));
    expect(screen.getByText("Мария Ковалёва")).toBeInTheDocument();
    expect(screen.queryByText("Алекс Речной")).not.toBeInTheDocument();

    fireEvent.click(firstElement(screen.getAllByRole("button", { name: "Закрыть" })));
    await waitFor(() => { expect(screen.queryByTestId("application-row")).not.toBeInTheDocument(); });
    fireEvent.click(screen.getByRole("button", { name: "Открыть задачу →" }));
    fireEvent.click(itemAt(screen.getAllByRole("button", { name: "Все" }), 1));
    await waitFor(() => { expect(screen.getAllByTestId("application-row").length).toBe(3); });
    expect(screen.getAllByTestId("shortlist-toggle")[0]).toHaveTextContent("Убрать из шорт-листа");
  });
});

describe("customer ai draft hint", () => {
  it("suggests an editable ai draft and inserts it after explicit approval", async () => {
    let saveCalls = 0;
    mockHome([taskEconomy], () => {
      saveCalls += 1;
      return { id: "unexpected-save", status: "draft" };
    }, undefined, () => ({
      kind: "customer_brief",
      editable: true,
      problem: "Найти релевантные статьи по запросу исследователя",
      deliverable: "Прототип поиска",
      acceptance_criteria: ["Precision@10 >= 0.7"],
      notice: "Черновик от AI можно редактировать; публикация возможна только человеком.",
      gateway_called: true,
    }));
    renderHome();

    await waitFor(() => { expect(screen.getAllByText("Оптимизация логистики региона").length).toBeGreaterThan(0); });
    fireEvent.click(screen.getByRole("button", { name: "+ Создать задачу" }));
    fireEvent.change(screen.getByLabelText("Название"), { target: { value: "Поиск статей" } });
    fireEvent.change(screen.getByLabelText("Компетенции кейса через запятую"), { target: { value: "NLP" } });
    fireEvent.click(screen.getByRole("button", { name: "Далее" }));
    await screen.findByText("Проблема");

    fireEvent.click(screen.getByRole("button", { name: "AI-подсказка по брифу" }));
    await waitFor(() => {
      const element = document.getElementById("wizard-ai-problem") as HTMLTextAreaElement | null;
      expect(element?.value.startsWith("Найти")).toBe(true);
    });
    fireEvent.change(screen.getByTestId("wizard-ai-problem"), { target: { value: "Найти статьи быстро" } });
    fireEvent.click(screen.getByRole("button", { name: "Вставить в бриф" }));
    expect(screen.getByLabelText("Проблема")).toHaveValue("Найти статьи быстро");
    expect(screen.getByLabelText("Результат")).toHaveValue("Прототип поиска");
    expect(screen.getByLabelText("Критерии приёмки построчно")).toHaveValue("Precision@10 >= 0.7");
    expect(saveCalls).toBe(0);
  });

  it("sends a versioned field snapshot and blocks a stale patch without changing the draft", async () => {
    const requests: Record<string, unknown>[] = [];
    mockHome([taskEconomy], undefined, undefined, (body) => {
      requests.push(body);
      return {
        kind: "customer_brief",
        editable: true,
        problem: "AI формулировка",
        deliverable: null,
        acceptance_criteria: [],
        notice: "Черновик от AI можно редактировать.",
        gateway_called: true,
        suggestion_id: "suggestion-1",
        draft_version: body.draft_version,
        patches: [{
          target_field: "problem",
          before: "Исходная формулировка",
          field_version: body.draft_version,
          proposed_text: "AI формулировка",
          reason: "Уточнить аудиторию.",
          source_version: "customer-brief-v1",
          prompt_version: "customer-brief-prompt-v1",
        }],
      };
    });
    renderHome();
    await waitFor(() => { expect(screen.getAllByText("Оптимизация логистики региона").length).toBeGreaterThan(0); });
    fireEvent.click(screen.getByRole("button", { name: "+ Создать задачу" }));
    fireEvent.change(screen.getByLabelText("Название"), { target: { value: "Поиск статей" } });
    fireEvent.change(screen.getByLabelText("Компетенции кейса через запятую"), { target: { value: "NLP" } });
    fireEvent.click(screen.getByRole("button", { name: "Далее" }));
    fireEvent.change(screen.getByLabelText("Проблема"), { target: { value: "Исходная формулировка" } });
    fireEvent.click(screen.getByRole("button", { name: "AI-подсказка по брифу" }));
    await screen.findByDisplayValue("AI формулировка");
    expect(requests[0]).toMatchObject({
      fields: { problem: "Исходная формулировка", deliverable: "", criterion: "" },
    });
    expect(Number(requests[0]?.draft_version)).toBeGreaterThan(1);

    fireEvent.change(screen.getByLabelText("Проблема"), { target: { value: "Изменено человеком после генерации" } });
    fireEvent.click(screen.getByRole("button", { name: "Вставить в бриф" }));
    expect(screen.getByLabelText("Проблема")).toHaveValue("Изменено человеком после генерации");
    expect(screen.getByTestId("wizard-ai-stale")).toHaveTextContent("Автоматическое применение заблокировано");
    expect(screen.queryByTestId("wizard-ai-applied")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Обновить рекомендацию" })).toBeInTheDocument();
  });

  it("keeps fields unchanged on quota and offers retry or manual continuation", async () => {
    mockHome([taskEconomy], undefined, undefined, () => new Response(JSON.stringify({ code: "ASSISTANT_QUOTA_EXCEEDED", message: "Лимит", request_id: "test", retryable: true }), { status: 429 }));
    renderHome();
    await waitFor(() => { expect(screen.getAllByText("Оптимизация логистики региона").length).toBeGreaterThan(0); });
    fireEvent.click(screen.getByRole("button", { name: "+ Создать задачу" }));
    fireEvent.change(screen.getByLabelText("Название"), { target: { value: "Поиск статей" } });
    fireEvent.change(screen.getByLabelText("Компетенции кейса через запятую"), { target: { value: "NLP" } });
    fireEvent.click(screen.getByRole("button", { name: "Далее" }));
    fireEvent.change(screen.getByLabelText("Проблема"), { target: { value: "Текст человека" } });
    fireEvent.click(screen.getByRole("button", { name: "AI-подсказка по брифу" }));
    await waitFor(() => { expect(screen.getByTestId("wizard-ai-error")).toHaveTextContent("Лимит AI-помощника исчерпан"); });
    expect(screen.getByLabelText("Проблема")).toHaveValue("Текст человека");
    expect(screen.queryByTestId("wizard-ai-applied")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Повторить анализ" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Продолжить вручную" })).toBeInTheDocument();
  });
});

describe("customer ai applied provenance", () => {
  it("marks applied fragments with textual and programmatic proof, lists before/after and stays idempotent", async () => {
    mockHome([taskEconomy], undefined, undefined, () => ({
      kind: "customer_brief",
      editable: true,
      problem: "Найти релевантные статьи по запросу исследователя",
      deliverable: "Прототип поиска",
      acceptance_criteria: ["Precision@10 >= 0.7"],
      notice: "Черновик от AI можно редактировать; публикация возможна только человеком.",
      gateway_called: true,
    }));
    renderHome();

    await waitFor(() => { expect(screen.getAllByText("Оптимизация логистики региона").length).toBeGreaterThan(0); });
    fireEvent.click(screen.getByRole("button", { name: "+ Создать задачу" }));
    fireEvent.change(screen.getByLabelText("Название"), { target: { value: "Поиск статей" } });
    fireEvent.change(screen.getByLabelText("Компетенции кейса через запятую"), { target: { value: "NLP" } });
    fireEvent.click(screen.getByRole("button", { name: "Далее" }));
    await screen.findByText("Проблема");

    expect(screen.queryByText("Фрагменты от AI-подсказки")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Проблема"), { target: { value: "Старая формулировка" } });
    fireEvent.click(screen.getByRole("button", { name: "AI-подсказка по брифу" }));
    await waitFor(() => {
      const element = document.getElementById("wizard-ai-problem") as HTMLTextAreaElement | null;
      expect(element?.value.startsWith("Найти")).toBe(true);
    });
    fireEvent.click(screen.getByRole("button", { name: "Вставить в бриф" }));

    expect(screen.getAllByTestId("wizard-ai-applied").length).toBe(3);
    for (const flag of screen.getAllByTestId("wizard-ai-applied")) {
      expect(flag).toHaveTextContent("Добавлено AI");
    }
    const problemField = document.getElementById("wizard-problem-input") as HTMLTextAreaElement;
    expect(problemField.value).toBe("Найти релевантные статьи по запросу исследователя");
    const describedBy = problemField.getAttribute("aria-describedby");
    expect(describedBy).toBe("wizard-ai-problem-note");
    expect(document.getElementById("wizard-ai-problem-note")).toHaveTextContent("Добавлено AI");
    expect(document.getElementById("wizard-deliverable-input")).toHaveAttribute("aria-describedby", "wizard-ai-deliverable-note");
    expect(document.getElementById("wizard-criteria-input")).toHaveAttribute("aria-describedby", "wizard-ai-criteria-note");

    expect(screen.getByText("Фрагменты от AI-подсказки")).toBeInTheDocument();
    expect(screen.getAllByTestId("wizard-ai-change").length).toBe(3);
    expect(screen.getByTestId("wizard-ai-problem-before")).toHaveTextContent("До: Старая формулировка");
    expect(screen.getByTestId("wizard-ai-problem-after")).toHaveTextContent("После: Найти релевантные статьи");
    expect(screen.getByTestId("wizard-ai-deliverable-before")).toHaveTextContent("До: пусто");
    expect(screen.getByTestId("wizard-ai-deliverable-after")).toHaveTextContent("После: Прототип поиска");
    expect(screen.getByTestId("wizard-ai-criterion-after")).toHaveTextContent("После: Precision@10 >= 0.7");

    fireEvent.click(screen.getByRole("button", { name: "AI-подсказка по брифу" }));
    await waitFor(() => {
      const element = document.getElementById("wizard-ai-problem") as HTMLTextAreaElement | null;
      expect(element?.value.startsWith("Найти")).toBe(true);
    });
    fireEvent.click(screen.getByRole("button", { name: "Вставить в бриф" }));
    expect(screen.getAllByTestId("wizard-ai-change").length).toBe(3);
    expect(screen.getByTestId("wizard-ai-problem-before")).toHaveTextContent("До: Старая формулировка");

    fireEvent.change(screen.getByLabelText("Проблема"), { target: { value: "Старая формулировка отредактирована" } });
    expect(screen.getAllByTestId("wizard-ai-applied").length).toBe(2);
    expect(screen.getAllByTestId("wizard-ai-change").length).toBe(2);
    expect(screen.queryByTestId("wizard-ai-problem-before")).not.toBeInTheDocument();

    fireEvent.click(firstElement(screen.getAllByRole("button", { name: "Отменить" })));
    expect((document.getElementById("wizard-deliverable-input") as HTMLTextAreaElement).value).toBe("");
    expect(screen.getAllByTestId("wizard-ai-applied").length).toBe(1);
    expect(screen.getAllByTestId("wizard-ai-change").length).toBe(1);
    expect(screen.getByTestId("wizard-ai-criterion-after")).toHaveTextContent("После: Precision@10 >= 0.7");
  });
});

async function openWizardAtStepFive(options?: { places?: string }) {
  mockHome([taskEconomy], undefined, undefined, () => ({
    kind: "customer_brief",
    editable: true,
    problem: null,
    deliverable: null,
    acceptance_criteria: [],
    notice: "AI-помощник недоступен, заполните бриф вручную.",
    gateway_called: false,
  }));
  renderHome();
  await waitFor(() => { expect(screen.getAllByText("Оптимизация логистики региона").length).toBeGreaterThan(0); });
  fireEvent.click(screen.getByRole("button", { name: "+ Создать задачу" }));
  fireEvent.change(screen.getByLabelText("Название"), { target: { value: "Публичный бриф" } });
  fireEvent.change(screen.getByLabelText("Компетенции кейса через запятую"), { target: { value: "NLP" } });
  fireEvent.click(screen.getByRole("button", { name: "Далее" }));
  fireEvent.change(screen.getByLabelText("Проблема"), { target: { value: "Сверить гипотезу на исторических данных." } });
  fireEvent.change(screen.getByLabelText("Результат"), { target: { value: "Отчёт с метриками." } });
  fireEvent.change(screen.getByLabelText("Критерии приёмки построчно"), { target: { value: "Метрика выше базовой" } });
  fireEvent.click(screen.getByRole("button", { name: "Далее" }));
  fireEvent.click(screen.getByRole("button", { name: "Далее" }));
  if (options?.places !== undefined) {
    fireEvent.change(screen.getByLabelText("Мест для участников"), { target: { value: options.places } });
  }
  fireEvent.click(screen.getByRole("button", { name: "Далее" }));
  await screen.findByText("Предпросмотр участника");
}

describe("customer participant preview", () => {
  it("opens a participant projection with honest missing states and no publication controls from preview", async () => {
    await openWizardAtStepFive({ places: "0" });

    fireEvent.click(screen.getByRole("button", { name: "Показать предпросмотр" }));
    expect(screen.getByText("Предпросмотр задачи")).toBeInTheDocument();
    expect(screen.getByText(/Сверить гипотезу на исторических данных/)).toBeInTheDocument();
    expect(screen.getByTestId("preview-missing")).toHaveTextContent(/количество мест/);
    expect(screen.queryByRole("button", { name: "Отправить на модерацию" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Сохранить черновик" })).not.toBeInTheDocument();
    expect(screen.getByText(/Не утверждена платформой/)).toBeInTheDocument();
    expect(screen.getByText(/премия за оценку 5\+ не обещается/)).toBeInTheDocument();
    expect(screen.getByText("Открытая заявка")).toBeInTheDocument();
    expect(screen.getAllByText("не указано").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Вернуться к редактированию" }));
    expect(screen.getByText("Шаг 5 из 5")).toBeInTheDocument();
    expect(screen.getByTestId("wizard-brief-complete")).toHaveTextContent(/количество мест/);
    fireEvent.click(screen.getByRole("button", { name: "Назад" }));
    fireEvent.click(screen.getByRole("button", { name: "Назад" }));
    fireEvent.click(screen.getByRole("button", { name: "Назад" }));
    expect(screen.getByText("Шаг 2 из 5")).toBeInTheDocument();
    expect(screen.getByLabelText("Проблема")).toHaveValue("Сверить гипотезу на исторических данных.");
    expect(screen.getByLabelText("Критерии приёмки построчно")).toHaveValue("Метрика выше базовой");
    expect(screen.queryByRole("button", { name: "Отправить на модерацию" })).toBeNull();
  });

  it("keeps preview honest on foreign-tab draft change: stale notice, no auto-mix, explicit refresh", async () => {
    await openWizardAtStepFive();

    fireEvent.click(screen.getByRole("button", { name: "Показать предпросмотр" }));
    expect(screen.queryByTestId("preview-stale")).not.toBeInTheDocument();
    expect(screen.queryByTestId("preview-missing")).not.toBeInTheDocument();

    const changedDraft = JSON.stringify({
      step: 5,
      taskMode: "open",
      form: {
        title: "Внешнее имя черновика",
        competencyTags: "NLP",
        rubricResult: "", rubricReasoning: "", rubricUncertainty: "", rubricAiUse: "", rubricDefense: "",
        problem: "Внешняя формулировка проблемы.",
        deliverable: "Внешний результат.",
        criterion: "Внешний критерий",
        deadline: "", dataConstraints: "", ipTerms: "", places: "4", baseAmount: "", aMultiplier: "1.0",
        supportModel: "platform", supportAssignee: "",
      },
    });
    localStorage.setItem("impulse_customer_wizard_draft", changedDraft);
    fireEvent(window, new StorageEvent("storage", { key: "impulse_customer_wizard_draft" }));
    await waitFor(() => { expect(screen.getByTestId("preview-stale")).toBeInTheDocument(); });
    expect(screen.getByText(/Сверить гипотезу на исторических данных/)).toBeInTheDocument();
    expect(screen.queryByText("Внешняя формулировка проблемы.")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("preview-update"));
    expect(screen.queryByTestId("preview-stale")).not.toBeInTheDocument();
    expect(screen.getByText("Внешнее имя черновика")).toBeInTheDocument();
    expect(screen.getByText(/Внешняя формулировка проблемы/)).toBeInTheDocument();
    expect(screen.getByText("Внешний критерий")).toBeInTheDocument();
    expect(screen.queryByText(/Сверить гипотезу на исторических данных/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Вернуться к редактированию" }));
    fireEvent.click(screen.getByRole("button", { name: "Назад" }));
    fireEvent.click(screen.getByRole("button", { name: "Назад" }));
    fireEvent.click(screen.getByRole("button", { name: "Назад" }));
    fireEvent.click(screen.getByRole("button", { name: "Назад" }));
    expect(screen.getByText("Шаг 1 из 5")).toBeInTheDocument();
    expect(screen.getByLabelText("Название")).toHaveValue("Публичный бриф");
    fireEvent.click(screen.getByRole("button", { name: "Далее" }));
    expect(screen.getByText("Шаг 2 из 5")).toBeInTheDocument();
    expect(screen.getByLabelText("Проблема")).toHaveValue("Сверить гипотезу на исторических данных.");
    expect(screen.getByLabelText("Критерии приёмки построчно")).toHaveValue("Метрика выше базовой");
  });
});
