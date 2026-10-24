import { Award } from "lucide-react";
import type { CatalogItem } from "./types";

/**
 * Benefit illustrations from Impulse_Tasks_UI (1)/src/icons/ui/icons.tsx.
 * Icons express the benefit category; the API still supplies eligibility,
 * actual/potential status and the conditions displayed beside each icon.
 */
type BenefitType = CatalogItem["benefits"][number]["benefit_type"];
export function BenefitMark({ type }: { type: BenefitType }) {
  const tone = type === "learning" ? "violet"
    : type === "portfolio" ? "blue"
    : type === "support" ? "teal"
    : type === "mentorship" ? "amber"
    : type === "compensation" ? "amber"
    : "muted";
  const outline = type === "learning"
    ? <><rect x="5" y="3" width="14" height="18" rx="2.5" /><path d="M9 8h6M9 12h6M9 16h3" /></>
    : type === "portfolio"
      ? <><rect x="4" y="7" width="16" height="13" rx="2.5" /><path d="M9 7V5h6v2M8 16v-3M12 16v-5M16 16v-2" /></>
      : type === "support"
        ? <><rect x="3" y="4" width="10" height="10" rx="2" /><path d="M8 18h4v-4M16 10h5v8h-5zM7 8h2M7 11h2" /></>
        : type === "mentorship"
          ? <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8 6.8 19.6l1-5.8L3.5 9.7l5.9-.8z" />
          : null;

  return (
    <span className="catalog-v2-benefit-icon" data-tone={tone} aria-hidden="true">
      {outline === null
        ? <Award size={19} />
        : <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" focusable="false">
          {outline}
        </svg>}
    </span>
  );
}
