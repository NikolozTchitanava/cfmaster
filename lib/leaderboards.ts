import { unstable_cache } from "next/cache";

import { getRankTier } from "@/lib/battle";
import { ensureDatabase, getSql, shouldUseLocalStore } from "@/lib/db";
import { resolveCountryMetadata } from "@/lib/geo";
import { getLocalLeaderboardEntries } from "@/lib/local-store";
import type { LeaderboardEntry } from "@/lib/types";

type LeaderboardUserRow = {
  handle: string;
  platform_rating: number | null;
  country: string | null;
  battle_wins: number | null;
  battle_losses: number | null;
  battle_draws: number | null;
  battles_played: number | null;
};

const getCachedLeaderboardRows = unstable_cache(
  async (): Promise<LeaderboardUserRow[]> => {
    await ensureDatabase();
    const sql = getSql();
    return sql<LeaderboardUserRow[]>`
      SELECT
        handle,
        platform_rating,
        country,
        battle_wins,
        battle_losses,
        battle_draws,
        battles_played
      FROM users
      ORDER BY platform_rating DESC NULLS LAST, handle_key ASC
    `;
  },
  ["leaderboard-users"],
  { revalidate: 60 }
);

export async function getLeaderboardEntries(filters: {
  query?: string;
  country?: string;
  continent?: string;
}): Promise<LeaderboardEntry[]> {
  if (shouldUseLocalStore()) {
    return getLocalLeaderboardEntries(filters);
  }

  const rows = await getCachedLeaderboardRows();

  const query = filters.query?.trim().toLowerCase() ?? "";
  const countryFilter = filters.country?.trim().toLowerCase() ?? "";
  const continentFilter = filters.continent?.trim().toLowerCase() ?? "";

  return rows
    .map((row) => {
      const resolvedCountry = resolveCountryMetadata(row.country);
      const platformRating = row.platform_rating ?? 1200;
      const battlesPlayed = row.battles_played ?? 0;

      return {
        rank: 0,
        handle: row.handle,
        platformRating,
        rankTier: getRankTier(platformRating),
        country: resolvedCountry.country,
        continent: resolvedCountry.continent,
        countryCode: resolvedCountry.countryCode,
        battlesPlayed,
        wins: row.battle_wins ?? 0,
        losses: row.battle_losses ?? 0,
        draws: row.battle_draws ?? 0,
        winRate: battlesPlayed ? Math.round(((row.battle_wins ?? 0) / battlesPlayed) * 100) : 0
      } satisfies LeaderboardEntry;
    })
    .filter((entry) => {
      if (query && !entry.handle.toLowerCase().includes(query)) {
        return false;
      }
      if (countryFilter && entry.country?.toLowerCase() !== countryFilter) {
        return false;
      }
      if (continentFilter && entry.continent?.toLowerCase() !== continentFilter) {
        return false;
      }

      return true;
    })
    .map((entry, index) => ({
      ...entry,
      rank: index + 1
    }));
}
