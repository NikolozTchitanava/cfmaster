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
  const podium = entries.slice(0, 3);

  return (
    <main className="page-shell">
      <FlashNotice />

      <section className="arena-home-grid">
        <article className="card arena-hero-card leaderboard-hero-card">
          <div className="arena-hero-header">
            <div>
              <p className="eyebrow">Leaderboard</p>
              <h1>Elite ladder. Regional pressure. Rating first.</h1>
            </div>
            <span className="status-pill status-live">Prestige Live</span>
          </div>

          <div className="arena-hero-strip">
            <article className="arena-pulse-card accent-accent">
              <span>Players</span>
              <strong>{entries.length}</strong>
            </article>
            <article className="arena-pulse-card accent-sky">
              <span>Top Rating</span>
              <strong>{entries[0]?.platformRating ?? "--"}</strong>
            </article>
            <article className="arena-pulse-card accent-success">
              <span>Continent</span>
              <strong>{continent}</strong>
            </article>
            <article className="arena-pulse-card accent-danger">
              <span>Country</span>
              <strong>{country}</strong>
            </article>
          </div>

          <div className="pill-row">
            <span className="pill">Global ladder</span>
            <span className="pill">Region filters</span>
            <span className="pill">Tier prestige</span>
            <span className="pill">Sorted by rating</span>
          </div>
        </article>

        <aside className="arena-side-column">
          <article className="card arena-side-card leaderboard-filter-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Filter Stack</p>
                <h2>Scan the ladder</h2>
              </div>
            </div>
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
          </article>
        </aside>
      </section>

      {podium.length ? (
        <section className="podium-grid">
          {podium.map((entry, index) => (
            <article key={entry.handle} className={`card podium-card place-${index + 1}`}>
              <div className="podium-medal">{index === 0 ? "01" : index === 1 ? "02" : "03"}</div>
              <div className="podium-copy">
                <span className="leaderboard-flag">{getCountryFlag(entry.countryCode)}</span>
                <h2>{entry.handle}</h2>
                <p>{entry.rankTier}</p>
              </div>
              <div className="podium-rating">{entry.platformRating}</div>
              <small>
                {entry.country && entry.continent ? `${entry.country} • ${entry.continent}` : entry.country || entry.continent || "Unset"}
              </small>
            </article>
          ))}
        </section>
      ) : null}

      <section className="card leaderboard-stage">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Ranked Ladder</p>
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
                {entries.map((entry) => {
                  const trendUp = entry.wins >= entry.losses;

                  return (
                    <tr key={entry.handle}>
                      <td>
                        <span className={`rank-badge${entry.rank <= 3 ? " is-medal" : ""}`}>{entry.rank}</span>
                      </td>
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
                      <td>
                        <div className="leaderboard-rating-cell">
                          <strong>{entry.platformRating}</strong>
                          <span className={trendUp ? "trend-up" : "trend-down"}>{trendUp ? "▲" : "▼"}</span>
                        </div>
                      </td>
                      <td>{entry.rankTier}</td>
                      <td>{entry.country && entry.continent ? `${entry.country} • ${entry.continent}` : entry.country || entry.continent || "Unset"}</td>
                      <td>{entry.battlesPlayed}</td>
                      <td>{entry.winRate}%</td>
                    </tr>
                  );
                })}
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
