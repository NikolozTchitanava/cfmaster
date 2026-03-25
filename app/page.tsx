import Link from "next/link";

import { FlashNotice } from "@/components/FlashNotice";
import { Heatmap } from "@/components/Heatmap";
import { HomeAccountSection } from "@/components/HomeAccountSection";
import { RatingSparkline } from "@/components/RatingSparkline";
import { buildSnapshotSummary } from "@/lib/cfmasters";
import { getHomePreviewSnapshot } from "@/lib/demo-preview";
import { buildProfileUrl } from "@/lib/utils";

export default async function HomePage() {
  const previewSnapshot = await getHomePreviewSnapshot();
  const preview = buildSnapshotSummary(previewSnapshot);

  return (
    <main className="page-shell">
      <FlashNotice />

      <section className="hero-grid hero-home card">
        <div className="hero-copy">
          <p className="eyebrow">Explore Codeforces through handles</p>
          <h1>cfmasters turns raw CF history into one simple training and friends dashboard.</h1>
          <p className="lead">
            Track your Codeforces rhythm, challenge other members to transparent 1v1 battles, and follow the live platform ladder without leaving one app.
          </p>

          <div className="pill-row">
            <span className="pill">3 daily suggested tasks</span>
            <span className="pill">Adjustable practice focus</span>
            <span className="pill">Friends handle summaries</span>
            <span className="pill">Live 1v1 battles + leaderboards</span>
          </div>

          <div className="hero-actions">
            <a href="#auth" className="button button-primary">
              Login / signup
            </a>
            <Link href="/battle" className="button button-secondary">
              Enter battle lobby
            </Link>
            <Link href="/leaderboards" className="button button-secondary">
              Open leaderboards
            </Link>
          </div>
        </div>

        <div className="hero-side stack-gap">
          <article className="mini-card spotlight-card">
            <span className="eyebrow">What this site is for</span>
            <strong>See your own training, inspect a friend’s rhythm, and follow Codeforces handles without leaving one app.</strong>
          </article>
          <article className="mini-card">
            <span className="eyebrow">Profile page</span>
            <p>Login-gated CF activity, rating trend, 3-task daily plan, suggestion streak, and battle record.</p>
          </article>
          <article className="mini-card">
            <span className="eyebrow">Friends page</span>
            <p>Quick cards for your tracked handles and registered friends, with direct jump into each profile.</p>
          </article>
          <article className="mini-card">
            <span className="eyebrow">Battle page</span>
            <p>Live 60-minute duels with rating-aware problem picks, visible crucial chips, and transparent Codeforces-style scoring.</p>
          </article>
          <article className="mini-card">
            <span className="eyebrow">Leaderboards</span>
            <p>Global platform rating ladder with region filters, country flags, and prestige-focused rank tiers.</p>
          </article>
        </div>
      </section>

      <section className="feature-grid">
        <article className="card preview-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Live style preview</p>
              <h2>Sample Codeforces activity</h2>
            </div>
            <a href={buildProfileUrl(previewSnapshot.profile.handle)} target="_blank" rel="noreferrer" className="button button-secondary">
              Open CF
            </a>
          </div>

          <div className="stats-grid">
            {preview.statCards.slice(0, 4).map((card) => (
              <article className="stat-card" key={card.label}>
                <span>{card.label}</span>
                <strong>{card.value}</strong>
              </article>
            ))}
          </div>

          <Heatmap calendar={preview.calendar} />
        </article>

        <article className="card preview-card">
          <RatingSparkline rating={previewSnapshot.rating} />
          <div className="stack-gap">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Handle walkthrough</p>
                <h2>@{previewSnapshot.profile.handle}</h2>
              </div>
            </div>
            <p className="muted-copy">
              Ratings, streaks, active days, and solved history all come straight from a Codeforces handle sync, then the app layers on cfmasters-only stats like daily suggestion streaks and friend shortcuts.
            </p>
            <div className="list-column">
              <div className="list-item">
                <strong>Current rating</strong>
                <span>{preview.summary.ratingDisplay}</span>
              </div>
              <div className="list-item">
                <strong>Longest streak</strong>
                <span>{preview.summary.longestStreak} days</span>
              </div>
              <div className="list-item">
                <strong>Last active</strong>
                <span>{preview.summary.lastActiveLabel}</span>
              </div>
              <div className="list-item">
                <strong>Recent best day</strong>
                <span>{preview.summary.bestDay ? `${preview.summary.bestDay.count} solved` : "No solved days yet"}</span>
              </div>
            </div>
          </div>
        </article>
      </section>

      <HomeAccountSection />
    </main>
  );
}
