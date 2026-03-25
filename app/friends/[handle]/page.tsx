import { redirect } from "next/navigation";

import { FlashNotice } from "@/components/FlashNotice";
import { Heatmap } from "@/components/Heatmap";
import { RatingSparkline } from "@/components/RatingSparkline";
import { buildSnapshotSummary } from "@/lib/cfmasters";
import { getFriendSnapshotForViewer } from "@/lib/store";
import { requireCurrentUser } from "@/lib/session";
import { withMessage } from "@/lib/utils";

type FriendDetailPageProps = {
  params: Promise<{ handle: string }>;
};

export default async function FriendDetailPage({ params }: FriendDetailPageProps) {
  const [{ handle }, user] = await Promise.all([params, requireCurrentUser()]);

  try {
    const friend = await getFriendSnapshotForViewer(user.id, handle);
    const { calendar, recentDays, statCards, summary } = buildSnapshotSummary(friend.snapshot);

    return (
      <main className="page-shell">
        <FlashNotice />

        <section className="hero-grid card">
          <div className="hero-copy">
            <p className="eyebrow">{friend.isRegistered ? "Registered friend" : "Tracked Codeforces handle"}</p>
            <h1>{friend.handle}’s profile</h1>
            <p className="lead">Open a friend to inspect their CF history, solve rhythm, and recent activity without leaving your own dashboard.</p>

            <div className="pill-row">
              <span className="pill">Rating: {summary.ratingDisplay}</span>
              <span className="pill">Current streak: {summary.currentStreak}</span>
              <span className="pill">Last active: {summary.lastActiveLabel}</span>
              <span className="pill">Synced: {summary.syncedAtLabel}</span>
            </div>
          </div>

          <div className="hero-side stack-gap">
            <div className="hero-actions">
              <form action={`/friends/${encodeURIComponent(friend.handle)}/sync`} method="post">
                <button type="submit" className="button button-primary">
                  Refresh handle
                </button>
              </form>
              <a href={friend.profileUrl} target="_blank" rel="noreferrer" className="button button-secondary">
                Open Codeforces
              </a>
            </div>
          </div>
        </section>

        <section className="section-grid">
          <article className="card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Activity</p>
                <h2>Solve heatmap</h2>
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
            <RatingSparkline rating={friend.snapshot.rating} />
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
                <div className="empty-plate">No recent solved days recorded for this handle yet.</div>
              )}
            </div>
          </article>
        </section>
      </main>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not open that friend profile.";
    redirect(withMessage("/friends", "error", message));
  }
}
