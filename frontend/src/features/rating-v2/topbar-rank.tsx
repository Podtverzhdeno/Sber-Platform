import { useQuery } from "@tanstack/react-query";
import { ChessRook } from "lucide-react";

import { apiRequest, type RuntimeApiPath } from "../../api/client";

type Season = { id: string; status: string };
type PublishedEntry = {
  person_id: string | null;
  anonymized: boolean;
  place: number;
};

export function TopbarRank({ personId, onOpen }: { personId: string; onOpen: () => void }) {
  // Reuse the exact same published-season/leaderboard cache as the rating page.
  // Do not infer ranking from streak, XP, or provisional scores.
  const seasons = useQuery({
    queryKey: ["rating-seasons"],
    queryFn: () => apiRequest<Season[]>("/api/v1/rating-seasons", { cache: "no-store" }),
    staleTime: 30_000,
    retry: false,
  });
  const seasonId = seasons.data?.[0]?.id ?? null;
  const leaderboard = useQuery({
    queryKey: ["rating-season-leaderboard", seasonId],
    queryFn: () => apiRequest<PublishedEntry[]>(
      `/api/v1/rating-seasons/${encodeURIComponent(seasonId ?? "")}/leaderboard` as RuntimeApiPath,
      { cache: "no-store" },
    ),
    enabled: seasonId !== null,
    staleTime: 30_000,
    retry: false,
  });
  const place = leaderboard.data?.find(entry =>
    !entry.anonymized &&
    entry.person_id === personId &&
    Number.isInteger(entry.place) &&
    entry.place > 0
  )?.place ?? null;
  const label = place === null ? "—" : String(place);
  const title = place === null ? "Позиция не опубликована" : `Место ${label}`;
  return (
    <button
      className="ranking-utility ranking-utility--personal"
      type="button"
      aria-label={`Открыть рейтинг участников. Ваше место: ${label}`}
      title={title}
      onClick={onOpen}
    >
      <span className="ranking-utility-symbol" aria-hidden="true"><ChessRook size={15} strokeWidth={2.3} /></span>
      <span className="ranking-utility-copy">
        <strong>Рейтинг</strong>
        <small>Место <b>{label}</b></small>
      </span>
    </button>
  );
}
