import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AttachmentCard } from "./attachment-card";

const mockWriteText = vi.fn();

beforeEach(() => {
  mockWriteText.mockReset();
  mockWriteText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: mockWriteText },
  });
});

describe("AttachmentCard", () => {
  it("shows the real file name, type and external navigation only for HTTPS links", () => {
    render(<ul><AttachmentCard reference="https://docs.example.com/reports/experiment.xlsx" /></ul>);
    expect(screen.getByText("experiment.xlsx")).toBeInTheDocument();
    expect(screen.getByText("XLSX · Внешняя ссылка")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Открыть вложение/ })).toHaveAttribute(
      "href", "https://docs.example.com/reports/experiment.xlsx",
    );
    expect(screen.getByRole("link", { name: /Открыть вложение/ })).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("never offers false downloads for internal artifact keys and copies the exact key", async () => {
    const key = "artifact:experiment-metrics.xlsx";
    render(<ul><AttachmentCard reference={key} /></ul>);
    expect(screen.queryByRole("link")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Скопировать идентификатор вложения/ }));
    await waitFor(() => { expect(mockWriteText).toHaveBeenCalledWith(key); });
    expect(await screen.findByRole("status")).toHaveTextContent("Идентификатор скопирован");
  });

  it("rejects javascript and http links as navigable attachments", () => {
    render(<ul><AttachmentCard reference="javascript:alert(1)" /><AttachmentCard reference="http://unsafe.example/file.pdf" /></ul>);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getAllByRole("button", { name: /Скопировать идентификатор вложения/ })).toHaveLength(2);
  });

  it("reports clipboard denial instead of falsely claiming success", async () => {
    mockWriteText.mockRejectedValueOnce(new Error("denied"));
    render(<ul><AttachmentCard reference="artifact:proposal.pdf" /></ul>);
    fireEvent.click(screen.getByRole("button", { name: /Скопировать идентификатор вложения/ }));
    expect(await screen.findByRole("status")).toHaveTextContent("Скопировать не удалось");
  });
});
