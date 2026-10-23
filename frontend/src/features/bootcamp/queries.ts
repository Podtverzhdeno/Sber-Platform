/**
 * Bootcamp v2 query rules (participant-bootcamp-v2 BC2-204).
 *
 * Pure contract helpers: the overview snapshot is independent of view/filter
 * toggles, so switching card/list or filters never re-reads it; details are
 * lazily requested per course and re-read only when the server revision
 * changes. The page wiring must derive its fetch decisions from these keys.
 */
import { serializeBootcampUrl, type BootcampUrlState } from "./urlState";

/** Canonical overview identity: URL state minus the pure client-side toggles. */
export type OverviewQueryKey = {
  kind: "overview";
  relevance: BootcampUrlState["relevance"];
  track: string;
};

export function overviewQueryKey(state: BootcampUrlState): OverviewQueryKey {
  return { kind: "overview", relevance: state.relevance, track: state.track };
}

/**
 * True when the state change can be served purely from the already loaded
 * snapshot: view mode, text filters, category/level narrow the rendering, the
 * course anchor scrolls — none of them touch the overview snapshot. Only a
 * relevance/track change re-scopes the request itself.
 */
export function isOverviewKeyStable(
  previous: BootcampUrlState,
  next: BootcampUrlState,
): boolean {
  const before = overviewQueryKey(previous);
  const after = overviewQueryKey(next);
  return before.relevance === after.relevance && before.track === after.track;
}

/** Course detail identity: lazy per course, re-read only on server revision change. */
export function courseDetailQueryKey(courseKey: string, revision: string): string {
  return `course:${courseKey}@${revision}`;
}

/** Full overview request URL for the page wiring (canonical, default-free). */
export function overviewRequestUrl(baseUrl: string, state: BootcampUrlState): string {
  const search = serializeBootcampUrl(state).toString();
  if (search.length === 0) return baseUrl;
  const delimiter = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${delimiter}${search}`;
}
