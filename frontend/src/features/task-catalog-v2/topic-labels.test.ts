import { describe, expect, it } from "vitest";
import { displayCatalogTopic } from "./topic-labels";

describe("catalog topic labels", () => {
  it("shows approved human-readable labels while keeping input keys untouched", () => {
    expect(displayCatalogTopic("ml")).toBe("ML / AI");
    expect(displayCatalogTopic("python")).toBe("Python");
    expect(displayCatalogTopic("recommender-systems")).toBe("Рекомендательные системы");
    expect(displayCatalogTopic("computer-vision")).toBe("Computer Vision");
    expect(displayCatalogTopic("product-analytics")).toBe("Продуктовая аналитика");
  });

  it("never guesses unknown user-supplied skill names or modifies API identifiers", () => {
    expect(displayCatalogTopic("new-specialized-tag")).toBe("new-specialized-tag");
    expect(displayCatalogTopic("ML")).toBe("ML / AI");
    expect(displayCatalogTopic("")).toBe("");
  });
});
