"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type SessionPayload = {
  user: {
    id: string;
    handle: string;
  } | null;
};

export function HomeAccountSection() {
  const [session, setSession] = useState<SessionPayload | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/session", {
      credentials: "same-origin",
      cache: "no-store"
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Could not load session state.");
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

  if (session?.user) {
    return (
      <section className="arena-access-grid">
        <article className="card arena-access-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Operator</p>
              <h2>@{session.user.handle}</h2>
            </div>
            <span className="status-pill status-live">Ready</span>
          </div>
          <div className="access-stat-strip">
            <div className="mini-stat-card">
              <span>Queue</span>
              <strong>Ranked</strong>
            </div>
            <div className="mini-stat-card">
              <span>Status</span>
              <strong>Live</strong>
            </div>
            <div className="mini-stat-card">
              <span>Mode</span>
              <strong>1v1</strong>
            </div>
          </div>
          <div className="hero-actions">
            <Link href="/battle" className="button button-primary">
              Enter Arena
            </Link>
            <Link href="/profile" className="button button-secondary">
              Open Profile
            </Link>
            <Link href="/leaderboards" className="button button-ghost">
              View Ladder
            </Link>
          </div>
        </article>

        <article className="card arena-access-card access-side-card">
          <p className="eyebrow">Command Menu</p>
          <div className="list-column compact-list">
            <Link href="/profile#problems" className="list-item list-link">
              <strong>Problems</strong>
              <span>Daily set and practice focus</span>
            </Link>
            <Link href="/battle#history" className="list-item list-link">
              <strong>Match History</strong>
              <span>Review recent duels and scorelines</span>
            </Link>
            <Link href="/friends" className="list-item list-link">
              <strong>Friends Radar</strong>
              <span>Scout tracked handles and rivals</span>
            </Link>
          </div>
        </article>
      </section>
    );
  }

  return (
    <section id="auth" className="arena-access-grid">
      <article className="card auth-card arena-access-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Enter Arena</p>
            <h2>Create your competitor ID</h2>
          </div>
          <span className="status-pill">New account</span>
        </div>

        <form action="/auth/signup" method="post" className="stack-form">
          <label>
            <span>Codeforces handle</span>
            <input type="text" name="handle" placeholder="tourist" required />
          </label>
          <label>
            <span>Email</span>
            <input type="email" name="email" placeholder="you@example.com" required />
          </label>
          <label>
            <span>Password</span>
            <input type="password" name="password" placeholder="At least 6 characters" required minLength={6} />
          </label>
          <button type="submit" className="button button-primary wide-button">
            Create competitor profile
          </button>
        </form>
      </article>

      <article className="card auth-card arena-access-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Return</p>
            <h2>Lock back into queue</h2>
          </div>
          <span className="status-pill status-live">Ranked</span>
        </div>

        <form action="/auth/login" method="post" className="stack-form">
          <label>
            <span>Email or handle</span>
            <input type="text" name="identity" placeholder="you@example.com or tourist" required />
          </label>
          <label>
            <span>Password</span>
            <input type="password" name="password" placeholder="Your password" required />
          </label>
          <button type="submit" className="button button-secondary wide-button">
            Log in to arena
          </button>
        </form>
      </article>
    </section>
  );
}
