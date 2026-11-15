/** Exact index mapping: actor.navigation from backend remains the only route authority. */
export const COMMUNITY_SECTIONS = ["События", "Сообщения"] as const;

export type CommunitySection = (typeof COMMUNITY_SECTIONS)[number];

export function communityDestinations(navigation: readonly string[]) {
  return COMMUNITY_SECTIONS.flatMap((label) => {
    const index = navigation.indexOf(label);
    return index >= 0 ? [{ label, href: `/workspace/${String(index)}` }] : [];
  });
}
