"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type SessionPayload = {
  user: {
    id: string;
    handle: string;
  } | null;
};

export function SiteHeader() {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const pathname = usePathname();

  const primaryLinks = [
    { href: "/battle", label: "Battle", match: "/battle" },
    { href: "/leaderboards", label: "Leaderboard", match: "/leaderboards" },
    { href: "/profile#problems", label: "Problems", match: "/profile" },
    { href: "/profile#contests", label: "Contests", match: "/profile" },
    { href: "/profile", label: "Profile", match: "/profile" },
    { href: "/battle#history", label: "Match History", match: "/battle" }
  ] as const;

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
    <>
      <header className="site-header">
        <div className="site-brand-block">
          <Link href="/" className="brand">
            <span className="brand-mark">cf</span>
            <span className="brand-copy">
              <strong>masters arena</strong>
              <small>Ranked head-to-head coding</small>
            </span>
          </Link>
          <div className="header-status-rail">
            <span className="status-pill status-live">Season 01</span>
            <span className="header-status-copy">Ranked queue online</span>
          </div>
        </div>

        <nav className="site-nav" aria-label="Primary">
          {primaryLinks.map((link) => {
            const isActive = pathname === link.match || pathname.startsWith(`${link.match}/`);
            return (
              <Link key={link.label} href={link.href} className={`nav-chip${isActive ? " is-active" : ""}`}>
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="site-actions">
          <Link href="/friends" className="button button-ghost">
            Friends
          </Link>
          {session?.user ? (
            <>
              <div className="handle-panel">
                <span className="eyebrow">Online</span>
                <strong>@{session.user.handle}</strong>
              </div>
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

      <Link href="/battle" className="floating-battle-cta">
        Start Battle
      </Link>
    </>
  );
}
