/** Private season standing for the current participant.
 *
 * Public leaderboard anonymization is intentional. Never reidentify the
 * owner from that list or infer a place from streak, XP, or course progress.
 */
import { useQuery } from "@tanstack/react-query";
import { apiRequest, type RuntimeApiPath } from "../../api/client";

export type PublishedSeasonRef = {
  id: string;
  version: number;
  policy_version: number | null;
};

export type OwnPublishedStanding = {
  season_id: string;
  season_key: string;
  season_title: string;
  season_status: string;
  season_version: number;
  policy_version: number | null;
  place: number | null;
  score: string | number | null;
  successful_projects: number | null;
};

export const ownStandingQueryKey = (personId: string) =>
  ["rating-seasons", "own-standing", personId] as const;

export function useOwnPublishedStandings(personId: string | null | undefined) {
  return useQuery({
    queryKey: ownStandingQueryKey(personId ?? ""),
    queryFn: () => apiRequest<OwnPublishedStanding[]>(
      "/api/v1/me/rating/standings" as RuntimeApiPath,
      { cache: "no-store" },
    ),
    enabled: Boolean(personId),
    staleTime: 30_000,
    retry: false,
    refetchOnMount: "always",
  });
}

/** Never mix an older season projection with a newer public season version. */
export function selectOwnPublishedStanding(
  own: OwnPublishedStanding[] | undefined,
  season: PublishedSeasonRef | null | undefined,
): OwnPublishedStanding | null {
  if (!own || !season) return null;
  const standing = own.find(item => item.season_id === season.id);
  if (!standing ||
    standing.season_version !== season.version ||
    standing.policy_version !== season.policy_version ||
    !Number.isSafeInteger(standing.place) ||
    (standing.place ?? 0) <= 0) {
    return null;
  }
  return standing;
}
