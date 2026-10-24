import type { RoleCardView } from "../client";

/** Approved role cards missing from some actor snapshots.
 * They are only catalog previews, never enrolled trajectories or progress. */
const REFERENCE_CATALOG: ReadonlyArray<{ title: string; key: string; order: number; aliases: string[] }> = [
  { title: "Продуктовый аналитик", key: "catalog-product-reference", order: 0, aliases: ["продуктовый аналитик"] },
  { title: "ML-инженер", key: "catalog-ml-reference", order: 1, aliases: ["ml-инженер", "ml engineer"] },
  { title: "Python-разработчик", key: "catalog-python-reference", order: 2, aliases: ["python-разработчик", "python developer"] },
  { title: "Аналитик данных", key: "catalog-data-reference", order: 3, aliases: ["аналитик данных", "data analyst"] },
  { title: "Backend-разработчик", key: "catalog-backend-reference", order: 4, aliases: ["backend-разработчик", "backend developer"] },
  { title: "UX/UI-дизайнер", key: "catalog-design-reference", order: 5, aliases: ["ux/ui-дизайнер", "ux/ui дизайнер"] },
  { title: "Менеджер проекта", key: "catalog-manager-reference", order: 6, aliases: ["менеджер проекта", "project manager"] },
];

function categoryIndex(role: RoleCardView): number {
  const normalized = role.title.trim().toLocaleLowerCase("ru-RU");
  const found = REFERENCE_CATALOG.find(item => item.aliases.includes(normalized));
  return found?.order ?? Number.MAX_SAFE_INTEGER;
}

/** Display server roles without mutation; insert only missing approved cards.
 * A synthetic catalog card may open an empty preview, but must never
 * display progress, action completion, or a server-granted enrollment.
 */
export function sourceCatalogueRoles(serverRoles: readonly RoleCardView[]): RoleCardView[] {
  const result = [...serverRoles];
  const known = new Set(serverRoles.map(item => item.title.trim().toLocaleLowerCase("ru-RU")));
  const keys = new Set(serverRoles.map(item => item.track_key));

  for (const candidate of REFERENCE_CATALOG) {
    if (candidate.aliases.some(alias => known.has(alias))) continue;
    if (keys.has(candidate.key)) continue;
    result.push({
      track_key: candidate.key,
      title: candidate.title,
      state: "unselected",
      attempt_number: null,
      completed_milestones: 0,
      total_milestones: 0,
    });
    keys.add(candidate.key);
  }
  return result.sort((a, b) => categoryIndex(a) - categoryIndex(b));
}
