import { describe, expect, it } from "vitest";
import { ownStandingQueryKey, selectOwnPublishedStanding, type OwnPublishedStanding } from "./own-standing";

const publishedStanding: OwnPublishedStanding = {
  season_id: "autumn",
  season_key: "autumn-2026",
  season_title: "Осень",
  season_status: "open",
  season_version: 3,
  policy_version: 2,
  place: 6,
  score: "135.50",
  successful_projects: 2,
};
const own = [publishedStanding];

describe("owner-only rating projection", () => {
  it("selects precisely the published season and policy version", () => {
    expect(selectOwnPublishedStanding(own, { id: "autumn", version: 3, policy_version: 2 })).toEqual(own[0]);
    expect(selectOwnPublishedStanding(own, { id: "autumn", version: 4, policy_version: 2 })).toBeNull();
    expect(selectOwnPublishedStanding(own, { id: "autumn", version: 3, policy_version: 3 })).toBeNull();
    expect(selectOwnPublishedStanding(own, { id: "winter", version: 3, policy_version: 2 })).toBeNull();
    expect(selectOwnPublishedStanding(own, null)).toBeNull();
  });

  it("never fabricates a place from invalid or missing standings", () => {
    const season = { id: "autumn", version: 3, policy_version: 2 };
    expect(selectOwnPublishedStanding([], season)).toBeNull();
    expect(selectOwnPublishedStanding([{ ...publishedStanding, place: null }], season)).toBeNull();
    expect(selectOwnPublishedStanding([{ ...publishedStanding, place: 0 }], season)).toBeNull();
    expect(selectOwnPublishedStanding([{ ...publishedStanding, place: -1 }], season)).toBeNull();
    expect(selectOwnPublishedStanding([{ ...publishedStanding, place: 1.5 }], season)).toBeNull();
  });

  it("isolates cache entries by participant, never by public leaderboard", () => {
    expect(ownStandingQueryKey("alice")).not.toEqual(ownStandingQueryKey("bob"));
    expect(ownStandingQueryKey("alice")[0]).toBe("rating-seasons");
    expect(ownStandingQueryKey("alice")).not.toContain("rating-season-leaderboard");
  });
});
