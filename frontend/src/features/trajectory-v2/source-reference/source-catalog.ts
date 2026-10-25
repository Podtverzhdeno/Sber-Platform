import type { RoleCardView } from "../client";

/** Canonical names and legacy stable slugs of the demo AI career catalogue.
 * Slugs MUST NOT change: attempts, deep links and progress refer to them.
 * Server remains authoritative for all progress, status and enrollment data. */
export const AI_ROLE_CATALOG = [
  { key: "product", title: "AI Architect" },
  { key: "ml", title: "AI Engineer" },
  { key: "python", title: "AI Security Engineer" },
  { key: "data", title: "AI Data Engineer" },
  { key: "backend", title: "MLOps Engineer" },
  { key: "design", title: "AI Agent Engineer" },
  { key: "manager", title: "AI Product Engineer" },
] as const;

const catalogByKey = new Map<string, { title: string; order: number }>(
  AI_ROLE_CATALOG.map((item, order) => [item.key, { title: item.title, order }]),
);

/** Upgrade stale demo display names without rewriting server progress.
 * Non-demo/unknown role keys are deliberately left untouched. */
export function canonicalAiRoles(serverRoles: readonly RoleCardView[]): RoleCardView[] {
  return serverRoles
    .map(role => {
      const canonical = catalogByKey.get(role.track_key);
      return canonical ? { ...role, title: canonical.title } : role;
    })
    .sort((a, b) =>
      (catalogByKey.get(a.track_key)?.order ?? Number.MAX_SAFE_INTEGER)
      - (catalogByKey.get(b.track_key)?.order ?? Number.MAX_SAFE_INTEGER),
    );
}

/** Insert only read-only previews for tracks not yet published in a server
 * snapshot; never invent enrollment, completed work or earned grade. */
export function sourceCatalogueRoles(serverRoles: readonly RoleCardView[]): RoleCardView[] {
  const result = canonicalAiRoles(serverRoles);
  const known = new Set(result.map(role => role.track_key));
  const knownTitles = new Set(result.map(role => role.title.trim().toLocaleLowerCase("en-US")));
  for (const item of AI_ROLE_CATALOG) {
    if (known.has(item.key) || knownTitles.has(item.title.toLocaleLowerCase("en-US"))) continue;
    result.push({
      track_key: `catalog-${item.key}-reference`,
      title: item.title,
      state: "unselected",
      attempt_number: null,
      completed_milestones: 0,
      total_milestones: 0,
    });
  }
  return result.sort((a, b) => {
    const normalized = (key: string) => key.replace(/^catalog-/, "").replace(/-reference$/, "");
    return (catalogByKey.get(normalized(a.track_key))?.order ?? Number.MAX_SAFE_INTEGER)
      - (catalogByKey.get(normalized(b.track_key))?.order ?? Number.MAX_SAFE_INTEGER);
  });
}
