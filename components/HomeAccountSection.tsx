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
      <section className="card status-strip">
        <p className="eyebrow">You’re already in</p>
        <h2>@{session.user.handle} can jump straight into profile, friends, battle, or the live leaderboard ladder.</h2>
        <div className="hero-actions">
          <Link href="/profile" className="button button-primary">
            Open your profile
          </Link>
          <Link href="/battle" className="button button-secondary">
            Enter battle lobby
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section id="auth" className="auth-grid">
      <article className="card auth-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Create account</p>
            <h2>Sign up with your handle</h2>
          </div>
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
            Create account
          </button>
        </form>
      </article>

      <article className="card auth-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Welcome back</p>
            <h2>Log in to continue</h2>
          </div>
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
            Log in
          </button>
        </form>
      </article>
    </section>
  );
}
