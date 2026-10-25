import { createElement } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createQueryClient } from "../app/query";
import { clearApiReadCache } from "../api/client";
import { ParticipantPortfolioV2 } from "./portfolio-v2";
import {
  countCurrentDocuments,
  credentialStatusLabel,
  isCurrentCredential,
  isRevokedCredential,
} from "./portfolio-v2-data";

afterEach(() => { cleanup(); clearApiReadCache(); vi.restoreAllMocks(); });

describe("portfolio credential evidence rules", () => {
  it("includes a current issued season award in the document count", () => {
    expect(countCurrentDocuments([
      { verification_id: "season-1", status: "valid", credential_type: "season_award" },
      { verification_id: "course-1", status: "verified", credential_type: "course" },
    ], 1)).toBe(3);
  });

  it("excludes revoked and superseded documents from active counts", () => {
    const revoked = { verification_id: "old-1", status: "revoked" };
    const superseded = { verification_id: "old-2", status: "superseded" };
    const historical = [revoked, superseded];
    expect(historical.every(isRevokedCredential)).toBe(true);
    expect(historical.some(isCurrentCredential)).toBe(false);
    expect(countCurrentDocuments(historical, 0)).toBe(0);
    expect(credentialStatusLabel(revoked)).toBe("Отозван");
    expect(credentialStatusLabel(superseded)).toBe("Заменён");
  });

  it("does not infer validity from unknown or unverified status", () => {
    const unknown = { verification_id: "draft", status: "reported" };
    expect(isCurrentCredential(unknown)).toBe(false);
    expect(credentialStatusLabel(unknown)).toBe("reported");
    expect(countCurrentDocuments([unknown], 0)).toBe(0);
  });
});


it("shows an explicit API error instead of another participant's demo awards", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({
      code: "PORTFOLIO_UNAVAILABLE",
      message: "Backend unavailable",
      retryable: false,
    }), { status: 503 }),
  );
  const client = createQueryClient();
  try {
    render(createElement(
      QueryClientProvider, { client },
      createElement(MemoryRouter, null, createElement(ParticipantPortfolioV2)),
    ));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Демонстрационные результаты не подставляются");
    expect(screen.queryByText("Алекс Речной")).toBeNull();
    expect(screen.getByRole("button", { name: "Повторить загрузку" })).toBeTruthy();
  } finally {
    client.clear();
  }
});
