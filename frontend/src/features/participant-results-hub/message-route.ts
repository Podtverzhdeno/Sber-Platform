/** Only a participant route actually published in the actor's navigation is navigable. */
export function authorizedMessagesRoute(
  actor: { active_role: string; navigation: readonly string[] } | null | undefined,
): string | null {
  if (actor?.active_role !== "participant") return null;
  const index = actor.navigation.indexOf("Сообщения");
  return index < 0 ? null : `/workspace/${String(index)}`;
}
