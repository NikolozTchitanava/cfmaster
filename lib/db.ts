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

function withSslMode(connectionString: string): string {
  if (!connectionString) {
    return "";
  }

  return connectionString.includes("sslmode=")
    ? connectionString
    : `${connectionString}${connectionString.includes("?") ? "&" : "?"}sslmode=require`;
}

function buildConnectionFromComponents(): string {
  const host = getEnvValue("POSTGRES_HOST", "SUPABASE_DB_HOST", "supabase_db_host");
  const database = getEnvValue("POSTGRES_DATABASE", "POSTGRES_DB", "SUPABASE_DB_NAME", "supabase_db_name");
  const user = getEnvValue("POSTGRES_USER", "SUPABASE_DB_USER", "supabase_db_user");
  const password = getEnvValue("POSTGRES_PASSWORD", "SUPABASE_PASSWORD", "supabase_password");
  const port = getEnvValue("POSTGRES_PORT", "SUPABASE_DB_PORT", "supabase_db_port") || "5432";

  if (!host || !database || !user || !password) {
    return "";
  }

  const encodedUser = encodeURIComponent(user);
  const encodedPassword = encodeURIComponent(password);
  return `postgresql://${encodedUser}:${encodedPassword}@${host}:${port}/${database}`;
}

function buildDatabaseUrl(): string {
  const directConnection = getEnvValue(
    "DATABASE_URL",
    "POSTGRES_URL",
    "POSTGRES_PRISMA_URL",
    "POSTGRES_URL_NON_POOLING",
    "SUPABASE_POOLER_CONNECTION_STRING",
    "supabase_pooler_connection_string",
    "SUPABASE_DIRECT_CONNECTION_STRING",
    "supabase_direct_connection_string",
    "SUPABASE_CONNECTION_STRING",
    "supabase_connection_string"
  );
  const supabasePassword = getEnvValue("POSTGRES_PASSWORD", "SUPABASE_PASSWORD", "supabase_password");

  if (directConnection) {
    const resolvedConnectionString = directConnection.includes("[YOUR-PASSWORD]")
      ? directConnection.replace("[YOUR-PASSWORD]", encodeURIComponent(supabasePassword))
      : directConnection;

    return withSslMode(resolvedConnectionString);
  }

  return withSslMode(buildConnectionFromComponents());
}

const DATABASE_URL = buildDatabaseUrl();
export const DATABASE_ENV_HELP =
  "Configure Supabase Postgres with DATABASE_URL, POSTGRES_URL, or the POSTGRES_HOST / POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DATABASE env vars.";

export class MissingDatabaseConfigError extends Error {
  constructor() {
    super(DATABASE_ENV_HELP);
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
          platform_rating INTEGER NOT NULL DEFAULT 1200,
          initial_platform_rating INTEGER NOT NULL DEFAULT 1200,
          battle_wins INTEGER NOT NULL DEFAULT 0,
          battle_losses INTEGER NOT NULL DEFAULT 0,
          battle_draws INTEGER NOT NULL DEFAULT 0,
          battles_played INTEGER NOT NULL DEFAULT 0,
          country TEXT,
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
        CREATE INDEX IF NOT EXISTS friendships_owner_idx
        ON friendships (owner_user_id)
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
          player_one_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
          player_two_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
          winner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
          loser_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
          status TEXT NOT NULL DEFAULT 'finished',
          battle_json JSONB NOT NULL DEFAULT '{}'::jsonb,
          started_at TIMESTAMPTZ,
          ends_at TIMESTAMPTZ,
          finished_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS platform_rating INTEGER
      `;

      await sql`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS initial_platform_rating INTEGER
      `;

      await sql`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS battle_wins INTEGER NOT NULL DEFAULT 0
      `;

      await sql`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS battle_losses INTEGER NOT NULL DEFAULT 0
      `;

      await sql`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS battle_draws INTEGER NOT NULL DEFAULT 0
      `;

      await sql`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS battles_played INTEGER NOT NULL DEFAULT 0
      `;

      await sql`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS country TEXT
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS sessions_user_id_idx
        ON sessions (user_id)
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS users_platform_rating_idx
        ON users (platform_rating DESC, handle_key ASC)
      `;

      await sql`
        UPDATE users
        SET initial_platform_rating = COALESCE(
              initial_platform_rating,
              CASE
                WHEN rating IS NOT NULL THEN ROUND(rating * 0.9 + 100)::int
                ELSE 1200
              END
            ),
            platform_rating = COALESCE(
              platform_rating,
              initial_platform_rating,
              CASE
                WHEN rating IS NOT NULL THEN ROUND(rating * 0.9 + 100)::int
                ELSE 1200
              END
            ),
            country = COALESCE(NULLIF(country, ''), NULLIF(TRIM(COALESCE(profile_json->>'country', '')), ''))
        WHERE initial_platform_rating IS NULL
           OR platform_rating IS NULL
           OR country IS NULL
           OR country = ''
      `;

      await sql`
        ALTER TABLE battles
        ADD COLUMN IF NOT EXISTS player_one_user_id TEXT REFERENCES users(id) ON DELETE CASCADE
      `;

      await sql`
        ALTER TABLE battles
        ADD COLUMN IF NOT EXISTS player_two_user_id TEXT REFERENCES users(id) ON DELETE CASCADE
      `;

      await sql`
        ALTER TABLE battles
        ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'finished'
      `;

      await sql`
        ALTER TABLE battles
        ADD COLUMN IF NOT EXISTS battle_json JSONB NOT NULL DEFAULT '{}'::jsonb
      `;

      await sql`
        ALTER TABLE battles
        ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ
      `;

      await sql`
        ALTER TABLE battles
        ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ
      `;

      await sql`
        ALTER TABLE battles
        ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ
      `;

      await sql`
        UPDATE battles
        SET status = COALESCE(NULLIF(status, ''), 'finished')
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

      await sql`
        CREATE INDEX IF NOT EXISTS battles_player_one_idx ON battles (player_one_user_id)
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS battles_player_two_idx ON battles (player_two_user_id)
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS battles_status_idx ON battles (status)
      `;
    })();
  }

  await global.__cfmastersSchemaPromise;
}
