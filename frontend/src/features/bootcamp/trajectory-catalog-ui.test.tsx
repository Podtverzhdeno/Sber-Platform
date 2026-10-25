import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AI_ROLE_CATALOG } from "../trajectory-v2/source-reference/source-catalog";
import { BootcampCatalog } from "./catalog";

const courses = Array.from({ length: 12 }, (_, index) => ({
  key: `demo-course-${String(index + 1)}`,
  title: `Учебный курс ${String(index + 1)}`,
  track_keys: [AI_ROLE_CATALOG[index % AI_ROLE_CATALOG.length]?.key ?? "product"],
  source_url: "https://example.org/lessons",
  access_state: "available",
  access_note: "Доступно",
  completion_state: "not_started",
  relevant: false,
  relevance_reasons: [],
  recommendation_reason: "Из плана обучения",
  must_take: null,
  pending_verification_note: null,
  verified_evidence: null,
}));

afterEach(() => { vi.unstubAllGlobals(); });

describe("Bootcamp AI trajectory content in reference UI", () => {
  it("keeps seven canonical roles, maps their courses, and preserves all-courses filter", async () => {
    vi.stubGlobal("fetch", vi.fn((request: RequestInfo | URL) => {
      const url = typeof request === "string" ? request : request instanceof URL ? request.href : request.url;
      const data = url.includes("/me/bootcamp/catalog") ? courses :
        url.includes("/me/learning/streak") ? { current_days: 2 } : [];
      return Promise.resolve(new Response(JSON.stringify(data), {
        status: 200, headers: { "Content-Type": "application/json" },
      }));
    }));
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={["/workspace/3"]}>
          <BootcampCatalog honorBoardEnabled={false} honorBoardConsent={false} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const roleTabs = await screen.findByRole("group", { name: "Направление обучения" });
    for (const role of AI_ROLE_CATALOG) {
      expect(within(roleTabs).getByRole("button", { name: role.title })).toBeInTheDocument();
    }
    expect(screen.getByRole("heading", { name: "Моя роль: AI Architect" })).toBeInTheDocument();
    expect(screen.getByTestId("course-demo-course-1")).toBeInTheDocument();
    expect(screen.getByTestId("course-demo-course-6")).toBeInTheDocument();
    expect(screen.queryByTestId("course-demo-course-3")).not.toBeInTheDocument();

    fireEvent.click(within(roleTabs).getByRole("button", { name: "AI Engineer" }));
    expect(screen.getByRole("heading", { name: "Моя роль: AI Engineer" })).toBeInTheDocument();
    expect(screen.getByTestId("course-demo-course-2")).toBeInTheDocument();
    expect(screen.getByTestId("course-demo-course-3")).toBeInTheDocument();
    expect(screen.queryByTestId("course-demo-course-1")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Все курсы/ }));
    expect(screen.getByTestId("course-demo-course-1")).toBeInTheDocument();
    expect(screen.getByTestId("course-demo-course-12")).toBeInTheDocument();

    fireEvent.click(within(roleTabs).getByRole("button", { name: "AI Security Engineer" }));
    expect(screen.getByRole("heading", { name: "Моя роль: AI Security Engineer" })).toBeInTheDocument();
    expect(screen.getByTestId("course-demo-course-10")).toBeInTheDocument();
  });
});
