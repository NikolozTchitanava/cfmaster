import Link from "next/link";

import type { StoredUser } from "@/lib/types";

type SiteHeaderProps = {
  user: StoredUser | null;
};

export function SiteHeader({ user }: SiteHeaderProps) {
  return (
    <header className="site-header">
      <Link href="/" className="brand">
        <span className="brand-mark">cf</span>
        <span className="brand-copy">
          <strong>masters</strong>
          <small>Codeforces activity tracker</small>
        </span>
      </Link>

      <nav className="site-nav" aria-label="Primary">
        <Link href="/">Home</Link>
        <Link href="/profile">Profile</Link>
        <Link href="/friends">Friends</Link>
        <Link href="/battle">Battle</Link>
      </nav>

      <div className="site-actions">
        {user ? (
          <>
            <span className="handle-pill">@{user.handle}</span>
            <form action="/auth/logout" method="post">
              <button type="submit" className="button button-secondary">
                Sign out
              </button>
            </form>
          </>
        ) : (
          <a href="/#auth" className="button button-secondary">
            Login / Signup
          </a>
        )}
      </div>
    </header>
  );
}
