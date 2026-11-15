/** All course deep links derive from the authorized server navigation order. */
export function courseDestination(
  navigation: readonly string[],
  trackKey: string | null,
  courseKey?: string,
): string | null {
  const index = navigation.indexOf("Bootcamp");
  if (index === -1) return null;
  const params = new URLSearchParams();
  if (trackKey !== null) params.set("role", trackKey);
  if (courseKey) {
    params.set("course", courseKey);
    params.set("panel", "detail");
  }
  const query = params.toString();
  return "/workspace/" + String(index) + (query ? "?" + query : "");
}
