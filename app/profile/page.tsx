import Link from "next/link";

import { FlashNotice } from "@/components/FlashNotice";
import { Heatmap } from "@/components/Heatmap";
import { RatingSparkline } from "@/components/RatingSparkline";
import { buildSnapshotSummary, getDailySuggestions } from "@/lib/cfmasters";
import { getBattleRecord, getUserById } from "@/lib/store";
import { requireCurrentUser } from "@/lib/session";
import { buildProfileUrl, FOCUS_HINTS } from "@/lib/utils";
import type { Focus } from "@/lib/types";

type ProfilePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const focusOptions: Focus[] = ["warmup", "steady", "stretch"];

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const [resolvedSearchParams, sessionUser] = await Promise.all([searchParams ?? Promise.resolve({}), requireCurrentUser()]);
  const user = (await getUserById(sessionUser.id)) ?? sessionUser;
  const [{ calendar, recentDays, statCards, summary }, suggestions, battleRecord] = await Promise.all([
    Promise.resolve(buildSnapshotSummary(user.snapshot)),
    getDailySuggestions(user.snapshot, user.id, user.focus),
    getBattleRecord(user.id)
  ]);

  return (
    <main className="page-shell">
      <FlashNotice searchParams={resolvedSearchParams} />

      <section className="hero-grid card">
        <div className="hero-copy">
          <p className="eyebrow">Profile</p>
          <h1>{user.handle}’s training deck</h1>
          <p className="lead">
            This page combines Codeforces activity with cfmasters-only progress: today’s 3 suggested tasks, your suggestion streak, and your battle record.
          </p>

          <div className="pill-row">
            <span className="pill">Rank: {user.snapshot.profile.rank || "Unrated"}</span>
            <span className="pill">Rating: {summary.ratingDisplay}</span>
            <span className="pill">Last active: {summary.lastActiveLabel}</span>
            <span className="pill">Synced: {summary.syncedAtLabel}</span>
          </div>
        </div>

        <div className="hero-side stack-gap">
          <article className="identity-card">
            <div className="avatar-shell">
              {user.snapshot.profile.titlePhoto ? (
                <img src={user.snapshot.profile.titlePhoto} alt={`${user.handle} avatar`} className="avatar" />
              ) : (
                <div className="avatar avatar-fallback">{user.handle.slice(0, 1).toUpperCase()}</div>
              )}
            </div>
            <div>
              <p className="eyebrow">Codeforces profile</p>
              <h2>{user.handle}</h2>
              <p className="muted-copy">
                {(user.snapshot.profile.rank || "Unrated") +
                  (user.snapshot.profile.maxRating ? ` • peak ${user.snapshot.profile.maxRating}` : "") +
                  (user.snapshot.profile.country ? ` • ${user.snapshot.profile.country}` : "")}
              </p>
            </div>
          </article>

          <div className="hero-actions">
            <form action="/profile/sync" method="post">
              <button type="submit" className="button button-primary">
                Sync profile
              </button>
            </form>
            <a href={buildProfileUrl(user.handle)} target="_blank" rel="noreferrer" className="button button-secondary">
              Open Codeforces
            </a>
          </div>
        </div>
      </section>

      <section className="section-grid">
        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Codeforces activity</p>
              <h2>CF snapshot</h2>
            </div>
          </div>
          <div className="stats-grid">
            {statCards.map((card) => (
              <article className="stat-card" key={card.label}>
                <span>{card.label}</span>
                <strong>{card.value}</strong>
              </article>
            ))}
          </div>
          <Heatmap calendar={calendar} />
        </article>

        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">cfmasters activity</p>
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

          <div className="stats-grid compact-stats">
            <article className="stat-card emphasis-stat">
              <span>Suggestion streak</span>
              <strong>{suggestions.streak} days</strong>
            </article>
            <article className="stat-card">
              <span>Today&apos;s trio</span>
              <strong>{suggestions.todayComplete ? "Done" : "In progress"}</strong>
            </article>
            <article className="stat-card">
              <span>Total battles</span>
              <strong>{battleRecord.total}</strong>
            </article>
            <article className="stat-card">
              <span>Battle record</span>
              <strong>
                {battleRecord.wins}-{battleRecord.losses}
              </strong>
            </article>
          </div>

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
      </section>

      <section className="section-grid">
        <article className="card">
          <RatingSparkline rating={user.snapshot.rating} />
        </article>

        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Recent solved days</p>
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
