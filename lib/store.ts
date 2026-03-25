import { randomUUID } from "node:crypto";

import type { BattleRecord, Focus, FriendCard, Snapshot, StoredUser } from "@/lib/types";
import { ensureDatabase, getSql, isDatabaseConfigured } from "@/lib/db";
import { fetchCodeforcesSnapshot } from "@/lib/codeforces";
import {
  addLocalFriendOrTrackedHandle,
  createLocalSession,
  createLocalUserAccount,
  deleteLocalSession,
  getLocalBattleRecord,
  getLocalFriendSnapshotForViewer,
  getLocalFriendsForUser,
  getLocalSessionUser,
  getLocalTrackedSnapshot,
  getLocalUserByHandle,
  getLocalUserById,
  getLocalUserWithPasswordByIdentity,
  refreshLocalFriendSnapshot,
  updateLocalUserFocus,
  updateLocalUserSnapshot,
  upsertLocalHandleCache
} from "@/lib/local-store";
import {
  buildProfileUrl,
  coerceJson,
  coerceNumber,
  coerceText,
  formatRank,
  handleKey,
  normalizeEmail,
  normalizeHandle,
  nowIso
} from "@/lib/utils";
import { buildSnapshotSummary } from "@/lib/cfmasters";

type UserRow = {
  id: string;
  email: string;
  handle: string;
  focus: Focus;
  rank: string | null;
  rating: number | null;
  title_photo: string | null;
  profile_json: unknown;
  solved_json: unknown;
  rating_json: unknown;
  last_sync: string | Date | null;
  created_at: string | Date;
  password_hash?: string;
};

type HandleCacheRow = {
  handle: string;
  profile_json: unknown;
  solved_json: unknown;
  rating_json: unknown;
  last_sync: string | Date;
};

function parseSnapshot(row: Pick<UserRow, "profile_json" | "solved_json" | "rating_json" | "last_sync"> | HandleCacheRow): Snapshot {
  const profile = coerceJson<Snapshot["profile"]>(row.profile_json, { handle: "" });
  const solved = coerceJson<Snapshot["solved"]>(row.solved_json, {});
  const rating = coerceJson<Snapshot["rating"]>(row.rating_json, []);

  return {
    profile,
    solved,
    rating,
    syncedAt: row.last_sync ? new Date(row.last_sync).toISOString() : null
  };
}

function parseUser(row: UserRow): StoredUser {
  return {
    id: row.id,
    email: row.email,
    handle: row.handle,
    focus: row.focus ?? "steady",
    rank: row.rank,
    rating: coerceNumber(row.rating),
    titlePhoto: row.title_photo,
    snapshot: parseSnapshot(row),
    createdAt: new Date(row.created_at).toISOString()
  };
}

export async function getUserById(userId: string): Promise<StoredUser | null> {
  if (!isDatabaseConfigured()) {
    return getLocalUserById(userId);
  }

  await ensureDatabase();
  const sql = getSql();
  const rows = await sql<UserRow[]>`
    SELECT *
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `;

  return rows[0] ? parseUser(rows[0]) : null;
}

export async function getUserWithPasswordByIdentity(identity: string): Promise<(StoredUser & { passwordHash: string }) | null> {
  if (!isDatabaseConfigured()) {
    return getLocalUserWithPasswordByIdentity(identity);
  }

  await ensureDatabase();
  const sql = getSql();
  const lookup = identity.trim();
  const rows = await sql<UserRow[]>`
    SELECT *
    FROM users
    WHERE email_key = ${normalizeEmail(lookup)}
       OR handle_key = ${handleKey(lookup)}
    LIMIT 1
  `;

  if (!rows[0] || !rows[0].password_hash) {
    return null;
  }

  return {
    ...parseUser(rows[0]),
    passwordHash: rows[0].password_hash
  };
}

export async function getUserByHandle(handle: string): Promise<StoredUser | null> {
  if (!isDatabaseConfigured()) {
    return getLocalUserByHandle(handle);
  }

  await ensureDatabase();
  const sql = getSql();
  const rows = await sql<UserRow[]>`
    SELECT *
    FROM users
    WHERE handle_key = ${handleKey(handle)}
    LIMIT 1
  `;

  return rows[0] ? parseUser(rows[0]) : null;
}

export async function createUserAccount(input: {
  email: string;
  handle: string;
  passwordHash: string;
}): Promise<StoredUser> {
  if (!isDatabaseConfigured()) {
    return createLocalUserAccount(input);
  }

  await ensureDatabase();
  const sql = getSql();

  const existingEmail = await sql<UserRow[]>`
    SELECT id
    FROM users
    WHERE email_key = ${normalizeEmail(input.email)}
    LIMIT 1
  `;
  if (existingEmail.length) {
    throw new Error("That email is already registered.");
  }

  const existingHandle = await sql<UserRow[]>`
    SELECT id
    FROM users
    WHERE handle_key = ${handleKey(input.handle)}
    LIMIT 1
  `;
  if (existingHandle.length) {
    throw new Error("That Codeforces handle already belongs to an account.");
  }

  const snapshot = await fetchCodeforcesSnapshot(input.handle);
  const id = randomUUID();

  await sql`
    INSERT INTO users (
      id,
      email,
      email_key,
      password_hash,
      handle,
      handle_key,
      focus,
      rank,
      rating,
      title_photo,
      profile_json,
      solved_json,
      rating_json,
      last_sync,
      created_at,
      updated_at
    ) VALUES (
      ${id},
      ${input.email},
      ${normalizeEmail(input.email)},
      ${input.passwordHash},
      ${snapshot.profile.handle},
      ${handleKey(snapshot.profile.handle)},
      ${"steady"},
      ${snapshot.profile.rank ?? null},
      ${snapshot.profile.rating ?? null},
      ${snapshot.profile.titlePhoto ?? null},
      ${JSON.stringify(snapshot.profile)}::jsonb,
      ${JSON.stringify(snapshot.solved)}::jsonb,
      ${JSON.stringify(snapshot.rating)}::jsonb,
      ${snapshot.syncedAt ?? null},
      ${nowIso()},
      ${nowIso()}
    )
  `;

  const created = await getUserById(id);
  if (!created) {
    throw new Error("Could not create the account.");
  }

  return created;
}

export async function updateUserSnapshot(userId: string): Promise<StoredUser> {
  if (!isDatabaseConfigured()) {
    return updateLocalUserSnapshot(userId);
  }

  const user = await getUserById(userId);
  if (!user) {
    throw new Error("User not found.");
  }

  const snapshot = await fetchCodeforcesSnapshot(user.handle);
  const sql = getSql();

  await sql`
    UPDATE users
    SET handle = ${snapshot.profile.handle},
        handle_key = ${handleKey(snapshot.profile.handle)},
        rank = ${snapshot.profile.rank ?? null},
        rating = ${snapshot.profile.rating ?? null},
        title_photo = ${snapshot.profile.titlePhoto ?? null},
        profile_json = ${JSON.stringify(snapshot.profile)}::jsonb,
        solved_json = ${JSON.stringify(snapshot.solved)}::jsonb,
        rating_json = ${JSON.stringify(snapshot.rating)}::jsonb,
        last_sync = ${snapshot.syncedAt ?? null},
        updated_at = ${nowIso()}
    WHERE id = ${userId}
  `;

  const updated = await getUserById(userId);
  if (!updated) {
    throw new Error("Could not refresh the profile.");
  }

  return updated;
}

export async function updateUserFocus(userId: string, focus: Focus): Promise<void> {
  if (!isDatabaseConfigured()) {
    return updateLocalUserFocus(userId, focus);
  }

  await ensureDatabase();
  const sql = getSql();
  await sql`
    UPDATE users
    SET focus = ${focus},
        updated_at = ${nowIso()}
    WHERE id = ${userId}
  `;
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  if (!isDatabaseConfigured()) {
    return createLocalSession(userId);
  }

  await ensureDatabase();
  const sql = getSql();
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

  await sql`
    INSERT INTO sessions (token, user_id, expires_at)
    VALUES (${token}, ${userId}, ${expiresAt.toISOString()})
  `;

  return { token, expiresAt };
}

export async function deleteSession(token: string): Promise<void> {
  if (!isDatabaseConfigured()) {
    return deleteLocalSession(token);
  }

  await ensureDatabase();
  const sql = getSql();
  await sql`
    DELETE FROM sessions
    WHERE token = ${token}
  `;
}

export async function getSessionUser(token: string): Promise<StoredUser | null> {
  if (!isDatabaseConfigured()) {
    return getLocalSessionUser(token);
  }

  await ensureDatabase();
  const sql = getSql();
  const rows = await sql<UserRow[]>`
    SELECT users.*
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token = ${token}
      AND sessions.expires_at > NOW()
    LIMIT 1
  `;

  return rows[0] ? parseUser(rows[0]) : null;
}

export async function upsertHandleCache(snapshot: Snapshot): Promise<void> {
  if (!isDatabaseConfigured()) {
    return upsertLocalHandleCache(snapshot);
  }

  await ensureDatabase();
  const sql = getSql();

  await sql`
    INSERT INTO handle_cache (handle_key, handle, profile_json, solved_json, rating_json, last_sync)
    VALUES (
      ${handleKey(snapshot.profile.handle)},
      ${snapshot.profile.handle},
      ${JSON.stringify(snapshot.profile)}::jsonb,
      ${JSON.stringify(snapshot.solved)}::jsonb,
      ${JSON.stringify(snapshot.rating)}::jsonb,
      ${snapshot.syncedAt ?? nowIso()}
    )
    ON CONFLICT (handle_key) DO UPDATE SET
      handle = EXCLUDED.handle,
      profile_json = EXCLUDED.profile_json,
      solved_json = EXCLUDED.solved_json,
      rating_json = EXCLUDED.rating_json,
      last_sync = EXCLUDED.last_sync
  `;
}

export async function getTrackedSnapshot(handle: string): Promise<Snapshot | null> {
  if (!isDatabaseConfigured()) {
    return getLocalTrackedSnapshot(handle);
  }

  await ensureDatabase();
  const sql = getSql();
  const rows = await sql<HandleCacheRow[]>`
    SELECT *
    FROM handle_cache
    WHERE handle_key = ${handleKey(handle)}
    LIMIT 1
  `;

  return rows[0] ? parseSnapshot(rows[0]) : null;
}

export async function addFriendOrTrackedHandle(ownerUserId: string, identifier: string): Promise<string> {
  if (!isDatabaseConfigured()) {
    return addLocalFriendOrTrackedHandle(ownerUserId, identifier);
  }

  await ensureDatabase();
  const sql = getSql();
  const cleaned = identifier.trim();
  if (!cleaned) {
    throw new Error("Enter a Codeforces handle or a registered email.");
  }

  const matchedUsers = await sql<UserRow[]>`
    SELECT *
    FROM users
    WHERE email_key = ${normalizeEmail(cleaned)}
       OR handle_key = ${handleKey(cleaned)}
    LIMIT 1
  `;

  if (matchedUsers[0]) {
    const friend = parseUser(matchedUsers[0]);
    if (friend.id === ownerUserId) {
      throw new Error("Your own handle already lives on your profile page.");
    }

    await sql`
      INSERT INTO friendships (id, owner_user_id, friend_user_id)
      VALUES (${randomUUID()}, ${ownerUserId}, ${friend.id})
      ON CONFLICT DO NOTHING
    `;
    await sql`
      INSERT INTO friendships (id, owner_user_id, friend_user_id)
      VALUES (${randomUUID()}, ${friend.id}, ${ownerUserId})
      ON CONFLICT DO NOTHING
    `;
    await sql`
      DELETE FROM friendships
      WHERE owner_user_id = ${ownerUserId}
        AND tracked_handle_key = ${handleKey(friend.handle)}
    `;

    return `${friend.handle} is now in your friends list.`;
  }

  if (cleaned.includes("@")) {
    throw new Error("No registered user matched that email. Use a Codeforces handle to track a non-member.");
  }

  const snapshot = await fetchCodeforcesSnapshot(cleaned);
  await upsertHandleCache(snapshot);
  await sql`
    INSERT INTO friendships (id, owner_user_id, tracked_handle, tracked_handle_key)
    VALUES (
      ${randomUUID()},
      ${ownerUserId},
      ${snapshot.profile.handle},
      ${handleKey(snapshot.profile.handle)}
    )
    ON CONFLICT DO NOTHING
  `;

  return `${snapshot.profile.handle} is now tracked in your friends view.`;
}

export async function getFriendsForUser(userId: string): Promise<FriendCard[]> {
  if (!isDatabaseConfigured()) {
    return getLocalFriendsForUser(userId);
  }

  await ensureDatabase();
  const sql = getSql();

  const registered = await sql<Array<UserRow & { friendship_id: string }>>`
    SELECT users.*, friendships.id AS friendship_id
    FROM friendships
    JOIN users ON users.id = friendships.friend_user_id
    WHERE friendships.owner_user_id = ${userId}
      AND friendships.friend_user_id IS NOT NULL
    ORDER BY users.handle_key
  `;

  const tracked = await sql<Array<HandleCacheRow & { tracked_handle: string; tracked_handle_key: string }>>`
    SELECT
      friendships.tracked_handle,
      friendships.tracked_handle_key,
      handle_cache.handle,
      handle_cache.profile_json,
      handle_cache.solved_json,
      handle_cache.rating_json,
      handle_cache.last_sync
    FROM friendships
    JOIN handle_cache ON handle_cache.handle_key = friendships.tracked_handle_key
    WHERE friendships.owner_user_id = ${userId}
      AND friendships.tracked_handle_key IS NOT NULL
    ORDER BY friendships.tracked_handle_key
  `;

  const cards: FriendCard[] = registered.map((row) => {
    const user = parseUser(row);
    const { summary } = buildSnapshotSummary(user.snapshot);
    return {
      handle: user.handle,
      rank: user.rank ?? "Unrated",
      ratingDisplay: summary.ratingDisplay,
      currentStreak: summary.currentStreak,
      lastMonthSolved: summary.lastMonthSolved,
      syncedAtLabel: summary.syncedAtLabel,
      detailHref: `/friends/${encodeURIComponent(user.handle)}`,
      isRegistered: true
    };
  });

  for (const row of tracked) {
    const snapshot = parseSnapshot(row);
    const { summary } = buildSnapshotSummary(snapshot);
    cards.push({
      handle: coerceText(snapshot.profile.handle) || coerceText(row.tracked_handle),
      rank: formatRank(coerceText(snapshot.profile.rank)),
      ratingDisplay: summary.ratingDisplay,
      currentStreak: summary.currentStreak,
      lastMonthSolved: summary.lastMonthSolved,
      syncedAtLabel: summary.syncedAtLabel,
      detailHref: `/friends/${encodeURIComponent(coerceText(snapshot.profile.handle) || coerceText(row.tracked_handle))}`,
      isRegistered: false
    });
  }

  return cards.sort((left, right) => left.handle.localeCompare(right.handle));
}

export async function getBattleRecord(userId: string): Promise<BattleRecord> {
  if (!isDatabaseConfigured()) {
    return getLocalBattleRecord(userId);
  }

  await ensureDatabase();
  const sql = getSql();
  const rows = await sql<Array<{ wins: number; losses: number }>>`
    SELECT
      COUNT(*) FILTER (WHERE winner_user_id = ${userId})::int AS wins,
      COUNT(*) FILTER (WHERE loser_user_id = ${userId})::int AS losses
    FROM battles
    WHERE winner_user_id = ${userId}
       OR loser_user_id = ${userId}
  `;

  const wins = rows[0]?.wins ?? 0;
  const losses = rows[0]?.losses ?? 0;
  return {
    wins,
    losses,
    total: wins + losses
  };
}

export async function getFriendSnapshotForViewer(viewerId: string, handle: string): Promise<{
  snapshot: Snapshot;
  handle: string;
  isRegistered: boolean;
  profileUrl: string;
}> {
  if (!isDatabaseConfigured()) {
    return getLocalFriendSnapshotForViewer(viewerId, handle);
  }

  const registered = await getUserByHandle(handle);
  if (registered) {
    return {
      snapshot: registered.snapshot,
      handle: registered.handle,
      isRegistered: true,
      profileUrl: buildProfileUrl(registered.handle)
    };
  }

  await ensureDatabase();
  const sql = getSql();
  const follows = await sql<Array<{ tracked_handle_key: string }>>`
    SELECT tracked_handle_key
    FROM friendships
    WHERE owner_user_id = ${viewerId}
      AND tracked_handle_key = ${handleKey(handle)}
    LIMIT 1
  `;

  if (!follows[0]) {
    throw new Error("Track that handle first from the friends page.");
  }

  const cached = await getTrackedSnapshot(handle);
  const snapshot = cached ?? (await fetchCodeforcesSnapshot(normalizeHandle(handle)));
  await upsertHandleCache(snapshot);

  return {
    snapshot,
    handle: snapshot.profile.handle,
    isRegistered: false,
    profileUrl: buildProfileUrl(snapshot.profile.handle)
  };
}

export async function refreshFriendSnapshot(viewerId: string, handle: string): Promise<string> {
  if (!isDatabaseConfigured()) {
    return refreshLocalFriendSnapshot(viewerId, handle);
  }

  const registered = await getUserByHandle(handle);
  if (registered) {
    const refreshedUser = await updateUserSnapshot(registered.id);
    return refreshedUser.handle;
  }

  const friendView = await getFriendSnapshotForViewer(viewerId, handle);
  const refreshed = await fetchCodeforcesSnapshot(friendView.handle);
  await upsertHandleCache(refreshed);
  return refreshed.profile.handle;
}
