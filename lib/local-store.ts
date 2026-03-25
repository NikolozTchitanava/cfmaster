import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { buildSnapshotSummary } from "@/lib/cfmasters";
import { fetchCodeforcesSnapshot } from "@/lib/codeforces";
import type { BattleRecord, Focus, FriendCard, Snapshot, StoredUser } from "@/lib/types";
import { buildProfileUrl, formatRank, handleKey, normalizeEmail, normalizeHandle, nowIso } from "@/lib/utils";

type LocalUser = {
  id: string;
  email: string;
  emailKey: string;
  passwordHash: string;
  handle: string;
  handleKey: string;
  focus: Focus;
  rank: string | null;
  rating: number | null;
  titlePhoto: string | null;
  snapshot: Snapshot;
  createdAt: string;
};

type LocalSession = {
  token: string;
  userId: string;
  expiresAt: string;
};

type LocalFriendship = {
  id: string;
  ownerUserId: string;
  friendUserId?: string | null;
  trackedHandle?: string | null;
  trackedHandleKey?: string | null;
  createdAt: string;
};

type LocalHandleCache = {
  handle: string;
  handleKey: string;
  snapshot: Snapshot;
  lastSync: string;
};

type LocalBattle = {
  id: string;
  winnerUserId?: string | null;
  loserUserId?: string | null;
  createdAt: string;
};

type LocalDb = {
  users: LocalUser[];
  sessions: LocalSession[];
  friendships: LocalFriendship[];
  handleCache: LocalHandleCache[];
  battles: LocalBattle[];
};

const LOCAL_DB_PATH = path.join(process.cwd(), ".local-dev-db.json");

function createEmptyDb(): LocalDb {
  return {
    users: [],
    sessions: [],
    friendships: [],
    handleCache: [],
    battles: []
  };
}

async function loadDb(): Promise<LocalDb> {
  try {
    const raw = await readFile(LOCAL_DB_PATH, "utf-8");
    return JSON.parse(raw) as LocalDb;
  } catch {
    return createEmptyDb();
  }
}

async function saveDb(db: LocalDb): Promise<void> {
  await mkdir(path.dirname(LOCAL_DB_PATH), { recursive: true });
  await writeFile(LOCAL_DB_PATH, `${JSON.stringify(db, null, 2)}\n`, "utf-8");
}

function toStoredUser(user: LocalUser): StoredUser {
  return {
    id: user.id,
    email: user.email,
    handle: user.handle,
    focus: user.focus,
    rank: user.rank,
    rating: user.rating,
    titlePhoto: user.titlePhoto,
    snapshot: user.snapshot,
    createdAt: user.createdAt
  };
}

function findUserById(db: LocalDb, userId: string): LocalUser | undefined {
  return db.users.find((user) => user.id === userId);
}

function findUserByHandle(db: LocalDb, handle: string): LocalUser | undefined {
  return db.users.find((user) => user.handleKey === handleKey(handle));
}

function upsertCache(db: LocalDb, snapshot: Snapshot): void {
  const key = handleKey(snapshot.profile.handle);
  const existing = db.handleCache.find((entry) => entry.handleKey === key);
  const payload: LocalHandleCache = {
    handle: snapshot.profile.handle,
    handleKey: key,
    snapshot,
    lastSync: snapshot.syncedAt ?? nowIso()
  };

  if (existing) {
    existing.handle = payload.handle;
    existing.snapshot = payload.snapshot;
    existing.lastSync = payload.lastSync;
    return;
  }

  db.handleCache.push(payload);
}

export async function getLocalUserById(userId: string): Promise<StoredUser | null> {
  const db = await loadDb();
  const user = findUserById(db, userId);
  return user ? toStoredUser(user) : null;
}

export async function getLocalUserWithPasswordByIdentity(
  identity: string
): Promise<(StoredUser & { passwordHash: string }) | null> {
  const db = await loadDb();
  const key = handleKey(identity);
  const emailKey = normalizeEmail(identity);
  const user = db.users.find((entry) => entry.handleKey === key || entry.emailKey === emailKey);
  if (!user) {
    return null;
  }

  return {
    ...toStoredUser(user),
    passwordHash: user.passwordHash
  };
}

export async function getLocalUserByHandle(handle: string): Promise<StoredUser | null> {
  const db = await loadDb();
  const user = findUserByHandle(db, handle);
  return user ? toStoredUser(user) : null;
}

export async function createLocalUserAccount(input: {
  email: string;
  handle: string;
  passwordHash: string;
}): Promise<StoredUser> {
  const db = await loadDb();
  const emailKey = normalizeEmail(input.email);
  const normalizedHandle = handleKey(input.handle);

  if (db.users.some((user) => user.emailKey === emailKey)) {
    throw new Error("That email is already registered.");
  }

  if (db.users.some((user) => user.handleKey === normalizedHandle)) {
    throw new Error("That Codeforces handle already belongs to an account.");
  }

  const snapshot = await fetchCodeforcesSnapshot(input.handle);
  const user: LocalUser = {
    id: randomUUID(),
    email: input.email,
    emailKey,
    passwordHash: input.passwordHash,
    handle: snapshot.profile.handle,
    handleKey: handleKey(snapshot.profile.handle),
    focus: "steady",
    rank: snapshot.profile.rank ?? null,
    rating: snapshot.profile.rating ?? null,
    titlePhoto: snapshot.profile.titlePhoto ?? null,
    snapshot,
    createdAt: nowIso()
  };

  db.users.push(user);
  await saveDb(db);
  return toStoredUser(user);
}

export async function updateLocalUserSnapshot(userId: string): Promise<StoredUser> {
  const db = await loadDb();
  const user = findUserById(db, userId);
  if (!user) {
    throw new Error("User not found.");
  }

  const snapshot = await fetchCodeforcesSnapshot(user.handle);
  user.handle = snapshot.profile.handle;
  user.handleKey = handleKey(snapshot.profile.handle);
  user.rank = snapshot.profile.rank ?? null;
  user.rating = snapshot.profile.rating ?? null;
  user.titlePhoto = snapshot.profile.titlePhoto ?? null;
  user.snapshot = snapshot;
  await saveDb(db);
  return toStoredUser(user);
}

export async function updateLocalUserFocus(userId: string, focus: Focus): Promise<void> {
  const db = await loadDb();
  const user = findUserById(db, userId);
  if (!user) {
    throw new Error("User not found.");
  }

  user.focus = focus;
  await saveDb(db);
}

export async function createLocalSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const db = await loadDb();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
  const session: LocalSession = {
    token: randomUUID(),
    userId,
    expiresAt: expiresAt.toISOString()
  };

  db.sessions = db.sessions.filter((entry) => entry.userId !== userId);
  db.sessions.push(session);
  await saveDb(db);
  return {
    token: session.token,
    expiresAt
  };
}

export async function deleteLocalSession(token: string): Promise<void> {
  const db = await loadDb();
  db.sessions = db.sessions.filter((session) => session.token !== token);
  await saveDb(db);
}

export async function getLocalSessionUser(token: string): Promise<StoredUser | null> {
  const db = await loadDb();
  const session = db.sessions.find((entry) => entry.token === token && new Date(entry.expiresAt).getTime() > Date.now());
  if (!session) {
    return null;
  }

  const user = findUserById(db, session.userId);
  return user ? toStoredUser(user) : null;
}

export async function upsertLocalHandleCache(snapshot: Snapshot): Promise<void> {
  const db = await loadDb();
  upsertCache(db, snapshot);
  await saveDb(db);
}

export async function getLocalTrackedSnapshot(handle: string): Promise<Snapshot | null> {
  const db = await loadDb();
  const entry = db.handleCache.find((item) => item.handleKey === handleKey(handle));
  return entry?.snapshot ?? null;
}

export async function addLocalFriendOrTrackedHandle(ownerUserId: string, identifier: string): Promise<string> {
  const db = await loadDb();
  const cleaned = identifier.trim();
  if (!cleaned) {
    throw new Error("Enter a Codeforces handle or a registered email.");
  }

  const matched = db.users.find(
    (user) => user.emailKey === normalizeEmail(cleaned) || user.handleKey === handleKey(cleaned)
  );

  if (matched) {
    if (matched.id === ownerUserId) {
      throw new Error("Your own handle already lives on your profile page.");
    }

    const exists = db.friendships.some(
      (entry) => entry.ownerUserId === ownerUserId && entry.friendUserId === matched.id
    );
    if (!exists) {
      db.friendships.push({
        id: randomUUID(),
        ownerUserId,
        friendUserId: matched.id,
        createdAt: nowIso()
      });
    }

    const reverseExists = db.friendships.some(
      (entry) => entry.ownerUserId === matched.id && entry.friendUserId === ownerUserId
    );
    if (!reverseExists) {
      db.friendships.push({
        id: randomUUID(),
        ownerUserId: matched.id,
        friendUserId: ownerUserId,
        createdAt: nowIso()
      });
    }

    db.friendships = db.friendships.filter(
      (entry) => !(entry.ownerUserId === ownerUserId && entry.trackedHandleKey === matched.handleKey)
    );

    await saveDb(db);
    return `${matched.handle} is now in your friends list.`;
  }

  if (cleaned.includes("@")) {
    throw new Error("No registered user matched that email. Use a Codeforces handle to track a non-member.");
  }

  const snapshot = await fetchCodeforcesSnapshot(cleaned);
  upsertCache(db, snapshot);

  const trackedKey = handleKey(snapshot.profile.handle);
  const existing = db.friendships.some(
    (entry) => entry.ownerUserId === ownerUserId && entry.trackedHandleKey === trackedKey
  );

  if (!existing) {
    db.friendships.push({
      id: randomUUID(),
      ownerUserId,
      trackedHandle: snapshot.profile.handle,
      trackedHandleKey: trackedKey,
      createdAt: nowIso()
    });
  }

  await saveDb(db);
  return `${snapshot.profile.handle} is now tracked in your friends view.`;
}

export async function getLocalFriendsForUser(userId: string): Promise<FriendCard[]> {
  const db = await loadDb();
  const cards: FriendCard[] = [];

  for (const friendship of db.friendships.filter((entry) => entry.ownerUserId === userId)) {
    if (friendship.friendUserId) {
      const user = findUserById(db, friendship.friendUserId);
      if (!user) {
        continue;
      }

      const { summary } = buildSnapshotSummary(user.snapshot);
      cards.push({
        handle: user.handle,
        rank: user.rank ?? "Unrated",
        ratingDisplay: summary.ratingDisplay,
        currentStreak: summary.currentStreak,
        lastMonthSolved: summary.lastMonthSolved,
        syncedAtLabel: summary.syncedAtLabel,
        detailHref: `/friends/${encodeURIComponent(user.handle)}`,
        isRegistered: true
      });
      continue;
    }

    if (friendship.trackedHandleKey) {
      const cached = db.handleCache.find((entry) => entry.handleKey === friendship.trackedHandleKey);
      if (!cached) {
        continue;
      }

      const { summary } = buildSnapshotSummary(cached.snapshot);
      cards.push({
        handle: cached.snapshot.profile.handle,
        rank: formatRank(cached.snapshot.profile.rank),
        ratingDisplay: summary.ratingDisplay,
        currentStreak: summary.currentStreak,
        lastMonthSolved: summary.lastMonthSolved,
        syncedAtLabel: summary.syncedAtLabel,
        detailHref: `/friends/${encodeURIComponent(cached.snapshot.profile.handle)}`,
        isRegistered: false
      });
    }
  }

  return cards.sort((left, right) => left.handle.localeCompare(right.handle));
}

export async function getLocalBattleRecord(userId: string): Promise<BattleRecord> {
  const db = await loadDb();
  const wins = db.battles.filter((battle) => battle.winnerUserId === userId).length;
  const losses = db.battles.filter((battle) => battle.loserUserId === userId).length;
  return {
    wins,
    losses,
    total: wins + losses
  };
}

export async function getLocalFriendSnapshotForViewer(
  viewerId: string,
  handle: string
): Promise<{
  snapshot: Snapshot;
  handle: string;
  isRegistered: boolean;
  profileUrl: string;
}> {
  const db = await loadDb();
  const registered = findUserByHandle(db, handle);
  if (registered) {
    return {
      snapshot: registered.snapshot,
      handle: registered.handle,
      isRegistered: true,
      profileUrl: buildProfileUrl(registered.handle)
    };
  }

  const tracked = db.friendships.find(
    (entry) => entry.ownerUserId === viewerId && entry.trackedHandleKey === handleKey(handle)
  );
  if (!tracked) {
    throw new Error("Track that handle first from the friends page.");
  }

  const cached = db.handleCache.find((entry) => entry.handleKey === tracked.trackedHandleKey);
  const snapshot = cached?.snapshot ?? (await fetchCodeforcesSnapshot(normalizeHandle(handle)));
  if (!cached) {
    upsertCache(db, snapshot);
    await saveDb(db);
  }

  return {
    snapshot,
    handle: snapshot.profile.handle,
    isRegistered: false,
    profileUrl: buildProfileUrl(snapshot.profile.handle)
  };
}

export async function refreshLocalFriendSnapshot(viewerId: string, handle: string): Promise<string> {
  const db = await loadDb();
  const registered = findUserByHandle(db, handle);
  if (registered) {
    const snapshot = await fetchCodeforcesSnapshot(registered.handle);
    registered.handle = snapshot.profile.handle;
    registered.handleKey = handleKey(snapshot.profile.handle);
    registered.rank = snapshot.profile.rank ?? null;
    registered.rating = snapshot.profile.rating ?? null;
    registered.titlePhoto = snapshot.profile.titlePhoto ?? null;
    registered.snapshot = snapshot;
    await saveDb(db);
    return registered.handle;
  }

  const tracked = db.friendships.find(
    (entry) => entry.ownerUserId === viewerId && entry.trackedHandleKey === handleKey(handle)
  );
  if (!tracked) {
    throw new Error("Track that handle first from the friends page.");
  }

  const snapshot = await fetchCodeforcesSnapshot(handle);
  upsertCache(db, snapshot);
  tracked.trackedHandle = snapshot.profile.handle;
  tracked.trackedHandleKey = handleKey(snapshot.profile.handle);
  await saveDb(db);
  return snapshot.profile.handle;
}
