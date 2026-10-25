import { useQuery } from "@tanstack/react-query";
import { ChessRook } from "lucide-react";

import { apiRequest } from "../../api/client";
import { selectOwnPublishedStanding, useOwnPublishedStandings } from "./own-standing";

type Season = { id: string; status: string; version: number; policy_version: number | null };

export function TopbarRank({ personId, onOpen }: { personId: string; onOpen: () => void }) {
  // Same published season selection as the full rating page. The owner-only
  // endpoint is authoritative even when public leaderboard consent is off.
  const seasons = useQuery({
    queryKey: ["rating-seasons"],
    queryFn: () => apiRequest<Season[]>("/api/v1/rating-seasons", { cache: "no-store" }),
    staleTime: 30_000,
    retry: false,
  });
  const own = useOwnPublishedStandings(personId);
  const season = seasons.data?.[0] ?? null;
  const standing = selectOwnPublishedStanding(own.data, season);
  const label = standing === null ? "—" : String(standing.place);
  const unavailable = seasons.isError || own.isError;
  const title = unavailable
    ? "Не удалось обновить личное место"
    : standing === null ? "Позиция не опубликована" : `Место ${label}`;
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
