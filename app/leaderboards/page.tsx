import { FlashNotice } from "@/components/FlashNotice";
import { getCountryFlag, getCountryOptions } from "@/lib/geo";
import { getLeaderboardEntries } from "@/lib/leaderboards";
import { getSearchParam } from "@/lib/utils";

type LeaderboardsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const continents = ["Overall", "Africa", "Asia", "Europe", "North America", "Oceania", "South America"] as const;

export default async function LeaderboardsPage({ searchParams }: LeaderboardsPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const query = getSearchParam(resolvedSearchParams.q) ?? "";
  const country = getSearchParam(resolvedSearchParams.country) ?? "Overall";
  const continent = getSearchParam(resolvedSearchParams.continent) ?? "Overall";
  const entries = await getLeaderboardEntries({
    query,
    country: country === "Overall" ? undefined : country,
    continent: continent === "Overall" ? undefined : continent
  });
  const countryOptions = getCountryOptions();

  return (
    <main className="page-shell">
      <FlashNotice />

      <section className="hero-grid card">
        <div className="hero-copy">
          <p className="eyebrow">Leaderboards</p>
          <h1>Global prestige, filtered by region, sorted only by platform rating.</h1>
          <p className="lead">
            Search any player, compare continents and countries, and track which handles are climbing the fastest through the platform’s battle rating ladder.
          </p>

          <div className="pill-row">
            <span className="pill">Overall</span>
            <span className="pill">Continent</span>
            <span className="pill">Country</span>
            <span className="pill">Sorted by rating descending</span>
          </div>
        </div>

        <div className="hero-side">
          <form className="stack-form" method="get">
            <label>
              <span>Search username</span>
              <input type="text" name="q" defaultValue={query} placeholder="tourist" />
            </label>
            <label>
              <span>Continent</span>
              <select name="continent" defaultValue={continent}>
                {continents.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Country</span>
              <select name="country" defaultValue={country}>
                <option value="Overall">Overall</option>
                {countryOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="button button-primary wide-button">
              Update leaderboard
            </button>
          </form>
        </div>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Ranked ladder</p>
            <h2>Competitive standings</h2>
          </div>
        </div>

        {entries.length ? (
          <div className="leaderboard-table-shell">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Player</th>
                  <th>Rating</th>
                  <th>Tier</th>
                  <th>Region</th>
                  <th>Total battles</th>
                  <th>Winrate</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.handle}>
                    <td>{entry.rank}</td>
                    <td>
                      <div className="leaderboard-player">
                        <span className="leaderboard-flag">{getCountryFlag(entry.countryCode)}</span>
                        <div>
                          <strong>{entry.handle}</strong>
                          <small>
                            {entry.wins}W • {entry.losses}L • {entry.draws}D
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>{entry.platformRating}</td>
                    <td>{entry.rankTier}</td>
                    <td>{entry.country && entry.continent ? `${entry.country} • ${entry.continent}` : entry.country || entry.continent || "Unset"}</td>
                    <td>{entry.battlesPlayed}</td>
                    <td>{entry.winRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-plate">No leaderboard entries matched those filters.</div>
        )}
      </section>
    </main>
  );
}
