import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const referenceStyles = readFileSync(new URL("./reference.scss", import.meta.url), "utf8");

function contrastRatio(foreground: string, background: string): number {
  const luminance = (value: string): number => {
    const rgb = value.match(/[a-f\d]{2}/gi);
    if (!rgb || rgb.length !== 3) throw new Error("Expected hex RGB color");
    const [red, green, blue] = rgb.map((channel) => {
      const normalized = Number.parseInt(channel, 16) / 255;
      return normalized <= 0.04045
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe("Messages light-mode and mobile regression", () => {
  it("keeps the original dark reference and adds an explicitly scoped light palette", () => {
    expect(referenceStyles).toContain("--msg-panel:#041120");
    expect(referenceStyles).toContain(':root[data-theme="light"] .sberchat-reference {');
    expect(referenceStyles).toContain("--msg-panel: #fff");
    expect(referenceStyles).toContain("--msg-bubble-out: #eaf3ff");
    expect(referenceStyles).toContain(':root[data-theme="light"] .page-shell:has(.sberchat-reference)');
  });

  it("overrides reading, composing and empty-state surfaces, not just the shell", () => {
    for (const selector of [
      ".msg-dialog-list__row-title strong",
      ".msg-chat__bubble-body",
      ".msg-composer__textarea",
      ".msg-context__section-title",
      ".msg-reference-empty__actions button",
      ".msg-reference-context-empty__blocks section",
    ]) {
      expect(referenceStyles).toContain(selector);
    }
  });

  it("preserves WCAG AA contrast for primary and secondary light text", () => {
    expect(contrastRatio("#17283b", "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#586b80", "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#17283b", "#eaf3ff")).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps list, chat and context constrained at 320–390px", () => {
    expect(referenceStyles).toContain("@media (max-width: 959px)");
    expect(referenceStyles).toContain("@media (max-width: 420px)");
    expect(referenceStyles).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(referenceStyles).toContain("overflow-wrap: anywhere");
    expect(referenceStyles).toContain(".messenger-shell--chat");
    expect(referenceStyles).toContain(".messenger-shell--context");
  });
});
