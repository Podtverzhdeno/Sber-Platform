import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

  it("shows exact source SVGs in explicitly labeled demo examples but not unverified records", () => {
    expect(prototypeBrandForCustomer(customer("Сбер", "demo"))).toBe("sber");
    expect(prototypeBrandForCustomer(customer("Яндекс", "unverified"))).toBeNull();
    expect(prototypeBrandForCustomer(customer("Сбер R&D лаборатория", "demo"))).toBeNull();
  });

  it("never infers a real company from a partial name or supplied path", () => {
    expect(prototypeBrandForCustomer(customer("Сбер Тестовая лаборатория", "verified"))).toBeNull();
    expect(prototypeBrandForCustomer(customer("../../malicious.svg", "verified"))).toBeNull();
    expect(prototypeBrandForCustomer(customer("Unknown", "verified"))).toBeNull();
  });
});

describe("approved company SVG asset integrity", () => {
  it("keeps all 10 source ZIP SVGs byte-identical, not recreated substitutes", () => {
    const approved: Record<string, string> = {
      "sber.svg": "68acdee1295943334785f09f8744e6e09a0d70bfa346974051757faf46db0761",
      "t-bank.svg": "7d81779ec8c1bbeb1974f8b130294bb61331461e6fed427c717014aee874e70f",
      "astra.svg": "7d0eccca926958f5bbaefd3ce47b52c5e8267833cda7291928a80baf40a5f666",
      "yandex.svg": "ff738d90afc48ecf57770fa87db4ae097b618b770c4e7a2fd0f25e77ed813c35",
      "red-mad-robot.svg": "5d70b9d8efdb542451c483ccaaadc96ffad51e0894f10f4c7d1c59c7a85f1122",
      "gazprom-neft.svg": "be815c73b0c52477dd368d8d38a2a4043edb8c5f1fe7ba90e50683ca714f9173",
      "vk.svg": "616bff05f3f53ac554a6078ef6aab40997bc39a958c255796c76e9cfe5d3be89",
      "positive-technologies.svg": "4e59af20785c5abe30e38206a353311c95399dd3543762d10ac814f79c1ca853",
      "tinkoff.svg": "317b4439f3f9d62223dd8c83b32e5e05163975fba08abeb7bfdf2264cd5c0dae",
      "impulse.svg": "0d532eaa8af8d8178050e29d21e74243d089fb655a9b7110086bdd5fea510bc2",
    };
    for (const [filename, expectedSha256] of Object.entries(approved)) {
      const source = readFileSync(resolve("public", "task-catalog", "brands", filename));
      const actualSha256 = createHash("sha256").update(source).digest("hex");
      expect(actualSha256, filename).toBe(expectedSha256);
    }
  });
});
