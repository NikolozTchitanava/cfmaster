# cfmasters

TypeScript remake of the original Codeforces tracker, built with Next.js App Router so the frontend and backend can be deployed together on Vercel.

## Stack

- Next.js with TypeScript
- React server components + route handlers
- Supabase Postgres via `DATABASE_URL`, `POSTGRES_URL`, or `POSTGRES_*` component envs in production
- Local file-backed dev store when no Postgres env is configured in development
- Codeforces public API for handle syncs and problem suggestions

## Local setup

1. Install Node.js.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Optionally set `DATABASE_URL`, `POSTGRES_URL`, or the `POSTGRES_*` component envs if you want to use Supabase Postgres locally too.
5. Run `npm run dev`.

Without a Postgres connection env, local auth and friend data are stored in `.local-dev-db.json`.
That local file fallback is development-only and is intentionally disabled in production/serverless environments.

Supabase connection string format:

`postgresql://postgres.awlgbywwwplxkjmhuzzd:[YOUR-PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require`

The app also accepts `SUPABASE_POOLER_CONNECTION_STRING`, `SUPABASE_DIRECT_CONNECTION_STRING`, or the Vercel-style `POSTGRES_HOST` / `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DATABASE` envs and derives the runtime connection string automatically.

## Vercel deployment

1. Import the repo into Vercel.
2. Add either `DATABASE_URL`, `POSTGRES_URL`, or the `POSTGRES_*` env vars from your Vercel Supabase integration.
3. Deploy.

The app creates its tables automatically on first request.
