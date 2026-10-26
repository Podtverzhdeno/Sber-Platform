import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { ParticipantEvidence } from "./participant-evidence";

vi.mock("../api/client", () => ({ apiRequest: vi.fn() }));
afterEach(() => { vi.clearAllMocks(); });

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><ParticipantEvidence /></QueryClientProvider>);
}

describe("participant evidence vs professional Agentic level", () => {
  it("shows recorded study and practical results without manufacturing a level", async () => {
    vi.mocked(apiRequest).mockImplementation(async (path: string) => {
      if (path.includes("impulse-study/summary")) return {
        started_courses: 7, finished_courses: 6, completed_lessons: 56,
        approved_practices: 1, credited_practices: 2,
        courses: [{ course_key: "product", title: "Аналитика продукта", completed_units: 8, total_units: 8,
          finished: true, finished_at: "2026-10-26T07:00:00Z", certificate_id: "cert", updated_at: "2026-10-26T07:00:00Z",
          practice_status: "approved", practical_certificate_id: null }],
      };
      if (path.includes("analytics/journey")) return { stages: [{ key: "verified_experience", count: 3 }] };
      throw new Error("Unexpected API call: " + path);
    });
    mount();
    await waitFor(() => expect(screen.getByTestId("evidence-courses")).toHaveTextContent("6"));
    expect(screen.getByTestId("evidence-lessons")).toHaveTextContent("56");
    expect(screen.getByTestId("evidence-practices")).toHaveTextContent("2");
    expect(screen.getByTestId("evidence-accepted")).toHaveTextContent("3");
    expect(screen.getByText("Аналитика продукта")).toBeInTheDocument();
    expect(screen.getByText(/не уровень по шкале Agentic Coding/)).toBeInTheDocument();
  });

  it("distinguishes real zero counts from unavailable accepted results", async () => {
    vi.mocked(apiRequest).mockImplementation(async (path: string) => {
      if (path.includes("impulse-study/summary")) return {
        started_courses: 0, finished_courses: 0, completed_lessons: 0,
        approved_practices: 0, credited_practices: 0, courses: [],
      };
      throw new Error("Journey temporarily offline");
    });
    mount();
    await waitFor(() => expect(screen.getByTestId("evidence-courses")).toHaveTextContent("0"));
    await waitFor(() => expect(screen.getByTestId("evidence-accepted")).toHaveTextContent("—"));
  });

  it("never replaces an unavailable learning source with fabricated zeros", async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error("unavailable"));
    mount();
    expect(await screen.findByRole("alert")).toHaveTextContent("Учебные результаты недоступны");
    expect(screen.queryByTestId("evidence-lessons")).not.toBeInTheDocument();
  });
});
