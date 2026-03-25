"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type SessionPayload = {
  user: {
    id: string;
    handle: string;
  } | null;
};

export function SiteHeader() {
  const [session, setSession] = useState<SessionPayload | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/session", {
      credentials: "same-origin",
      cache: "no-store"
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Could not load session.");
        }

        return (await response.json()) as SessionPayload;
      })
      .then((payload) => {
        if (!cancelled) {
          setSession(payload);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSession({ user: null });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

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
        <Link href="/leaderboards">Leaderboards</Link>
      </nav>

      <div className="site-actions">
        {session?.user ? (
          <>
            <span className="handle-pill">@{session.user.handle}</span>
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
