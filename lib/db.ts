import postgres, { type Sql } from "postgres";

function cleanEnvValue(value: string | undefined): string {
  const trimmed = (value ?? "").trim();
  if (trimmed.length >= 2 && trimmed[0] === trimmed[trimmed.length - 1] && [`"`, `'`].includes(trimmed[0])) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function getEnvValue(...keys: string[]): string {
  for (const key of keys) {
    const value = cleanEnvValue(process.env[key]);
    if (value) {
      return value;
    }
  }

  return "";
}

function buildSupabaseDatabaseUrl(): string {
  const connectionTemplate = getEnvValue(
    "DATABASE_URL",
    "POSTGRES_URL",
    "SUPABASE_POOLER_CONNECTION_STRING",
    "supabase_pooler_connection_string",
    "SUPABASE_DIRECT_CONNECTION_STRING",
    "supabase_direct_connection_string",
    "SUPABASE_CONNECTION_STRING",
    "supabase_connection_string"
  );
  const supabasePassword = getEnvValue("SUPABASE_PASSWORD", "supabase_password");

  if (!connectionTemplate) {
    return "";
  }

  const resolvedConnectionString = connectionTemplate.includes("[YOUR-PASSWORD]")
    ? connectionTemplate.replace("[YOUR-PASSWORD]", encodeURIComponent(supabasePassword))
    : connectionTemplate;

  if (!resolvedConnectionString) {
    return "";
  }

  return resolvedConnectionString.includes("sslmode=")
    ? resolvedConnectionString
    : `${resolvedConnectionString}${resolvedConnectionString.includes("?") ? "&" : "?"}sslmode=require`;
}

const DATABASE_URL = buildSupabaseDatabaseUrl();

export class MissingDatabaseConfigError extends Error {
  constructor() {
    super("DATABASE_URL is not configured.");
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __cfmastersSql: Sql | undefined;
  // eslint-disable-next-line no-var
  var __cfmastersSchemaPromise: Promise<void> | undefined;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(DATABASE_URL);
}

export function shouldUseLocalStore(): boolean {
  return !DATABASE_URL && process.env.NODE_ENV !== "production" && !process.env.VERCEL;
}

export function getSql(): Sql {
  if (!DATABASE_URL) {
    throw new MissingDatabaseConfigError();
  }

  if (!global.__cfmastersSql) {
    const isSupabase = DATABASE_URL.includes(".supabase.co");
    global.__cfmastersSql = postgres(DATABASE_URL, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 20,
      prepare: false,
      ssl: isSupabase ? "require" : undefined
    });
  }

  return global.__cfmastersSql;
}

export async function ensureDatabase(): Promise<void> {
  if (!isDatabaseConfigured()) {
    throw new MissingDatabaseConfigError();
  }

  if (!global.__cfmastersSchemaPromise) {
    global.__cfmastersSchemaPromise = (async () => {
      const sql = getSql();

      await sql`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL,
          email_key TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          handle TEXT NOT NULL,
          handle_key TEXT NOT NULL UNIQUE,
          focus TEXT NOT NULL DEFAULT 'steady',
          rank TEXT,
          rating INTEGER,
          title_photo TEXT,
          profile_json JSONB NOT NULL DEFAULT '{}'::jsonb,
          solved_json JSONB NOT NULL DEFAULT '{}'::jsonb,
          rating_json JSONB NOT NULL DEFAULT '[]'::jsonb,
          last_sync TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS sessions (
          token TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS friendships (
          id TEXT PRIMARY KEY,
          owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          friend_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
          tracked_handle TEXT,
          tracked_handle_key TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CHECK (
            (friend_user_id IS NOT NULL AND tracked_handle IS NULL AND tracked_handle_key IS NULL)
            OR
            (friend_user_id IS NULL AND tracked_handle IS NOT NULL AND tracked_handle_key IS NOT NULL)
          )
        )
      `;

      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS friendships_registered_unique
        ON friendships (owner_user_id, friend_user_id)
        WHERE friend_user_id IS NOT NULL
      `;

      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS friendships_tracked_unique
        ON friendships (owner_user_id, tracked_handle_key)
        WHERE tracked_handle_key IS NOT NULL
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS handle_cache (
          handle_key TEXT PRIMARY KEY,
          handle TEXT NOT NULL,
          profile_json JSONB NOT NULL DEFAULT '{}'::jsonb,
          solved_json JSONB NOT NULL DEFAULT '{}'::jsonb,
          rating_json JSONB NOT NULL DEFAULT '[]'::jsonb,
          last_sync TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS battles (
          id TEXT PRIMARY KEY,
          winner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
          loser_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id)
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions (expires_at)
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS friendships_owner_idx ON friendships (owner_user_id)
      `;
    })();
  }

  await global.__cfmastersSchemaPromise;
}
