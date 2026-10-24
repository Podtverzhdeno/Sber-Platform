import { BriefcaseBusiness } from "lucide-react";
import type { CatalogItem } from "./types";
import { prototypeBrandForCustomer } from "./customer-brand";

/**
 * Display the original SVG from Impulse_Tasks_UI (1).zip unchanged.
 * A brand mark is used only for an API-verified, exactly matched customer.
 */
export function CustomerMark({
  customer,
  size = 22,
}: {
  customer: CatalogItem["customer"];
  size?: number;
}) {
  const brand = prototypeBrandForCustomer(customer);
  if (brand === null) return <BriefcaseBusiness size={size} aria-hidden="true" />;
  return (
    <img
      className="catalog-v2-brand-logo"
      src={`/task-catalog/brands/${brand}.svg`}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
    />
  );
}
