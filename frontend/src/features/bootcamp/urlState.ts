/**
 * Bootcamp v2 URL state contract (participant-bootcamp-v2 BC2-201).
 *
 * One parser/serializer pair keeps the address bar canonical and the legacy
 * v1 deep links (`?course=` and the filter names) working unchanged: an
 * unknown or invalid value falls back to its default instead of throwing,
 * so popstate entries from older clients degrade honestly.
 */

export type BootcampView = "card" | "list";

export type BootcampUrlState = {
  view: BootcampView;
  relevance: string;
  track: string;
  category: string | null;
  q: string | null;
  level: string | null;
  course: string | null;
};

export const BOOTCAMP_URL_DEFAULTS: BootcampUrlState = {
  view: "card",
  relevance: "all",
  track: "all",
  category: null,
  q: null,
  level: null,
  course: null,
};

const MAX_TEXT_LENGTH = 120;

function clampText(raw: string | null): string | null {
  if (raw === null) return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  return trimmed.slice(0, MAX_TEXT_LENGTH);
}

export function parseBootcampUrl(searchParams: URLSearchParams): BootcampUrlState {
  const view = searchParams.get("view");
  const relevance = searchParams.get("relevance");
  const track = searchParams.get("track");
  return {
    view: view === "list" || view === "card" ? view : BOOTCAMP_URL_DEFAULTS.view,
    relevance:
      relevance !== null && relevance.trim() !== "" ? relevance.trim() : BOOTCAMP_URL_DEFAULTS.relevance,
    track: track !== null && track.trim() !== "" ? track.trim() : BOOTCAMP_URL_DEFAULTS.track,
    category: clampText(searchParams.get("category")),
    q: clampText(searchParams.get("q")),
    level: clampText(searchParams.get("level")),
    course: clampText(searchParams.get("course")),
  };
}

export function parseBootcampSearch(search: string): BootcampUrlState {
  return parseBootcampUrl(new URLSearchParams(search.startsWith("?") ? search.slice(1) : search));
}

export function serializeBootcampUrl(state: BootcampUrlState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.view === "list") params.set("view", state.view);
  if (state.relevance !== BOOTCAMP_URL_DEFAULTS.relevance) params.set("relevance", state.relevance);
  if (state.track !== BOOTCAMP_URL_DEFAULTS.track) params.set("track", state.track);
  if (state.category !== null) params.set("category", state.category);
  if (state.q !== null) params.set("q", state.q);
  if (state.level !== null) params.set("level", state.level);
  if (state.course !== null) params.set("course", state.course);
  return params;
}

export function bootcampUrlSearch(state: BootcampUrlState): string {
  const serialized = serializeBootcampUrl(state).toString();
  return serialized === "" ? "" : `?${serialized}`;
}

/** Merge helper keeps the deep-linked course anchor unless callers drop it deliberately. */
export function extendBootcampUrlState(
  current: BootcampUrlState,
  patch: Partial<BootcampUrlState>,
): BootcampUrlState {
  return { ...current, ...patch };
}
