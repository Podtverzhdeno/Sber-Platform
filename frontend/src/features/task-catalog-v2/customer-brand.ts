import type { CatalogItem } from "./types";

export type PrototypeBrand =
  | "sber" | "t-bank" | "tinkoff" | "astra" | "yandex"
  | "red-mad-robot" | "gazprom-neft" | "vk" | "positive-technologies";

const aliases: Readonly<Record<string, PrototypeBrand>> = {
  "сбер": "sber", "сбербанк": "sber", "sber": "sber",
  "т банк": "t-bank", "тбанк": "t-bank", "t bank": "t-bank",
  "тинькофф": "tinkoff", "tinkoff": "tinkoff",
  "astra": "astra", "astra linux": "astra", "группа астра": "astra",
  "яндекс": "yandex", "yandex": "yandex",
  "red mad robot": "red-mad-robot",
  "газпром нефть": "gazprom-neft",
  "vk": "vk", "вконтакте": "vk",
  "positive technologies": "positive-technologies",
  "позитив текнолоджиз": "positive-technologies",
};

export function prototypeBrandForCustomer(customer: CatalogItem["customer"]): PrototypeBrand | null {
  if (customer.verification !== "verified") return null;
  const name = customer.display_name.trim().toLocaleLowerCase("ru-RU")
    .replace(/[\s_.–—-]+/g, " ").trim();
  return aliases[name] ?? null;
}

