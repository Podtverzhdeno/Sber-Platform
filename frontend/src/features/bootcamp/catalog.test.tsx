import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BootcampCatalog } from "./catalog";

type CatalogCard = {
  key: string;
  title: string;
  track_keys: string[];
  source_url: string;
  access_state: string;
  access_note: string;
  completion_state: string;
  relevant: boolean;
  relevance_reasons: string[];
  recommendation_reason: string;
  must_take: Record<string, string | null> | null;
  pending_verification_note: string | null;
  verified_evidence: string | null;
};

const mustTake = {
  skill: "OpenSpec",
  current_level: "базовый",
  target_level: "уверенный",
  projected_impact:
    "Прогноз: курс ведёт к этапу «Освоить основу маршрута» траектории «Python-разработчик». Повышение применяется только после подтверждения checkpoint.",
  explanation:
    "Закрывает пробел навыка «OpenSpec»: сейчас «базовый», целевой уровень «уверенный».",
};

const cards: CatalogCard[] = [
  {
    key: "openspec-sdd",
    title: "OpenSpec и SDD",
    track_keys: ["python"],
    source_url: "https://example.test/courses/openspec",
    access_state: "available",
    access_note: "Доступен в демо без регистрации во внешней LMS.",
    completion_state: "not_started",
    relevant: true,
    relevance_reasons: [
      "Связан с активными направлениями: python.",
      "Закрывает незакрытый пробел: этап маршрута ещё не подтверждён.",
    ],
    recommendation_reason: "Этап «Освоить основу маршрута»: создать базу первой задачи.",
    must_take: { ...mustTake },
    pending_verification_note: null,
    verified_evidence: null,
  },
  {
    key: "python-base",
    title: "Python: основа",
    track_keys: ["python"],
    source_url: "https://example.test/courses/python",
    access_state: "unavailable",
    access_note: "Внешний курс пока не подключён; доступна исходная ссылка.",
    completion_state: "reported",
    relevant: true,
    relevance_reasons: ["Связан с активными направлениями: python."],
    recommendation_reason: "Этап «Освоить основу маршрута»: завершение отправлено на проверку.",
    must_take: { ...mustTake },
    pending_verification_note:
      "Завершение отправлено на проверку: повторно проходить тот же шаг не нужно, прогноз применится только после подтверждения.",
    verified_evidence: null,
  },
  {
    key: "agent-development",
    title: "Агентная разработка",
    track_keys: ["python"],
    source_url: "https://example.test/courses/agents",
    access_state: "prerequisite_not_met",
    access_note: "Требуется подтверждённый prerequisite: OpenSpec и SDD.",
    completion_state: "not_started",
    relevant: false,
    relevance_reasons: [],
    recommendation_reason: "Общий курс каталога, не привязан к активной траектории.",
    must_take: null,
    pending_verification_note: null,
    verified_evidence: null,
  },
  {
    key: "greenhouse-esg",
    title: "Отчётность ESG",
    track_keys: ["data"],
    source_url: "https://example.test/courses/esg",
    access_state: "available",
    access_note: "",
    completion_state: "verified",
    relevant: false,
    relevance_reasons: [],
    recommendation_reason:
      "Этап «Освоить основу маршрута» подтверждён: доказательство в карточке курсов.",
    must_take: null,
    pending_verification_note: null,
    verified_evidence: "course:greenhouse-esg",
  },
];

const streak = { current_days: 2, qualified_dates: ["2026-10-18"], reason: "Серия подтверждена." };

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function installFetch(
  catalogFixture: CatalogCard[] = cards,
  provider?: { courseDetail?: Record<string, unknown>; existingCertificate?: { certificate_id: string; verification_id: string; course_title: string } },
) {
  const mocks = { mutationCount: 0, catalogCalls: 0, learningCount: 0, certificateIssues: 0, detailCalls: 0 };
  let certificate = provider?.existingCertificate ?? null;
  const fetchMock = vi.fn((input: RequestInfo | URL): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes("/me/bootcamp/catalog")) {
      mocks.catalogCalls += 1;
      return Promise.resolve(jsonResponse(catalogFixture));
    }
    if (url.includes("/me/learning/streak")) {
      return Promise.resolve(jsonResponse(streak));
    }
    if (url.includes("/completion")) {
      mocks.mutationCount += 1;
      return Promise.resolve(jsonResponse({ course_key: "openspec-sdd", status: "reported" }));
    }
    if (url.includes("/learning-days")) {
      mocks.learningCount += 1;
      return Promise.resolve(jsonResponse({ ...streak, current_days: streak.current_days + 1 }));
    }
    if (url.includes("/me/bootcamp/certificates/")) {
      mocks.certificateIssues += 1;
      certificate = { certificate_id: "issued-1", verification_id: "verify-123", course_title: "Отчётность ESG" };
      return Promise.resolve(jsonResponse(certificate));
    }
    if (url.includes("/me/bootcamp/certificates")) {
      return Promise.resolve(jsonResponse(certificate === null ? [] : [certificate]));
    }
    if (url.includes("/me/courses/") && url.endsWith("/detail")) {
      mocks.detailCalls += 1;
      if (provider?.courseDetail) return Promise.resolve(jsonResponse(provider.courseDetail));
    }
    return Promise.resolve(
      jsonResponse(
        { code: "RESOURCE_NOT_FOUND", message: "Resource not found.", request_id: "r" },
        404,
      ),
    );
  });
  vi.stubGlobal("fetch", fetchMock);
  return mocks;
}

function LocationProbe() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <div>
      <span data-testid="route">{location.search}</span>
      <button
        type="button"
        data-testid="back"
        onClick={() => {
          void navigate(-1);
        }}
      >
        Назад
      </button>
    </div>
  );
}

function renderCatalog(
  url: string,
  props: { honorBoardEnabled: boolean; honorBoardConsent: boolean } = {
    honorBoardEnabled: true,
    honorBoardConsent: true,
  },
) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
      }
    >
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route
            path="*"
            element={
              <>
                <LocationProbe />
                <BootcampCatalog {...props} />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Bootcamp catalog states and filters (22.15)", () => {
  it("does not invent a competency target when the provider omits it", async () => {
    const noTarget = cards.map((card) => card.key === "openspec-sdd"
      ? { ...card, must_take: { ...mustTake, target_level: null } }
      : card);
    installFetch(noTarget);
    renderCatalog("/workspace/3");

    const card = await screen.findByTestId("course-openspec-sdd");
    fireEvent.click(within(card).getByText("Навык и требования"));
    expect(within(card).getByText(/целевой уровень ещё не опубликован/)).toBeVisible();
  });

  it("explains must-take on an available recommended course", async () => {
    installFetch();
    renderCatalog("/workspace/3");

    const card = await screen.findByTestId("course-openspec-sdd");
    expect(within(card).getByText("Надо пройти")).toBeInTheDocument();
    expect(within(card).getByText(/Закрывает пробел навыка «OpenSpec»/)).toBeInTheDocument();
    expect(within(card).getByText(/только после подтверждения checkpoint/)).toBeInTheDocument();
    expect(within(card).getByText("Доступен")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Отметить завершение" })).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: /Первоисточник курса/ })).toHaveAttribute(
      "rel",
      "noopener noreferrer",
    );
    expect(within(card).getAllByText("Актуальный").length).toBeGreaterThan(0);
  });

  it("keeps pending verification honest without repeat actions", async () => {
    installFetch();
    renderCatalog("/workspace/3");

    const card = await screen.findByTestId("course-python-base");
    expect(within(card).getByText("Ожидает проверки")).toBeInTheDocument();
    expect(within(card).getByText(/повторно проходить тот же шаг не нужно/)).toBeInTheDocument();
    expect(
      within(card).queryByRole("button", { name: "Отметить завершение" }),
    ).not.toBeInTheDocument();
    expect(
      within(card).queryByRole("button", { name: "Записать учебный день" }),
    ).not.toBeInTheDocument();
    expect(within(card).queryByRole("link", { name: /Первоисточник курса/ })).not.toBeInTheDocument();
    expect(within(card).getByText("Внешний доступ ограничен")).toBeInTheDocument();
  });

  it("does not offer enrollment actions when the prerequisite is unmet", async () => {
    installFetch();
    renderCatalog("/workspace/3");

    const card = await screen.findByTestId("course-agent-development");
    expect(within(card).getByText("Нужен подтверждённый prerequisite")).toBeInTheDocument();
    expect(within(card).getByText(/Требуется подтверждённый prerequisite/)).toBeInTheDocument();
    expect(
      within(card).queryByRole("button", { name: "Отметить завершение" }),
    ).not.toBeInTheDocument();
    expect(within(card).queryByRole("link", { name: /Первоисточник курса/ })).not.toBeInTheDocument();
  });

  it("marks verified completion with evidence and no fake buttons", async () => {
    installFetch();
    renderCatalog("/workspace/3");

    const card = await screen.findByTestId("course-greenhouse-esg");
    expect(within(card).getByText("Подтверждено")).toBeInTheDocument();
    expect(within(card).getByText(/course:greenhouse-esg/)).toBeInTheDocument();
    expect(
      within(card).queryByRole("button", { name: "Отметить завершение" }),
    ).not.toBeInTheDocument();
    expect(
      within(card).queryByRole("button", { name: "Записать учебный день" }),
    ).not.toBeInTheDocument();
  });

  it("reports completion for an available course through the real command API", async () => {
    const mocks = installFetch();
    renderCatalog("/workspace/3");

    const card = await screen.findByTestId("course-openspec-sdd");
    fireEvent.click(within(card).getByRole("button", { name: "Отметить завершение" }));
    await waitFor(() => { expect(mocks.mutationCount).toBe(1); });
  });

  it("keeps relevance filters and card/list view in the URL", async () => {
    installFetch();
    renderCatalog("/workspace/3");

    await screen.findByTestId("course-openspec-sdd");
    fireEvent.click(within(screen.getByRole("group", { name: "Фильтр актуальности" })).getByRole("button", { name: "Актуальные" }));
    expect(screen.getByTestId("route").textContent).toContain("relevance=relevant");
    await waitFor(() => expect(screen.queryByTestId("course-greenhouse-esg")).not.toBeInTheDocument());
    expect(
      within(screen.getByTestId("course-openspec-sdd")).getByText(/Почему актуален/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Список" }));
    expect(screen.getByTestId("route").textContent).toContain("view=list");
    expect(screen.getByRole("list", { name: "Каталог Bootcamp списком" })).toBeInTheDocument();
    expect(screen.queryByTestId("course-greenhouse-esg")).not.toBeInTheDocument();
  });

  it("exposes the relevance filter as aria-pressed toggles with its definition", async () => {
    installFetch();
    renderCatalog("/workspace/3");

    await screen.findByTestId("course-openspec-sdd");
    const group = screen.getByRole("group", { name: "Фильтр актуальности" });
    expect(within(group).getByRole("button", { name: "Все курсы" })).toHaveAttribute("aria-pressed", "true");
    expect(within(group).getByRole("button", { name: "Актуальные" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText(/Актуальные — курсы, доступные сейчас/)).toBeInTheDocument();

    fireEvent.click(within(group).getByRole("button", { name: "Актуальные" }));
    await waitFor(() => expect(within(group).getByRole("button", { name: "Актуальные" })).toHaveAttribute("aria-pressed", "true"));
    expect(within(group).getByRole("button", { name: "Все курсы" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("route").textContent).toContain("relevance=relevant");
  });

  it("calls the learning-day endpoint through the honest streak button", async () => {
    const mocks = installFetch();
    renderCatalog("/workspace/3");

    const card = await screen.findByTestId("course-openspec-sdd");
    fireEvent.click(within(card).getByRole("button", { name: "Записать учебный день" }));
    await waitFor(() => { expect(mocks.learningCount).toBe(1); });
    expect(within(screen.getByTestId("course-openspec-sdd")).getByRole("button", { name: "Записать учебный день" })).toBeEnabled();
  });

  it("restores filters and view on Back and on a fresh reload", async () => {
    installFetch();
    const first = renderCatalog("/workspace/3?track=data&view=list");

    await screen.findByTestId("course-greenhouse-esg");
    expect(screen.getByRole("list", { name: "Каталог Bootcamp списком" })).toBeInTheDocument();
    expect(screen.queryByTestId("course-openspec-sdd")).not.toBeInTheDocument();

    fireEvent.click(within(screen.getByRole("group", { name: "Фильтр актуальности" })).getByRole("button", { name: "Актуальные" }));
    expect(screen.getByTestId("route").textContent).toContain("relevance=relevant");
    await waitFor(() => expect(screen.queryByTestId("course-greenhouse-esg")).not.toBeInTheDocument());

    fireEvent.click(screen.getByTestId("back"));
    await waitFor(() => expect(screen.getByTestId("course-greenhouse-esg")).toBeInTheDocument());
    expect(screen.getByTestId("route").textContent).toContain("view=list");
    expect(screen.getByTestId("route").textContent).not.toContain("relevance");

    vi.unstubAllGlobals();
    installFetch();
    first.unmount();
    renderCatalog("/workspace/3?relevance=relevant&track=python&view=list");
    await screen.findByRole("list", { name: "Каталог Bootcamp списком" });
    const kept = await screen.findByTestId("course-python-base");
    expect(kept).toBeInTheDocument();
    expect(screen.queryByTestId("course-greenhouse-esg")).not.toBeInTheDocument();
  });

  it("opens a course deep link without losing filters", async () => {
    installFetch();
    renderCatalog("/workspace/3?relevance=relevant");

    const card = await screen.findByTestId("course-openspec-sdd");
    fireEvent.click(within(card).getByRole("button", { name: "Открыть траекторию" }));
    const route = screen.getByTestId("route").textContent;
    expect(route).toContain("course=openspec-sdd");
    expect(route).toContain("relevance=relevant");
  });

  it("shows the honor board only for consenting participants", async () => {
    installFetch();
    const { unmount } = renderCatalog("/workspace/3");
    await screen.findByTestId("course-openspec-sdd");
    expect(screen.getByText("Зал славы курсов")).toBeInTheDocument();
    unmount();

    renderCatalog("/workspace/3", { honorBoardEnabled: true, honorBoardConsent: false });
    await screen.findByTestId("course-agent-development");
    expect(screen.queryByText("Зал славы курсов")).not.toBeInTheDocument();
  });

  it("shows an empty state instead of fake cards", async () => {
    installFetch([]);
    renderCatalog("/workspace/3?relevance=relevant");

    await screen.findByText("Здесь пока пусто");
    expect(screen.queryByTestId(/course-/)).not.toBeInTheDocument();
  });

  it("renders a deep-linked course first and marks it", async () => {
    installFetch();
    renderCatalog("/workspace/3?course=agent-development");

    await screen.findByTestId("course-openspec-sdd");
    expect(await screen.findByTestId("deeplink-agent-development")).toBeInTheDocument();
    const grid = screen.getByTestId("course-agent-development").closest(".course-grid");
    const firstCard = grid?.firstElementChild;
    expect(firstCard).toHaveAttribute("data-testid", "course-agent-development");
  });

  it("keeps the deep-linked card filtered out honestly when filters exclude it", async () => {
    installFetch();
    renderCatalog("/workspace/3?relevance=relevant&course=greenhouse-esg");

    await screen.findByTestId("course-python-base");
    expect(screen.queryByTestId("course-greenhouse-esg")).not.toBeInTheDocument();
    expect(
      screen.getByText(/скрыт текущими фильтрами/),
    ).toBeInTheDocument();
  });

  it("reports an unknown deep-linked course key without a fake card", async () => {
    installFetch();
    renderCatalog("/workspace/3?course=ghost-course");

    await screen.findByTestId("course-openspec-sdd");
    expect(screen.getByText(/не найден в актуальном каталоге/)).toBeInTheDocument();
    expect(screen.queryByTestId("course-ghost-course")).not.toBeInTheDocument();
  });
  it("restores the approved category state and keeps selected direction on reset", async () => {
    installFetch();
    renderCatalog("/workspace/3?track=python&category=required&view=list");
    await screen.findByTestId("course-openspec-sdd");
    expect(screen.queryByTestId("course-greenhouse-esg")).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Каталог Bootcamp списком" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Сбросить" }));
    await waitFor(() => {
      expect(screen.getByTestId("route").textContent).toContain("track=python");
      expect(screen.getByTestId("route").textContent).not.toContain("category=required");
    });
    expect(screen.getByLabelText("Уровень курса")).toBeDisabled();
    expect(screen.getByText(/не является процентом готовности к грейду/)).toBeInTheDocument();
  });

  it("opens an accessible course detail drawer, switches tabs, and explains recommendation", async () => {
    installFetch();
    renderCatalog("/workspace/3");
    const card = await screen.findByTestId("course-openspec-sdd");
    fireEvent.click(within(card).getByRole("button", { name: "Подробнее →" }));
    let dialog = await screen.findByRole("dialog", { name: "Информация о курсе" });
    expect(dialog).toHaveTextContent("OpenSpec");
    fireEvent.click(within(dialog).getByRole("tab", { name: "Программа" }));
    expect(await within(dialog).findByText(/не переданы источником обучения/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("tab", { name: "Навыки" }));
    expect(within(dialog).getByText(/Прогноз не равен подтверждённому уровню/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Почему рекомендован" }));
    dialog = await screen.findByRole("dialog", { name: "Почему рекомендован" });
    expect(within(dialog).getByText(/Ожидаемое развитие навыка/)).toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByTestId("route").textContent).not.toContain("course=");
  });

  it("shows only unfinished course requirements and no fabricated grade readiness", async () => {
    installFetch();
    renderCatalog("/workspace/3");
    await screen.findByTestId("course-openspec-sdd");
    fireEvent.click(screen.getByRole("button", { name: "Посмотреть требования →" }));
    const dialog = await screen.findByRole("dialog", { name: "Требования к обучению" });
    expect(dialog).toHaveTextContent("OpenSpec и SDD");
    expect(dialog).not.toHaveTextContent("Отчётность ESG");
    expect(dialog).toHaveTextContent("Полный набор требований к грейду");
    const firstCourseButton = within(dialog).getAllByRole("button", { name: "Посмотреть →" })[0];
    if (firstCourseButton === undefined) throw new Error("No course action in requirements");
    fireEvent.click(firstCourseButton);
    expect(await screen.findByRole("dialog", { name: "Информация о курсе" })).toBeInTheDocument();
  });

  it("loads authoritative course objective, checkpoint, workload and competency cycle from the existing API", async () => {
    const fixtures = installFetch(cards, { courseDetail: {
      course_key: "openspec-sdd", title: "OpenSpec и SDD", source_url: "https://example.test/courses/openspec",
      availability: "available", access_note: "", enrollment_status: null, verified: false,
      specialization: "Разработка", program_version: "2026.2", workload_hours: 24,
      objective: "Спроектировать проверяемый контур изменений", milestone_title: "Принять решение по архитектуре",
      next_step: "Создать корректный ADR", artifact: "ADR-0001",
      program_competencies: [["OpenSpec", "SDD"]],
      cycle: [{ competency: "OpenSpec", current_level: "базовый", projected_level: "уверенный",
        target_level: "уверенный", projected_confirmed: false, evidence: "checkpoint" }],
    } });
    renderCatalog("/workspace/3");
    const card = await screen.findByTestId("course-openspec-sdd");
    fireEvent.click(within(card).getByRole("button", { name: "Подробнее →" }));
    const dialog = await screen.findByRole("dialog", { name: "Информация о курсе" });
    expect(await within(dialog).findByText(/Спроектировать проверяемый контур изменений/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Создать корректный ADR/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("tab", { name: "Программа" }));
    expect(within(dialog).getByText(/24 ч/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Принять решение по архитектуре/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("tab", { name: "Навыки" }));
    expect(within(dialog).getByText(/Подтверждено: базовый/)).toBeInTheDocument();
    expect(fixtures.detailCalls).toBe(1);
  });

  it("preserves certificate issuance for verified courses without issuing certificates for unverified ones", async () => {
    const fixtures = installFetch();
    renderCatalog("/workspace/3");
    await screen.findByTestId("course-greenhouse-esg");
    fireEvent.click(within(screen.getByTestId("course-greenhouse-esg")).getByRole("button", { name: "Подробнее →" }));
    const dialog = await screen.findByRole("dialog", { name: "Информация о курсе" });
    const issue = await within(dialog).findByRole("button", { name: "Получить сертификат" });
    fireEvent.click(issue);
    await waitFor(() => { expect(fixtures.certificateIssues).toBe(1); });
    expect(await within(dialog).findByRole("link", { name: "Открыть выданный сертификат →" })).toHaveAttribute("href", "/verify/verify-123");
  });

});
