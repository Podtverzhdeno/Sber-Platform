/** Keep the backend-owned navigation indices; never synthesize or expose a forbidden destination. */
export const ADDITIONAL_SECTIONS = ["AI-Buddy", "Настройки"] as const;

export type AdditionalSection = (typeof ADDITIONAL_SECTIONS)[number];

export function additionalDestinations(navigation: readonly string[]) {
  return ADDITIONAL_SECTIONS.flatMap((label) => {
    const index = navigation.indexOf(label);
    return index < 0 ? [] : [{ label, href: `/workspace/${String(index)}` }];
  });
}
