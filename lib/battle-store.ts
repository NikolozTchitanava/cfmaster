import { randomUUID } from "node:crypto";

import {
  ADDITIVE_CHIP_LABELS,
  calculateBattleRoomState,
  calculateRatingChanges,
  describeCrucialChip,
  getBattleTagOptions,
  getCountrySummary,
  getInitialPlatformRating,
  getRankTier,
  getTriggeredAdditiveReveal,
  selectBattleProblems,
  shouldFinishBattle
} from "@/lib/battle";
import { fetchProblemCatalog } from "@/lib/codeforces";
import { ensureDatabase, getSql, shouldUseLocalStore } from "@/lib/db";
import { resolveCountryMetadata } from "@/lib/geo";
import { getUserById } from "@/lib/store";
import type {
  AdditiveChipSelection,
  BattleChipLoadout,
  BattleDifficulty,
  BattleParticipantState,
  BattleRoom,
  BattleSummaryCard,
  CrucialChipSelection,
  RankTier,
  StoredUser
} from "@/lib/types";
import { coerceJson, coerceText, handleKey, normalizeEmail, nowIso } from "@/lib/utils";

type BattleRow = {
  id: string;
  player_one_user_id: string | null;
  player_two_user_id: string | null;
  winner_user_id: string | null;
  loser_user_id: string | null;
  status: BattleRoom["status"];
  battle_json: unknown;
  started_at: string | Date | null;
  ends_at: string | Date | null;
  finished_at: string | Date | null;
  created_at: string | Date;
};

type PersistedBattleParticipant = Omit<BattleParticipantState, "crucialChip" | "additiveChip"> & {
  crucialChip: CrucialChipSelection | null;
  additiveChip: AdditiveChipSelection | null;
};

type PersistedBattlePayload = {
  participants: [PersistedBattleParticipant, PersistedBattleParticipant];
  problems: BattleRoom["problems"];
  progress: BattleRoom["progress"];
};

type PendingBattleCard = {
  id: string;
  opponentHandle: string;
  opponentRating: number;
  opponentTier: RankTier;
  createdAtLabel: string;
  visibleCrucialChips: string[];
};

export type BattleDashboardData = {
  activeBattle: BattleRoom | null;
  pendingIncoming: PendingBattleCard[];
  pendingOutgoing: PendingBattleCard[];
  recentBattles: BattleSummaryCard[];
  tagOptions: string[];
  suggestedOpponents: Array<{
    handle: string;
    platformRating: number;
    rankTier: RankTier;
    countrySummary: string;
  }>;
};

function ensureBattleDatabase() {
  if (shouldUseLocalStore()) {
    throw new Error("Battle mode needs DATABASE_URL so both players can share the same live state.");
  }
}

function buildParticipantSeed(user: StoredUser, loadout: BattleChipLoadout | null): PersistedBattleParticipant {
  return {
    userId: user.id,
    handle: user.handle,
    platformRating: user.platformRating || getInitialPlatformRating(user.rating),
    initialPlatformRating: user.initialPlatformRating || getInitialPlatformRating(user.rating),
    battlesPlayed: user.battlesPlayed,
    country: user.country,
    continent: user.continent,
    crucialChip: loadout?.crucial ?? null,
    additiveChip: loadout?.additive ?? null,
    additiveRevealed: false,
    additiveRevealReason: null,
    scoreBonusMultiplier: 1,
    ratingDelta: null,
    ratingAfter: null
  };
}

function emptyProgress(problems: BattleRoom["problems"]): BattleRoom["progress"] {
  return problems.map((problem) => ({
    problemKey: problem.problemKey,
    playerOneWrongAttempts: 0,
    playerTwoWrongAttempts: 0,
    playerOneAcceptedAt: null,
    playerTwoAcceptedAt: null,
    playerOneAcceptedMinute: null,
    playerTwoAcceptedMinute: null
  }));
}

function parseBattlePayload(row: BattleRow): PersistedBattlePayload {
  return coerceJson<PersistedBattlePayload>(row.battle_json, {
    participants: [
      {
        userId: row.player_one_user_id ?? "",
        handle: "",
        platformRating: 1200,
        initialPlatformRating: 1200,
        battlesPlayed: 0,
        country: null,
        continent: null,
        crucialChip: null,
        additiveChip: null,
        additiveRevealed: false,
        additiveRevealReason: null,
        scoreBonusMultiplier: 1,
        ratingDelta: null,
        ratingAfter: null
      },
      {
        userId: row.player_two_user_id ?? "",
        handle: "",
        platformRating: 1200,
        initialPlatformRating: 1200,
        battlesPlayed: 0,
        country: null,
        continent: null,
        crucialChip: null,
        additiveChip: null,
        additiveRevealed: false,
        additiveRevealReason: null,
        scoreBonusMultiplier: 1,
        ratingDelta: null,
        ratingAfter: null
      }
    ],
    problems: [],
    progress: []
  });
}

function buildBattleRoom(row: BattleRow): BattleRoom {
  const payload = parseBattlePayload(row);
  const [playerOne, playerTwo] = payload.participants;
  if (!playerOne.crucialChip || !playerOne.additiveChip || !playerTwo.crucialChip || !playerTwo.additiveChip) {
    throw new Error("Battle payload is incomplete.");
  }

  const roomBase = {
    id: row.id,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    startedAt: row.started_at ? new Date(row.started_at).toISOString() : null,
    endsAt: row.ends_at ? new Date(row.ends_at).toISOString() : null,
    finishedAt: row.finished_at ? new Date(row.finished_at).toISOString() : null,
    problems: payload.problems,
    participants: [
      {
        ...playerOne,
        crucialChip: playerOne.crucialChip,
        additiveChip: playerOne.additiveChip
      },
      {
        ...playerTwo,
        crucialChip: playerTwo.crucialChip,
        additiveChip: playerTwo.additiveChip
      }
    ] as [BattleParticipantState, BattleParticipantState],
    progress: payload.progress,
    ratingDeltasApplied: row.status === "finished"
  } satisfies Omit<BattleRoom, "scores" | "winnerUserId" | "loserUserId" | "resultLabel" | "resultReason">;

  return {
    ...roomBase,
    ...calculateBattleRoomState(roomBase)
  };
}

function battleSummaryForUser(userId: string, room: BattleRoom): BattleSummaryCard {
  const me = room.participants.find((participant) => participant.userId === userId);
  const opponent = room.participants.find((participant) => participant.userId !== userId);
  const myScore = me ? room.scores[me.userId] : null;
  const opponentScore = opponent ? room.scores[opponent.userId] : null;

  return {
    id: room.id,
    opponentHandle: opponent?.handle ?? "Unknown",
    status: room.status,
    startedAt: room.startedAt,
    endsAt: room.endsAt,
    scoreline:
      myScore && opponentScore
        ? `${Math.round(myScore.totalScore)} - ${Math.round(opponentScore.totalScore)}`
        : room.status === "pending"
          ? "Awaiting lock-in"
          : "No score yet",
    href: `/battle?battle=${encodeURIComponent(room.id)}`
  };
}

async function queryBattleRowsForUser(userId: string, statuses?: BattleRoom["status"][]): Promise<BattleRow[]> {
  ensureBattleDatabase();
  await ensureDatabase();
  const sql = getSql();

  if (statuses?.length) {
    return sql<BattleRow[]>`
      SELECT *
      FROM battles
      WHERE (player_one_user_id = ${userId} OR player_two_user_id = ${userId})
        AND status = ANY(${statuses})
      ORDER BY created_at DESC
    `;
  }

  return sql<BattleRow[]>`
    SELECT *
    FROM battles
    WHERE player_one_user_id = ${userId} OR player_two_user_id = ${userId}
    ORDER BY created_at DESC
  `;
}

async function finalizeBattleIfNeeded(battleId: string): Promise<BattleRoom> {
  ensureBattleDatabase();
  await ensureDatabase();
  const sql = getSql();

  const existingRows = await sql<BattleRow[]>`
    SELECT *
    FROM battles
    WHERE id = ${battleId}
    LIMIT 1
  `;
  const existing = existingRows[0];
  if (!existing) {
    throw new Error("Battle not found.");
  }

  let room = buildBattleRoom(existing);
  if (!shouldFinishBattle(room)) {
    return room;
  }

  if (room.status === "finished") {
    return room;
  }

  const ratingDeltas = calculateRatingChanges(room);
  const [playerOne, playerTwo] = room.participants;
  const playerOneScore = room.scores[playerOne.userId];
  const playerTwoScore = room.scores[playerTwo.userId];
  const playerOneReveal = getTriggeredAdditiveReveal(playerOne, playerOneScore, playerTwoScore);
  const playerTwoReveal = getTriggeredAdditiveReveal(playerTwo, playerTwoScore, playerOneScore);

  const updatedPayload: PersistedBattlePayload = {
    participants: [
      {
        ...playerOne,
        additiveRevealed: true,
        additiveRevealReason: playerOneReveal.reason,
        scoreBonusMultiplier: playerOneScore.bonusMultiplier,
        ratingDelta: ratingDeltas[playerOne.userId],
        ratingAfter: playerOne.platformRating + ratingDeltas[playerOne.userId]
      },
      {
        ...playerTwo,
        additiveRevealed: true,
        additiveRevealReason: playerTwoReveal.reason,
        scoreBonusMultiplier: playerTwoScore.bonusMultiplier,
        ratingDelta: ratingDeltas[playerTwo.userId],
        ratingAfter: playerTwo.platformRating + ratingDeltas[playerTwo.userId]
      }
    ],
    problems: room.problems,
    progress: room.progress
  };

  await sql`
    UPDATE users
    SET platform_rating = CASE
          WHEN id = ${playerOne.userId} THEN ${playerOne.platformRating + ratingDeltas[playerOne.userId]}
          WHEN id = ${playerTwo.userId} THEN ${playerTwo.platformRating + ratingDeltas[playerTwo.userId]}
          ELSE platform_rating
        END,
        battles_played = CASE
          WHEN id IN (${playerOne.userId}, ${playerTwo.userId}) THEN battles_played + 1
          ELSE battles_played
        END,
        battle_wins = CASE
          WHEN id = ${room.winnerUserId} THEN battle_wins + 1
          ELSE battle_wins
        END,
        battle_losses = CASE
          WHEN id = ${room.loserUserId} THEN battle_losses + 1
          ELSE battle_losses
        END,
        battle_draws = CASE
          WHEN ${room.winnerUserId} IS NULL AND id IN (${playerOne.userId}, ${playerTwo.userId}) THEN battle_draws + 1
          ELSE battle_draws
        END
    WHERE id IN (${playerOne.userId}, ${playerTwo.userId})
  `;

  await sql`
    UPDATE battles
    SET status = 'finished',
        winner_user_id = ${room.winnerUserId},
        loser_user_id = ${room.loserUserId},
        finished_at = ${nowIso()},
        battle_json = ${JSON.stringify(updatedPayload)}::jsonb
    WHERE id = ${battleId}
      AND status = 'active'
  `;

  const refreshedRows = await sql<BattleRow[]>`
    SELECT *
    FROM battles
    WHERE id = ${battleId}
    LIMIT 1
  `;
  room = buildBattleRoom(refreshedRows[0]);
  return room;
}

async function finalizeUserBattles(userId: string): Promise<void> {
  const rows = await queryBattleRowsForUser(userId, ["active"]);
  for (const row of rows) {
    const room = buildBattleRoom(row);
    if (shouldFinishBattle(room)) {
      await finalizeBattleIfNeeded(row.id);
    }
  }
}

async function getUserByIdentityForBattle(identity: string): Promise<StoredUser | null> {
  ensureBattleDatabase();
  await ensureDatabase();
  const sql = getSql();
  const rows = await sql<Array<{ id: string }>>`
    SELECT id
    FROM users
    WHERE email_key = ${normalizeEmail(identity)}
       OR handle_key = ${handleKey(identity)}
    LIMIT 1
  `;

  if (!rows[0]) {
    return null;
  }

  return getUserById(rows[0].id);
}

function normalizeChipLoadout(input: {
  crucialType: string;
  guaranteeTag?: string | null;
  banTag?: string | null;
  doubleBanOne?: string | null;
  doubleBanTwo?: string | null;
  additiveType: string;
}): BattleChipLoadout {
  const crucialType = input.crucialType as CrucialChipSelection["type"];
  const additiveType = input.additiveType as AdditiveChipSelection["type"];

  const crucial: CrucialChipSelection =
    crucialType === "guarantee_tag"
      ? { type: crucialType, tag: coerceText(input.guaranteeTag).trim() }
      : crucialType === "ban_tag"
        ? { type: crucialType, tag: coerceText(input.banTag).trim() }
        : crucialType === "double_ban"
          ? {
              type: crucialType,
              tags: [coerceText(input.doubleBanOne).trim(), coerceText(input.doubleBanTwo).trim()].filter(Boolean)
            }
          : { type: crucialType };

  if (crucial.type === "guarantee_tag" && !crucial.tag) {
    throw new Error("Guarantee Tag needs a tag choice.");
  }
  if (crucial.type === "ban_tag" && !crucial.tag) {
    throw new Error("Ban Tag needs a tag choice.");
  }
  if (crucial.type === "double_ban" && (crucial.tags?.length ?? 0) < 2) {
    throw new Error("Double Ban needs two tags.");
  }

  return {
    crucial,
    additive: { type: additiveType }
  };
}

export async function createBattleChallenge(input: {
  challengerUserId: string;
  opponentIdentity: string;
  loadout: BattleChipLoadout;
}): Promise<void> {
  ensureBattleDatabase();
  const challenger = await getUserById(input.challengerUserId);
  if (!challenger) {
    throw new Error("Your account could not be loaded.");
  }

  const opponent = await getUserByIdentityForBattle(input.opponentIdentity.trim());
  if (!opponent) {
    throw new Error("That opponent must be a registered cfmasters user.");
  }

  if (opponent.id === challenger.id) {
    throw new Error("You cannot challenge yourself.");
  }

  await finalizeUserBattles(challenger.id);
  await finalizeUserBattles(opponent.id);

  const [challengerBattles, opponentBattles] = await Promise.all([
    queryBattleRowsForUser(challenger.id, ["pending", "active"]),
    queryBattleRowsForUser(opponent.id, ["pending", "active"])
  ]);
  if (
    challengerBattles.length ||
    opponentBattles.length ||
    challengerBattles.some((row) => row.player_one_user_id === opponent.id || row.player_two_user_id === opponent.id)
  ) {
    throw new Error("A battle with that player is already pending or live.");
  }

  const sql = getSql();
  const payload: PersistedBattlePayload = {
    participants: [buildParticipantSeed(challenger, input.loadout), buildParticipantSeed(opponent, null)],
    problems: [],
    progress: []
  };

  await sql`
    INSERT INTO battles (
      id,
      player_one_user_id,
      player_two_user_id,
      status,
      battle_json,
      created_at
    ) VALUES (
      ${randomUUID()},
      ${challenger.id},
      ${opponent.id},
      ${"pending"},
      ${JSON.stringify(payload)}::jsonb,
      ${nowIso()}
    )
  `;
}

export async function respondToBattleChallenge(input: {
  battleId: string;
  userId: string;
  accept: boolean;
  loadout?: BattleChipLoadout;
}): Promise<void> {
  ensureBattleDatabase();
  const sql = getSql();
  const rows = await sql<BattleRow[]>`
    SELECT *
    FROM battles
    WHERE id = ${input.battleId}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row || row.status !== "pending") {
    throw new Error("That battle request is no longer pending.");
  }
  if (row.player_two_user_id !== input.userId) {
    throw new Error("Only the challenged player can respond to this battle.");
  }

  if (!input.accept) {
    await sql`
      UPDATE battles
      SET status = 'declined'
      WHERE id = ${input.battleId}
    `;
    return;
  }

  if (!input.loadout) {
    throw new Error("Choose your chips before accepting.");
  }

  const payload = parseBattlePayload(row);
  const challenger = await getUserById(row.player_one_user_id ?? "");
  const opponent = await getUserById(row.player_two_user_id ?? "");
  if (!challenger || !opponent || !payload.participants[0].crucialChip || !payload.participants[0].additiveChip) {
    throw new Error("The battle participants could not be prepared.");
  }

  const catalog = await fetchProblemCatalog();
  const problems = selectBattleProblems({
    playerOneRating: challenger.platformRating,
    playerTwoRating: opponent.platformRating,
    playerOneSnapshot: challenger.snapshot,
    playerTwoSnapshot: opponent.snapshot,
    playerOneChip: payload.participants[0].crucialChip,
    playerTwoChip: input.loadout.crucial,
    catalog,
    seed: row.id
  });
  const now = new Date();
  const updatedPayload: PersistedBattlePayload = {
    participants: [buildParticipantSeed(challenger, { crucial: payload.participants[0].crucialChip, additive: payload.participants[0].additiveChip }), buildParticipantSeed(opponent, input.loadout)],
    problems,
    progress: emptyProgress(problems)
  };

  await sql`
    UPDATE battles
    SET status = 'active',
        battle_json = ${JSON.stringify(updatedPayload)}::jsonb,
        started_at = ${now.toISOString()},
        ends_at = ${new Date(now.getTime() + 60 * 60 * 1000).toISOString()}
    WHERE id = ${input.battleId}
      AND status = 'pending'
  `;
}

export async function addBattleWrongAttempt(input: {
  battleId: string;
  userId: string;
  problemKey: string;
}): Promise<void> {
  ensureBattleDatabase();
  const sql = getSql();
  const rows = await sql<BattleRow[]>`
    SELECT *
    FROM battles
    WHERE id = ${input.battleId}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) {
    throw new Error("Battle not found.");
  }

  const room = await finalizeBattleIfNeeded(row.id);
  if (room.status !== "active") {
    throw new Error("That battle is already over.");
  }

  const payload = parseBattlePayload(row);
  const problem = payload.progress.find((entry) => entry.problemKey === input.problemKey);
  if (!problem) {
    throw new Error("Problem not found in this battle.");
  }

  if (room.participants[0].userId === input.userId) {
    if (problem.playerOneAcceptedAt) {
      throw new Error("That problem is already accepted on your side.");
    }
    problem.playerOneWrongAttempts += 1;
  } else if (room.participants[1].userId === input.userId) {
    if (problem.playerTwoAcceptedAt) {
      throw new Error("That problem is already accepted on your side.");
    }
    problem.playerTwoWrongAttempts += 1;
  } else {
    throw new Error("You are not part of this battle.");
  }

  await sql`
    UPDATE battles
    SET battle_json = ${JSON.stringify(payload)}::jsonb
    WHERE id = ${input.battleId}
  `;
}

export async function markBattleAccepted(input: {
  battleId: string;
  userId: string;
  problemKey: string;
}): Promise<void> {
  ensureBattleDatabase();
  const sql = getSql();
  const rows = await sql<BattleRow[]>`
    SELECT *
    FROM battles
    WHERE id = ${input.battleId}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) {
    throw new Error("Battle not found.");
  }

  const room = await finalizeBattleIfNeeded(row.id);
  if (room.status !== "active") {
    throw new Error("That battle is already over.");
  }

  const payload = parseBattlePayload(row);
  const problem = payload.progress.find((entry) => entry.problemKey === input.problemKey);
  if (!problem) {
    throw new Error("Problem not found in this battle.");
  }

  const now = new Date();
  const acceptedAt = now.toISOString();
  const acceptedMinute = room.startedAt ? Math.max(0, Math.floor((now.getTime() - new Date(room.startedAt).getTime()) / 60000)) : 0;

  if (room.participants[0].userId === input.userId) {
    if (problem.playerOneAcceptedAt) {
      throw new Error("That problem is already accepted on your side.");
    }
    problem.playerOneAcceptedAt = acceptedAt;
    problem.playerOneAcceptedMinute = acceptedMinute;
  } else if (room.participants[1].userId === input.userId) {
    if (problem.playerTwoAcceptedAt) {
      throw new Error("That problem is already accepted on your side.");
    }
    problem.playerTwoAcceptedAt = acceptedAt;
    problem.playerTwoAcceptedMinute = acceptedMinute;
  } else {
    throw new Error("You are not part of this battle.");
  }

  await sql`
    UPDATE battles
    SET battle_json = ${JSON.stringify(payload)}::jsonb
    WHERE id = ${input.battleId}
  `;

  await finalizeBattleIfNeeded(input.battleId);
}

export async function getBattleDashboard(userId: string): Promise<BattleDashboardData> {
  ensureBattleDatabase();
  await finalizeUserBattles(userId);
  const [rows, catalog, opponents] = await Promise.all([
    queryBattleRowsForUser(userId),
    fetchProblemCatalog(),
    getSuggestedOpponents(userId)
  ]);

  const rooms = rows
    .filter((row) => row.status === "active" || row.status === "finished")
    .map((row) => buildBattleRoom(row));
  const activeBattle = rooms.find((room) => room.status === "active") ?? null;

  const pendingRows = rows.filter((row) => row.status === "pending");
  const pendingIncoming = pendingRows
    .filter((row) => row.player_two_user_id === userId)
    .map((row) => pendingCardFromRow(userId, row));
  const pendingOutgoing = pendingRows
    .filter((row) => row.player_one_user_id === userId)
    .map((row) => pendingCardFromRow(userId, row));

  return {
    activeBattle,
    pendingIncoming,
    pendingOutgoing,
    recentBattles: rooms
      .filter((room) => room.status === "finished")
      .slice(0, 6)
      .map((room) => battleSummaryForUser(userId, room)),
    tagOptions: getBattleTagOptions(catalog),
    suggestedOpponents: opponents
  };
}

function pendingCardFromRow(userId: string, row: BattleRow): PendingBattleCard {
  const payload = parseBattlePayload(row);
  const opponent = payload.participants.find((participant) => participant.userId !== userId) ?? payload.participants[0];
  const chips = payload.participants
    .map((participant) => participant.crucialChip)
    .filter(Boolean)
    .map((chip) => describeCrucialChip(chip as CrucialChipSelection));

  return {
    id: row.id,
    opponentHandle: opponent.handle,
    opponentRating: opponent.platformRating,
    opponentTier: getRankTier(opponent.platformRating),
    createdAtLabel: new Date(row.created_at).toLocaleString(),
    visibleCrucialChips: chips
  };
}

async function getSuggestedOpponents(userId: string): Promise<BattleDashboardData["suggestedOpponents"]> {
  ensureBattleDatabase();
  await ensureDatabase();
  const sql = getSql();
  const rows = await sql<Array<{ handle: string; platform_rating: number; country: string | null }>>`
    SELECT handle, platform_rating, country
    FROM users
    WHERE id <> ${userId}
    ORDER BY platform_rating DESC, handle_key
    LIMIT 12
  `;

  return rows.map((row) => {
    const resolvedCountry = resolveCountryMetadata(row.country);
    const rating = row.platform_rating ?? 1200;
    return {
      handle: row.handle,
      platformRating: rating,
      rankTier: getRankTier(rating),
      countrySummary: getCountrySummary(resolvedCountry.country, resolvedCountry.continent)
    };
  });
}

export async function getSelectedBattleForUser(userId: string, battleId?: string | null): Promise<BattleRoom | null> {
  ensureBattleDatabase();
  await finalizeUserBattles(userId);
  const rows = battleId
    ? await queryBattleRowsForUser(userId)
    : await queryBattleRowsForUser(userId, ["active"]);

  if (battleId) {
    const row = rows.find((entry) => entry.id === battleId);
    if (!row) {
      return null;
    }
    const room = row.status === "active" ? await finalizeBattleIfNeeded(row.id) : buildBattleRoom(row);
    return room;
  }

  const activeRow = rows[0];
  return activeRow ? finalizeBattleIfNeeded(activeRow.id) : null;
}

export function parseBattleLoadout(formData: FormData): BattleChipLoadout {
  return normalizeChipLoadout({
    crucialType: coerceText(formData.get("crucialType")),
    guaranteeTag: coerceText(formData.get("guaranteeTag")),
    banTag: coerceText(formData.get("banTag")),
    doubleBanOne: coerceText(formData.get("doubleBanOne")),
    doubleBanTwo: coerceText(formData.get("doubleBanTwo")),
    additiveType: coerceText(formData.get("additiveType"))
  });
}
