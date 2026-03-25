import Link from "next/link";

import { FlashNotice } from "@/components/FlashNotice";
import { requireCurrentUser } from "@/lib/session";
import { getFriendsForUser } from "@/lib/store";

type FriendsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FriendsPage({ searchParams }: FriendsPageProps) {
  await searchParams;
  const user = await requireCurrentUser();
  const friends = await getFriendsForUser(user.id);

  return (
    <main className="page-shell">
      <FlashNotice />

      <section className="hero-grid card hero-home">
        <div className="hero-copy">
          <p className="eyebrow">Friends</p>
          <h1>Quick summaries for the handles you care about</h1>
          <p className="lead">
            Add a registered member by email or handle, or track any public Codeforces handle. Press any card and you’ll jump into that profile.
          </p>
        </div>

        <div className="hero-side">
          <form action="/friends/add" method="post" className="stack-form">
            <label>
              <span>Email or Codeforces handle</span>
              <input type="text" name="identifier" placeholder="friend@example.com or tourist" required />
            </label>
            <button type="submit" className="button button-primary wide-button">
              Add friend / handle
            </button>
          </form>
        </div>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Your friends list</p>
            <h2>Friend summaries</h2>
          </div>
        </div>

        {friends.length ? (
          <div className="friends-grid">
            {friends.map((friend) => (
              <Link href={friend.detailHref} key={`${friend.handle}-${friend.isRegistered ? "member" : "tracked"}`} className="friend-card">
                <div className="friend-card-head">
                  <div>
                    <span className="friend-label">{friend.isRegistered ? "Registered friend" : "Tracked handle"}</span>
                    <h3>{friend.handle}</h3>
                  </div>
                  <span className="friend-rating">{friend.ratingDisplay}</span>
                </div>
                <p className="muted-copy">{friend.rank}</p>
                <div className="friend-metrics">
                  <span>{friend.currentStreak} day streak</span>
                  <span>{friend.lastMonthSolved} solved in 30d</span>
                </div>
                <small>Synced {friend.syncedAtLabel}</small>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-plate">No friends or tracked handles yet. Add one above and the summary cards will appear here.</div>
        )}
      </section>
    </main>
  );
}
