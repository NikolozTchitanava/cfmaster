import Link from "next/link";

import { FlashNotice } from "@/components/FlashNotice";
import { Heatmap } from "@/components/Heatmap";
import { RatingSparkline } from "@/components/RatingSparkline";
import { getBattleDashboard } from "@/lib/battle-store";
import { getRankTier } from "@/lib/battle";
import { buildSnapshotSummary, getDailySuggestions } from "@/lib/cfmasters";
import { isDatabaseConfigured } from "@/lib/db";
import { getCountryOptions } from "@/lib/geo";
import { getLeaderboardEntries } from "@/lib/leaderboards";
import { getBattleRecord } from "@/lib/store";
import { requireCurrentUser } from "@/lib/session";
import { buildProfileUrl, FOCUS_HINTS } from "@/lib/utils";
import type { Focus } from "@/lib/types";

type ProfilePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const focusOptions: Focus[] = ["warmup", "steady", "stretch"];
const countryOptions = getCountryOptions();
const focusTopicMap: Record<Focus, string[]> = {
  warmup: ["Implementation", "Brute Force", "Greedy"],
  steady: ["Math", "Binary Search", "Data Structures"],
  stretch: ["DP", "Graphs", "Game Theory"]
};

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  await searchParams;
  const sessionUser = await requireCurrentUser();
  const user = sessionUser;
  const [{ calendar, recentDays, statCards, summary }, suggestions, battleRecord, countryEntries, battleDashboard] = await Promise.all([
    Promise.resolve(buildSnapshotSummary(user.snapshot)),
    getDailySuggestions(user.snapshot, user.id, user.focus),
    getBattleRecord(user.id),
    user.country ? getLeaderboardEntries({ country: user.country }) : Promise.resolve([]),
    isDatabaseConfigured() ? getBattleDashboard(user.id).catch(() => null) : Promise.resolve(null)
  ]);
  const rankTier = getRankTier(user.platformRating);
  const countryStanding = user.country ? countryEntries.findIndex((entry) => entry.handle.toLowerCase() === user.handle.toLowerCase()) + 1 : 0;
  const recentBattles = battleDashboard?.recentBattles.slice(0, 4) ?? [];
  const badges = [
    suggestions.streak >= 3 ? "Daily Grinder" : null,
    battleRecord.winRate >= 60 && battleRecord.total ? "Closer" : null,
    summary.lastMonthSolved >= 20 ? "Volume Machine" : null,
    user.platformRating >= 1600 ? "Arena Threat" : null,
    summary.longestStreak >= 7 ? "Consistency Core" : null
  ].filter(Boolean) as string[];

  return (
    <main className="page-shell">
      <FlashNotice />

      <section className="profile-command-grid">
        <article className="card profile-hero-card">
          <div className="identity-card identity-card-hero">
            <div className="avatar-shell">
              {user.snapshot.profile.titlePhoto ? (
                <img src={user.snapshot.profile.titlePhoto} alt={`${user.handle} avatar`} className="avatar avatar-lg" />
              ) : (
                <div className="avatar avatar-fallback avatar-lg">{user.handle.slice(0, 1).toUpperCase()}</div>
              )}
            </div>
            <div className="identity-copy">
              <div className="hero-inline-top">
                <p className="eyebrow">Competitor Profile</p>
                <span className="status-pill status-live">{rankTier}</span>
              </div>
              <h1>{user.handle}</h1>
              <div className="pill-row">
                <span className="pill">{user.snapshot.profile.rank || "Unrated"}</span>
                <span className="pill">Peak {user.snapshot.profile.maxRating ?? "--"}</span>
                <span className="pill">{user.country || "Country unset"}</span>
                <span className="pill">Synced {summary.syncedAtLabel}</span>
              </div>
            </div>
          </div>

          <div className="profile-badge-row">
            {(badges.length ? badges : ["Arena Initiate", "Build your streak", "Play your first battle"]).map((badge) => (
              <span className="achievement-badge" key={badge}>
                {badge}
              </span>
            ))}
          </div>

          <div className="hero-actions">
            <form action="/profile/sync" method="post">
              <button type="submit" className="button button-primary">
                Sync Profile
              </button>
            </form>
            <a href={buildProfileUrl(user.handle)} target="_blank" rel="noreferrer" className="button button-secondary">
              Open Codeforces
            </a>
            <Link href="/battle" className="button button-ghost">
              Start Battle
            </Link>
          </div>
        </article>

        <article className="card profile-rating-card">
          <p className="eyebrow">Platform Rating</p>
          <div className="profile-rating-stack">
            <strong>{user.platformRating}</strong>
            <span>{rankTier}</span>
          </div>
          <div className="profile-rating-grid">
            <div className="mini-stat-card">
              <span>Winrate</span>
              <strong>{battleRecord.winRate}%</strong>
            </div>
            <div className="mini-stat-card">
              <span>Record</span>
              <strong>
                {battleRecord.wins}-{battleRecord.losses}-{battleRecord.draws}
              </strong>
            </div>
            <div className="mini-stat-card">
              <span>Country Rank</span>
              <strong>{countryStanding || "--"}</strong>
            </div>
            <div className="mini-stat-card">
              <span>Last Active</span>
              <strong>{summary.lastActiveLabel}</strong>
            </div>
          </div>
        </article>
      </section>

      <section className="stats-grid stats-grid-profile">
        {statCards.map((card) => (
          <article className="stat-card" key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </article>
        ))}
        <article className="stat-card emphasis-stat">
          <span>Suggestion streak</span>
          <strong>{suggestions.streak} days</strong>
        </article>
        <article className="stat-card">
          <span>Today&apos;s trio</span>
          <strong>{suggestions.todayComplete ? "Cleared" : "Live"}</strong>
        </article>
      </section>

      <section className="section-grid">
        <article className="card" id="contests">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Contest Curve</p>
              <h2>Rating graph</h2>
            </div>
          </div>
          <RatingSparkline rating={user.snapshot.rating} />
        </article>

        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Match History</p>
              <h2>Recent duels</h2>
            </div>
            <Link href="/battle#history" className="button button-ghost">
              Full history
            </Link>
          </div>

          <div className="match-feed-grid profile-match-grid">
            {recentBattles.length ? (
              recentBattles.map((battle) => (
                <Link href={battle.href} key={battle.id} className="match-feed-card">
                  <span className="eyebrow">{battle.status}</span>
                  <strong>{battle.opponentHandle}</strong>
                  <div className="match-feed-score">{battle.scoreline}</div>
                  <small>{battle.startedAt ? new Date(battle.startedAt).toLocaleString() : "Completed battle"}</small>
                </Link>
              ))
            ) : (
              <div className="empty-plate">No battle log yet. Queue your first duel from the battle page.</div>
            )}
          </div>
        </article>
      </section>

      <section className="section-grid">
        <article className="card" id="problems">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Problems Deck</p>
              <h2>Daily training plan</h2>
            </div>
          </div>

          <form action="/profile/focus" method="post" className="focus-row">
            {focusOptions.map((focus) => (
              <button
                key={focus}
                type="submit"
                name="focus"
                value={focus}
                className={`focus-chip${user.focus === focus ? " is-active" : ""}`}
              >
                {focus}
              </button>
            ))}
          </form>
          <p className="muted-copy">{FOCUS_HINTS[user.focus]}</p>

          <div className="task-list">
            {suggestions.tasks.map((task) => (
              <article className="task-card" key={task.problemKey}>
                <div>
                  <span className="task-rating">{task.rating}</span>
                  <h3>{task.name}</h3>
                  <p className="muted-copy">Target band {task.targetRating}</p>
                </div>
                <div className="task-actions">
                  <span className={`status-pill${task.solvedToday ? " is-done" : ""}`}>{task.solvedToday ? "Solved today" : "Pending"}</span>
                  <a href={task.link} target="_blank" rel="noreferrer" className="button button-secondary">
                    Open
                  </a>
                </div>
              </article>
            ))}
          </div>
        </article>

        <article className="card">
          <RatingSparkline rating={user.snapshot.rating} />
          <div className="section-heading">
            <div>
              <p className="eyebrow">Profile Kit</p>
              <h2>Badges, topics, region</h2>
            </div>
          </div>

          <div className="profile-side-stack">
            <div className="profile-topic-panel">
              <span className="eyebrow">Preferred topics</span>
              <div className="pill-row">
                {focusTopicMap[user.focus].map((topic) => (
                  <span key={topic} className="achievement-badge subtle">
                    {topic}
                  </span>
                ))}
              </div>
            </div>

            <form action="/profile/country" method="post" className="stack-form battle-country-form">
              <label>
                <span>Country</span>
                <select name="country" defaultValue={user.country ?? ""}>
                  <option value="">Set country</option>
                  {countryOptions.map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="button button-secondary">
                Save country
              </button>
            </form>

            <div className="list-column compact-list">
              <div className="list-item">
                <strong>Country ladder</strong>
                <span>{countryStanding ? `#${countryStanding} in ${user.country}` : "Set country to rank regionally"}</span>
              </div>
              <div className="list-item">
                <strong>Total battles</strong>
                <span>{battleRecord.total}</span>
              </div>
              <div className="list-item">
                <strong>Friends radar</strong>
                <span>Scout rivals and tracked handles</span>
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className="section-grid">
        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Activity Heatmap</p>
              <h2>Consistency board</h2>
            </div>
          </div>
          <Heatmap calendar={calendar} />
        </article>

        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Recent Activity</p>
              <h2>Quick recap</h2>
            </div>
            <Link href="/friends" className="button button-secondary">
              Open friends
            </Link>
          </div>
          <div className="list-column">
            {recentDays.length ? (
              recentDays.map((day) => (
                <div className="list-item" key={day.date}>
                  <strong>{day.label}</strong>
                  <span>
                    {day.count} solved • {day.peakRating}
                  </span>
                </div>
              ))
            ) : (
              <div className="empty-plate">No solved days recorded yet.</div>
            )}
          </div>
        </article>
      </section>
    </main>
  );
}
