import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BootcampCatalog, StudyCourseProgress } from "./catalog";

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

describe("Bootcamp catalog redesigned UI and state contracts", () => {
  it("renders live catalog records without inventing extra courses", async () => {
    installFetch();
    renderCatalog("/workspace/3?category=all");
    expect(await screen.findByTestId("course-openspec-sdd")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bootcamp" })).toBeVisible();
    expect(screen.getByTestId("course-python-base")).toBeVisible();
    expect(screen.getByTestId("course-greenhouse-esg")).toBeVisible();
    expect(screen.queryByTestId("course-fabricated")).not.toBeInTheDocument();
  });

  it("offers both card and list views and keeps their state in the URL", async () => {
    installFetch();
    renderCatalog("/workspace/3?category=all");
    await screen.findByTestId("course-openspec-sdd");
    const views = screen.getByRole("group", { name: "Вид каталога" });
    fireEvent.click(within(views).getByRole("button", { name: "Список" }));
    await waitFor(() => { expect(screen.getByTestId("route").textContent).toContain("view=list"); });
    expect(screen.getByRole("list", { name: "Каталог Bootcamp списком" })).toBeVisible();
    fireEvent.click(within(views).getByRole("button", { name: "Карточки" }));
    await waitFor(() => { expect(screen.getByTestId("route").textContent).toContain("view=card"); });
  });

  it("filters by course name and offers a functioning reset when empty", async () => {
    installFetch();
    renderCatalog("/workspace/3?category=all");
    await screen.findByTestId("course-openspec-sdd");
    const search = screen.getByRole("searchbox", { name: "Поиск по курсам" });
    fireEvent.change(search, { target: { value: "nonexistent987" } });
    await waitFor(() => expect(screen.getByText(/Курсов по условиям не найдено/)).toBeVisible());
    expect(screen.queryByTestId("course-openspec-sdd")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Сбросить фильтры" }));
    await waitFor(() => { expect(screen.getByTestId("route").textContent).not.toContain("nonexistent987"); });
  });

  it("opens a real course detail drawer from the catalog", async () => {
    installFetch();
    renderCatalog("/workspace/3?category=all");
    const card = await screen.findByTestId("course-openspec-sdd");
    fireEvent.click(within(card).getByRole("button", { name: /Открыть курс/ }));
    await waitFor(() => { expect(screen.getByTestId("route").textContent).toContain("course=openspec-sdd"); });
    expect(screen.getByRole("dialog", { name: "Информация о курсе" })).toBeVisible();
  });

  it("shows a recommendation explanation and a working return action", async () => {
    installFetch();
    renderCatalog("/workspace/3?category=all");
    const card = await screen.findByTestId("course-openspec-sdd");
    fireEvent.click(within(card).getByRole("button", { name: /Почему рекомендован/ }));
    const dialog = screen.getByRole("dialog", { name: "Почему рекомендован" });
    expect(within(dialog).getByText("Почему вам рекомендован этот курс")).toBeVisible();
    fireEvent.click(within(dialog).getByRole("button", { name: "Вернуться к курсу" }));
    await waitFor(() => expect(screen.getByRole("dialog", { name: "Информация о курсе" })).toBeVisible());
  });

  it("does not pretend restricted and prerequisite courses are enrolled", async () => {
    installFetch();
    renderCatalog("/workspace/3?category=all");
    const unavailable = await screen.findByTestId("course-python-base");
    const prerequisite = screen.getByTestId("course-agent-development");
    expect(within(unavailable).getByRole("button", { name: /Недоступен/ })).toBeVisible();
    expect(within(prerequisite).getByRole("button", { name: /Смотреть условия/ })).toBeVisible();
    expect(within(prerequisite).getByText("Заблокирован")).toBeVisible();
  });

  it("distinguishes reported completion from verified completion", async () => {
    installFetch();
    renderCatalog("/workspace/3?category=all");
    const reported = await screen.findByTestId("course-python-base");
    const verified = screen.getByTestId("course-greenhouse-esg");
    expect(within(reported).getByText("На проверке")).toBeVisible();
    expect(within(verified).getByText("Подтверждено")).toBeVisible();
    expect(within(verified).getByRole("button", { name: /Посмотреть курс/ })).toBeVisible();
  });

  it("opens a deep-linked course and reports unknown course IDs honestly", async () => {
    installFetch();
    renderCatalog("/workspace/3?category=all&course=openspec-sdd");
    expect(await screen.findByRole("dialog", { name: "Информация о курсе" })).toBeVisible();
  });

  it("shows a clear error message for missing deep-linked courses", async () => {
    installFetch();
    renderCatalog("/workspace/3?category=all&course=nonexistent999");
    expect(await screen.findByText(/Курс по ссылке не найден в каталоге/)).toBeVisible();
    expect(screen.queryByRole("dialog", { name: "Информация о курсе" })).not.toBeInTheDocument();
  });

  it("does not show a public honour board without express consent", async () => {
    installFetch();
    renderCatalog("/workspace/3?category=all", { honorBoardEnabled: true, honorBoardConsent: false });
    await screen.findByTestId("course-openspec-sdd");
    expect(screen.queryByText("Зал славы курсов")).not.toBeInTheDocument();
  });

  it("shows the honour board with explicit consent", async () => {
    installFetch();
    renderCatalog("/workspace/3?category=all", { honorBoardEnabled: true, honorBoardConsent: true });
    expect(await screen.findByText("Зал славы курсов")).toBeVisible();
  });

  it("preserves the user-selected course category through URL navigation", async () => {
    installFetch();
    renderCatalog("/workspace/3?category=all");
    await screen.findByTestId("course-openspec-sdd");
    const categories = screen.getByRole("group", { name: "Категории курсов" });
    fireEvent.click(within(categories).getByRole("button", { name: /Завершённые/ }));
    await waitFor(() => { expect(screen.getByTestId("route").textContent).toContain("category=completed"); });
    expect(screen.getByTestId("course-greenhouse-esg")).toBeVisible();
    expect(screen.queryByTestId("course-openspec-sdd")).not.toBeInTheDocument();
  });
});

describe("Stored Impulse study bar", () => {
  it("shows the server lesson count without granting verified competency or rating points", () => {
    render(<StudyCourseProgress course={{
      course_key:"demo-course-10", title:"AI Threat Landscape",
      completed_units:3,total_units:8,finished:false,certificate_id:null,
      finished_at:null,updated_at:"2026-10-25T18:00:00Z",
      practice_status:null,practical_certificate_id:null,
    }}/>);
    const progress=screen.getByRole("progressbar",{name:"Учебный прогресс: AI Threat Landscape"});
    expect(progress).toHaveAttribute("value","3");
    expect(progress).toHaveAttribute("max","8");
    expect(screen.getByText("Уроки: 3 из 8")).toBeInTheDocument();
    expect(screen.getByText(/не оценка навыков/)).toBeInTheDocument();
  });
  it("labels an actually finished study course but requires separate practical verification", () => {
    render(<StudyCourseProgress course={{
      course_key:"demo-course-10",title:"AI Threat Landscape",
      completed_units:8,total_units:8,finished:true,certificate_id:"sample-id",
      finished_at:"2026-10-25T18:00:00Z",updated_at:"2026-10-25T18:00:00Z",
      practice_status:"pending",practical_certificate_id:null,
    }}/>);
    expect(screen.getByText("Учебный курс пройден")).toBeInTheDocument();
    expect(screen.getByText(/практические навыки подтверждаются отдельно/)).toBeInTheDocument();
  });
});
