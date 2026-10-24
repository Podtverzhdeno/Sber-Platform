import { useId } from "react";
import { BriefcaseBusiness } from "lucide-react";
import type { CatalogItem } from "./types";

/**
 * Source: Impulse_Tasks_UI (1).zip/src/icons/brands.
 * Vector illustrations are transcribed from the approved UI prototype.
 * Brand marks are not customer-authentication evidence: only the backend
 * verification field can enable an illustrative logo.
 */
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
    .replace(/[\\s_.\\-–—]+/g, " ").trim();
  return aliases[name] ?? null;
}

export function CustomerMark({ customer, size = 22 }: { customer: CatalogItem["customer"]; size?: number }) {
  const brand = prototypeBrandForCustomer(customer);
  const gradientId = useId();
  if (brand === null) return <BriefcaseBusiness size={size} aria-hidden="true" />;
  return (
    <svg className="catalog-v2-brand-logo" width="100%" height="100%" viewBox="0 0 64 64" role="presentation" focusable="false" aria-hidden="true">
      {brand === "sber" ? <>
        <defs><linearGradient id={gradientId} x1="8" y1="56" x2="56" y2="8" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#21a038" /><stop offset="0.55" stopColor="#4cc15a" /><stop offset="1" stopColor="#0dbf9b" />
        </linearGradient></defs>
        <rect width="64" height="64" rx="14" fill="#fff" />
        <circle cx="32" cy="32" r="19" fill="none" stroke={`url(#${gradientId})`} strokeWidth="6" strokeDasharray="108 12" strokeLinecap="round" transform="rotate(-60 32 32)" />
        <path d="M22.5 32.5 29.5 39.5 43 24" fill="none" stroke={`url(#${gradientId})`} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      </> : null}
      {brand === "t-bank" ? <>
        <rect width="64" height="64" rx="14" fill="#ffdd2d" />
        <path d="M14 14h36v14c0 11-6 19-18 24C20 47 14 39 14 28z" fill="#1e1e1e" />
        <path d="M21 21h22v6h-8v14h-6V27h-8z" fill="#ffdd2d" />
      </> : null}
      {brand === "tinkoff" ? <>
        <rect width="64" height="64" rx="14" fill="#ffdd2d" />
        <path d="M32 12 48 20v8L32 36 16 28v-8z" fill="#1e1e1e" />
        <path d="M16 34 32 42 48 34v8L32 50 16 42z" fill="#1e1e1e" />
        <path d="M22 22 32 27 42 22" fill="none" stroke="#ffdd2d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </> : null}
      {brand === "astra" ? <>
        <rect width="64" height="64" rx="14" fill="#0d1b36" />
        <path d="M32 13 50 51h-7l-3.6-8H24.6L21 51h-7zm0 13.5L27 37h10z" fill="#f4f7fb" fillRule="evenodd" />
      </> : null}
      {brand === "yandex" ? <>
        <rect width="64" height="64" rx="14" fill="#fc3f1d" />
        <path d="M36.2 49V37.2h-3.1L25 49h-7.4l9.3-13.2c-4.7-1.6-7.4-5-7.4-9.9 0-6.1 4.4-10.9 12.1-10.9H44V49zm0-30.2h-3.5c-3.6 0-5.5 2-5.5 5.4 0 3.2 1.9 5.2 5.5 5.2h3.5z" fill="#fff" fillRule="evenodd" transform="translate(1 0)" />
      </> : null}
      {brand === "red-mad-robot" ? <>
        <rect width="64" height="64" rx="14" fill="#ee2a33" />
        <path d="M13 22h7v3.2c1.6-2.4 3.8-3.7 7-3.7v7c-4.4 0-7 1.6-7 6.2V44h-7z" fill="#fff" />
        <rect x="32" y="40" width="19" height="5" rx="1" fill="#fff" />
      </> : null}
      {brand === "gazprom-neft" ? <>
        <rect width="64" height="64" rx="14" fill="#0a64e6" />
        <path d="M32 12c10 0 18 8 18 18v22H32z" fill="#fff" />
        <path d="M14 30c0-9.9 8.1-18 18-18v40c-9.9 0-18-8.1-18-18z" fill="#b9d6ff" />
        <circle cx="32" cy="32" r="8" fill="#0a64e6" />
        <path d="M30 24h4v16h-4z" fill="#fff" />
      </> : null}
      {brand === "vk" ? <>
        <defs><linearGradient id={gradientId} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#6f4cf0" /><stop offset="1" stopColor="#4a3ad1" /></linearGradient></defs>
        <rect width="64" height="64" rx="14" fill={`url(#${gradientId})`} />
        <rect x="17" y="15" width="30" height="36" rx="5" fill="none" stroke="#fff" strokeWidth="3.5" />
        <rect x="25" y="11" width="14" height="9" rx="3" fill="#fff" />
        <path d="M24 33h16M24 41h10" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
      </> : null}
      {brand === "positive-technologies" ? <>
        <rect width="64" height="64" rx="14" fill="#1b1f27" />
        <path d="M19 14h18c8 0 13 4.6 13 11.5S45 37 37 37h-8v13h-10zm10 8v7h7c2.8 0 4.4-1.4 4.4-3.5S38.8 22 36 22z" fill="#f4f7fb" fillRule="evenodd" />
      </> : null}
    </svg>
  );
}
