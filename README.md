# cfmasters

TypeScript remake of the original Codeforces tracker, built with Next.js App Router so the frontend and backend can be deployed together on Vercel.

## Stack

- Next.js with TypeScript
- React server components + route handlers
- Supabase Postgres via `DATABASE_URL` in production
- Local file-backed dev store when `DATABASE_URL` is omitted
- Codeforces public API for handle syncs and problem suggestions

## Local setup

1. Install Node.js.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Optionally set `DATABASE_URL` if you want to use Supabase Postgres locally too.
5. Run `npm run dev`.

Without `DATABASE_URL`, local auth and friend data are stored in `.local-dev-db.json`.
That local file fallback is development-only and is intentionally disabled in production/serverless environments.

Supabase connection string format:

`postgresql://postgres.awlgbywwwplxkjmhuzzd:[YOUR-PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require`

The app also accepts `SUPABASE_POOLER_CONNECTION_STRING` plus `SUPABASE_PASSWORD` and can derive `DATABASE_URL` from those env vars.

## Vercel deployment

1. Import the repo into Vercel.
2. Add your Supabase Postgres connection string as `DATABASE_URL`.
3. Deploy.

The app creates its tables automatically on first request.
