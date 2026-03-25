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
  const arenaPulse = [
    { label: "Platform Rating", value: preview.summary.ratingDisplay, accent: "accent" },
    { label: "Current Streak", value: `${preview.summary.currentStreak}d`, accent: "sky" },
    { label: "Solved 30D", value: String(preview.summary.lastMonthSolved), accent: "success" },
    { label: "Peak Solve Day", value: preview.summary.bestDay ? `${preview.summary.bestDay.count}` : "--", accent: "danger" }
  ] as const;
  const queueCards = [
    { label: "Ranked Duel", value: "1v1", detail: "3 problems • 60 min" },
    { label: "Chip Draft", value: "2 Picks", detail: "Visible crucial + hidden additive" },
    { label: "Difficulty", value: "Adaptive", detail: "Low / Mid / High target bands" }
  ] as const;
  const matchFeed = preview.recentDays.slice(0, 4).map((day, index) => ({
    label: index === 0 ? "Latest Grind" : `Set ${index + 1}`,
    title: day.label,
    score: `${day.count} solved`,
    meta: day.peakRating
  }));
  const ladderPreview = [
    { rank: "01", handle: "tourist", rating: "3520", delta: "+24", region: "Europe" },
    { rank: "02", handle: "Benq", rating: "3388", delta: "+11", region: "Asia" },
    { rank: "03", handle: previewSnapshot.profile.handle, rating: preview.summary.ratingDisplay.replace(/[^\d]/g, "") || "0", delta: "+9", region: "Preview" },
    { rank: "04", handle: "ecnerwala", rating: "3312", delta: "-4", region: "North America" }
  ] as const;

  return (
    <main className="page-shell">
      <FlashNotice />

      <section className="arena-home-grid">
        <article className="card arena-hero-card">
          <div className="arena-hero-header">
            <div>
              <p className="eyebrow">Ranked Arena</p>
              <h1>Prove Your Skill. Win The Arena.</h1>
            </div>
            <span className="status-pill status-live">Queue Live</span>
          </div>

          <div className="arena-hero-strip">
            {arenaPulse.map((item) => (
              <article key={item.label} className={`arena-pulse-card accent-${item.accent}`}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </article>
            ))}
          </div>

          <div className="arena-command-row">
            <div className="arena-rank-block">
              <span className="eyebrow">Arena ID</span>
              <strong>@{previewSnapshot.profile.handle}</strong>
              <small>Suggested tasks, rival scouting, ranked duels, regional ladder.</small>
            </div>
            <div className="arena-progress-card">
              <div className="arena-progress-copy">
                <span>Rank Progress</span>
                <strong>{preview.summary.ratingDisplay}</strong>
              </div>
              <div className="progress-track">
                <span style={{ width: `${Math.min(100, Math.max(18, ((previewSnapshot.profile.rating ?? 1200) % 400) / 4))}%` }} />
              </div>
              <small>Climb your current tier band by stacking accepted solutions under pressure.</small>
            </div>
          </div>

          <div className="hero-actions">
            <Link href="/battle" className="button button-primary">
              Start Battle
            </Link>
            <Link href="/leaderboards" className="button button-secondary">
              View Ladder
            </Link>
            <a href="#auth" className="button button-ghost">
              Enter Arena
            </a>
          </div>
        </article>

        <aside className="arena-side-column">
          <article className="card arena-side-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Queue Pulse</p>
                <h2>Competitive format</h2>
              </div>
            </div>
            <div className="queue-pulse-grid">
              {queueCards.map((item) => (
                <article className="mini-card queue-pulse-card" key={item.label}>
                  <span className="eyebrow">{item.label}</span>
                  <strong>{item.value}</strong>
                  <small>{item.detail}</small>
                </article>
              ))}
            </div>
          </article>

          <article className="card arena-side-card spotlight-card">
            <p className="eyebrow">Arena Signal</p>
            <div className="signal-stack">
              <div className="signal-dot" />
              <div>
                <strong>Focus &gt; speed &gt; precision</strong>
                <small>Every battle is rating-aware, chip-driven, and decided by visible scoring.</small>
              </div>
            </div>
          </article>
        </aside>
      </section>

      <section className="arena-dashboard-grid">
        <article className="card arena-panel leaderboard-preview-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Leaderboard Preview</p>
              <h2>Elite ladder snapshot</h2>
            </div>
            <Link href="/leaderboards" className="button button-ghost">
              Full ladder
            </Link>
          </div>

          <div className="arena-ladder-list">
            {ladderPreview.map((entry, index) => (
              <article key={entry.handle} className={`ladder-row-card${index === 0 ? " is-top" : ""}`}>
                <div className="ladder-row-rank">{entry.rank}</div>
                <div className="ladder-row-copy">
                  <strong>{entry.handle}</strong>
                  <small>{entry.region}</small>
                </div>
                <div className="ladder-row-rating">
                  <strong>{entry.rating}</strong>
                  <span className={entry.delta.startsWith("-") ? "trend-down" : "trend-up"}>{entry.delta}</span>
                </div>
              </article>
            ))}
          </div>
        </article>

        <article className="card arena-panel match-feed-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Match Feed</p>
              <h2>Recent grind cards</h2>
            </div>
            <Link href="/battle#history" className="button button-ghost">
              Match history
            </Link>
          </div>

          <div className="match-feed-grid">
            {matchFeed.map((match) => (
              <article className="match-feed-card" key={`${match.label}-${match.title}`}>
                <span className="eyebrow">{match.label}</span>
                <strong>{match.title}</strong>
                <div className="match-feed-score">{match.score}</div>
                <small>{match.meta}</small>
              </article>
            ))}
          </div>
        </article>

        <article className="card arena-panel preview-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Problems</p>
              <h2>Activity heatmap</h2>
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
      </section>

      <section className="arena-dashboard-grid arena-dashboard-grid-lower">
        <article className="card preview-card" id="contests">
          <RatingSparkline rating={previewSnapshot.rating} />
        </article>

        <article className="card arena-panel intel-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Operator Intel</p>
              <h2>Preview competitor sheet</h2>
            </div>
          </div>
          <div className="list-column compact-list">
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
              <strong>Best solve day</strong>
              <span>{preview.summary.bestDay ? `${preview.summary.bestDay.label} • ${preview.summary.bestDay.count}` : "No data yet"}</span>
            </div>
          </div>
        </article>
      </section>

      <HomeAccountSection />
    </main>
  );
}
