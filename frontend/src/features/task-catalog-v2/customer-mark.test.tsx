import { describe, expect, it } from "vitest";
import { prototypeBrandForCustomer } from "./customer-brand";
import type { CatalogItem } from "./types";

function customer(display_name: string, verification: CatalogItem["customer"]["verification"]) {
  return { id: "test", display_name, verification };
}

describe("verified catalog customer logo port from UI (1)", () => {
  it("uses the approved vector variant only for exact verified customer names", () => {
    expect(prototypeBrandForCustomer(customer("Сбер", "verified"))).toBe("sber");
    expect(prototypeBrandForCustomer(customer("Т-Банк", "verified"))).toBe("t-bank");
    expect(prototypeBrandForCustomer(customer("red_mad_robot", "verified"))).toBe("red-mad-robot");
    expect(prototypeBrandForCustomer(customer("Газпром нефть", "verified"))).toBe("gazprom-neft");
  });

  it("keeps a neutral icon for demos and unverified customers", () => {
    expect(prototypeBrandForCustomer(customer("Сбер", "demo"))).toBeNull();
    expect(prototypeBrandForCustomer(customer("Яндекс", "unverified"))).toBeNull();
  });

  it("never infers a real company from a partial name or supplied path", () => {
    expect(prototypeBrandForCustomer(customer("Сбер Тестовая лаборатория", "verified"))).toBeNull();
    expect(prototypeBrandForCustomer(customer("../../malicious.svg", "verified"))).toBeNull();
    expect(prototypeBrandForCustomer(customer("Unknown", "verified"))).toBeNull();
  });
});
