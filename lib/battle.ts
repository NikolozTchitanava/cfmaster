import type {
  AdditiveChipSelection,
  AdditiveChipType,
  BattleDifficulty,
  BattleParticipantScore,
  BattleParticipantState,
  BattleProblem,
  BattleProblemProgress,
  BattleRoom,
  Continent,
  CrucialChipSelection,
  CrucialChipType,
  RankTier,
  Snapshot
} from "@/lib/types";
import type { ProblemCatalogItem } from "@/lib/codeforces";
import { clampProblemRating, stableHash } from "@/lib/utils";

const BASE_SCORES: Record<BattleDifficulty, number> = {
  easy: 500,
  medium: 1000,
  hard: 1500
};

const WA_WEIGHTS: Record<BattleDifficulty, number> = {
  easy: 12,
  medium: 20,
  hard: 28
};

const DIFFICULTY_LABELS: Record<BattleDifficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard"
};

export const CRUCIAL_CHIP_LABELS: Record<CrucialChipType, string> = {
  guarantee_tag: "Guarantee Tag",
  ban_tag: "Ban Tag",
  double_ban: "Double Ban",
  pressure_cooker: "Pressure Cooker",
  anti_comfort: "Anti-Comfort"
};

export const ADDITIVE_CHIP_LABELS: Record<AdditiveChipType, string> = {
  second_chance: "Second Chance",
  precision: "Precision",
  strict_judge: "Strict Judge",
  fast_start: "Fast Start"
};

export function getInitialPlatformRating(cfRating: number | null | undefined): number {
  if (typeof cfRating !== "number") {
    return 1200;
  }

  return Math.round(cfRating * 0.9 + 100);
}

export function getRankTier(rating: number): RankTier {
  if (rating < 800) return "Newbie";
  if (rating < 1200) return "Pupil";
  if (rating < 1400) return "Specialist";
  if (rating < 1600) return "Expert";
  if (rating < 1900) return "Candidate Master";
  if (rating < 2100) return "Master";
  if (rating < 2300) return "International Master";
  if (rating < 2500) return "Grandmaster";
  return "Legendary";
}

export function getKFactor(battlesPlayed: number): number {
  if (battlesPlayed < 20) return 60;
  if (battlesPlayed < 100) return 40;
  if (battlesPlayed < 300) return 25;
  return 15;
}

export function getExpectedScore(playerRating: number, opponentRating: number): number {
  return 1 / (1 + 10 ** ((opponentRating - playerRating) / 400));
}

export function formatChipLabel(chip: CrucialChipSelection | AdditiveChipSelection): string {
  if ("tag" in chip || "tags" in chip) {
    return CRUCIAL_CHIP_LABELS[(chip as CrucialChipSelection).type];
  }

  return ADDITIVE_CHIP_LABELS[(chip as AdditiveChipSelection).type];
}

export function describeCrucialChip(chip: CrucialChipSelection): string {
  switch (chip.type) {
    case "guarantee_tag":
      return chip.tag ? `${CRUCIAL_CHIP_LABELS[chip.type]}: ${chip.tag}` : CRUCIAL_CHIP_LABELS[chip.type];
    case "ban_tag":
      return chip.tag ? `${CRUCIAL_CHIP_LABELS[chip.type]}: ${chip.tag}` : CRUCIAL_CHIP_LABELS[chip.type];
    case "double_ban":
      return chip.tags?.length ? `${CRUCIAL_CHIP_LABELS[chip.type]}: ${chip.tags.join(", ")}` : CRUCIAL_CHIP_LABELS[chip.type];
    default:
      return CRUCIAL_CHIP_LABELS[chip.type];
  }
}

export function getBattleTagOptions(catalog: ProblemCatalogItem[]): string[] {
  return Array.from(
    new Set(
      catalog.flatMap((problem) => problem.tags).filter((tag) => tag && tag !== "*special")
    )
  ).sort((left, right) => left.localeCompare(right));
}

function getUnionSolvedKeys(snapshot: Snapshot): Set<string> {
  return new Set(
    Object.values(snapshot.solved)
      .flat()
      .map((task) => task.problemKey)
  );
}

function ratingTargets(playerOneRating: number, playerTwoRating: number, pressureCookerInPlay: boolean): Record<BattleDifficulty, { min: number; max: number; center: number }> {
  const low = Math.min(playerOneRating, playerTwoRating);
  const high = Math.max(playerOneRating, playerTwoRating);
  const mid = Math.round((playerOneRating + playerTwoRating) / 2);
  const hardBonus = pressureCookerInPlay ? 300 : 0;

  return {
    easy: {
      min: clampProblemRating(low + 100),
      max: clampProblemRating(low + 200),
      center: clampProblemRating(low + 150)
    },
    medium: {
      min: clampProblemRating(mid - 100),
      max: clampProblemRating(mid + 100),
      center: clampProblemRating(mid)
    },
    hard: {
      min: clampProblemRating(high + 100 + hardBonus),
      max: clampProblemRating(high + 200 + hardBonus),
      center: clampProblemRating(high + 150 + hardBonus)
    }
  };
}

function getBannedTags(chips: CrucialChipSelection[]): Set<string> {
  const banned = new Set<string>();
  for (const chip of chips) {
    if (chip.type === "ban_tag" && chip.tag) {
      banned.add(chip.tag);
    }
    if (chip.type === "double_ban") {
      for (const tag of chip.tags ?? []) {
        banned.add(tag);
      }
    }
  }

  return banned;
}

type GuaranteeRequest = {
  tag: string;
  forcedHard: boolean;
};

function buildGuaranteeRequests(
  playerOneChip: CrucialChipSelection,
  playerTwoChip: CrucialChipSelection
): GuaranteeRequest[] {
  const requests: GuaranteeRequest[] = [];

  if (playerOneChip.type === "guarantee_tag" && playerOneChip.tag) {
    requests.push({
      tag: playerOneChip.tag,
      forcedHard: playerTwoChip.type === "anti_comfort"
    });
  }

  if (playerTwoChip.type === "guarantee_tag" && playerTwoChip.tag) {
    requests.push({
      tag: playerTwoChip.tag,
      forcedHard: playerOneChip.type === "anti_comfort"
    });
  }

  return requests;
}

function candidateScore(
  problem: ProblemCatalogItem,
  slot: BattleDifficulty,
  targets: Record<BattleDifficulty, { min: number; max: number; center: number }>,
  seed: string
): number {
  const target = targets[slot];
  const inBandPenalty = problem.rating < target.min || problem.rating > target.max ? 10000 : 0;
  const distancePenalty = Math.abs(problem.rating - target.center);
  const tieBreaker = stableHash(`${seed}:${slot}:${problem.key}`) % 97;

  return inBandPenalty + distancePenalty + tieBreaker;
}

function selectTaggedProblem(
  problems: ProblemCatalogItem[],
  tag: string,
  allowedSlots: BattleDifficulty[],
  targets: Record<BattleDifficulty, { min: number; max: number; center: number }>,
  selectedKeys: Set<string>,
  seed: string
): { slot: BattleDifficulty; problem: ProblemCatalogItem } | null {
  let best: { slot: BattleDifficulty; problem: ProblemCatalogItem; score: number } | null = null;

  for (const slot of allowedSlots) {
    for (const problem of problems) {
      if (selectedKeys.has(problem.key) || !problem.tags.includes(tag)) {
        continue;
      }

      const score = candidateScore(problem, slot, targets, seed);
      if (!best || score < best.score) {
        best = { slot, problem, score };
      }
    }
  }

  return best ? { slot: best.slot, problem: best.problem } : null;
}

function selectBestProblem(
  problems: ProblemCatalogItem[],
  slot: BattleDifficulty,
  targets: Record<BattleDifficulty, { min: number; max: number; center: number }>,
  selectedKeys: Set<string>,
  seed: string
): ProblemCatalogItem | null {
  let best: { problem: ProblemCatalogItem; score: number } | null = null;

  for (const problem of problems) {
    if (selectedKeys.has(problem.key)) {
      continue;
    }

    const score = candidateScore(problem, slot, targets, seed);
    if (!best || score < best.score) {
      best = { problem, score };
    }
  }

  return best?.problem ?? null;
}

export function selectBattleProblems(input: {
  playerOneRating: number;
  playerTwoRating: number;
  playerOneSnapshot: Snapshot;
  playerTwoSnapshot: Snapshot;
  playerOneChip: CrucialChipSelection;
  playerTwoChip: CrucialChipSelection;
  catalog: ProblemCatalogItem[];
  seed: string;
}): BattleProblem[] {
  const pressureCookerInPlay = input.playerOneChip.type === "pressure_cooker" || input.playerTwoChip.type === "pressure_cooker";
  const targets = ratingTargets(input.playerOneRating, input.playerTwoRating, pressureCookerInPlay);
  const bannedTags = getBannedTags([input.playerOneChip, input.playerTwoChip]);
  const solvedKeys = new Set<string>([
    ...getUnionSolvedKeys(input.playerOneSnapshot),
    ...getUnionSolvedKeys(input.playerTwoSnapshot)
  ]);

  const problemPool = input.catalog.filter((problem) => {
    if (solvedKeys.has(problem.key)) {
      return false;
    }

    return !problem.tags.some((tag) => bannedTags.has(tag));
  });

  const selectedKeys = new Set<string>();
  const selectedSlots = new Set<BattleDifficulty>();
  const assignments = new Map<BattleDifficulty, ProblemCatalogItem>();
  const requests = buildGuaranteeRequests(input.playerOneChip, input.playerTwoChip).sort(
    (left, right) => Number(left.forcedHard) - Number(right.forcedHard)
  );

  for (const request of requests) {
    const allowedSlots: BattleDifficulty[] = request.forcedHard ? ["hard"] : ["easy", "medium", "hard"];
    const picked = selectTaggedProblem(problemPool, request.tag, allowedSlots.filter((slot) => !selectedSlots.has(slot)), targets, selectedKeys, input.seed);
    if (!picked) {
      throw new Error(`No battle problem was available for the tag "${request.tag}" after chip filters were applied.`);
    }

    assignments.set(picked.slot, picked.problem);
    selectedSlots.add(picked.slot);
    selectedKeys.add(picked.problem.key);
  }

  for (const slot of ["easy", "medium", "hard"] as BattleDifficulty[]) {
    if (assignments.has(slot)) {
      continue;
    }

    const picked = selectBestProblem(problemPool, slot, targets, selectedKeys, input.seed);
    if (!picked) {
      throw new Error("Could not build a full 3-problem battle from the available Codeforces pool.");
    }

    assignments.set(slot, picked);
    selectedKeys.add(picked.key);
  }

  return (["easy", "medium", "hard"] as BattleDifficulty[]).map((slot) => {
    const target = targets[slot];
    const problem = assignments.get(slot);
    if (!problem) {
      throw new Error(`Battle slot ${slot} is missing a problem assignment.`);
    }

    return {
      problemKey: problem.key,
      contestId: problem.contestId,
      index: problem.index,
      name: problem.name,
      link: problem.link,
      tags: problem.tags,
      rating: problem.rating,
      slot,
      targetMin: target.min,
      targetMax: target.max,
      targetLabel: `${DIFFICULTY_LABELS[slot]} • ${target.min}-${target.max}`
    };
  });
}

function getChargeableWrongAttempts(wrongAttempts: number, additive: AdditiveChipSelection): number {
  if (additive.type !== "second_chance") {
    return wrongAttempts;
  }

  return Math.max(0, wrongAttempts - 1);
}

function getWaMultiplier(playerAdditive: AdditiveChipSelection, opponentAdditive: AdditiveChipSelection): number {
  let multiplier = 1;

  if (playerAdditive.type === "precision") {
    multiplier *= 0.8;
  }

  if (opponentAdditive.type === "strict_judge") {
    multiplier *= 1.2;
  }

  return multiplier;
}

function getAcceptedMinute(acceptedMinute: number | null, acceptedAt: string | null, startedAt: string | null): number | null {
  if (typeof acceptedMinute === "number") {
    return acceptedMinute;
  }

  if (!acceptedAt || !startedAt) {
    return null;
  }

  const diff = new Date(acceptedAt).getTime() - new Date(startedAt).getTime();
  return diff >= 0 ? Math.floor(diff / 60000) : 0;
}

function getProblemState(progress: BattleProblemProgress[], problemKey: string): BattleProblemProgress {
  const state = progress.find((entry) => entry.problemKey === problemKey);
  if (!state) {
    throw new Error(`Battle problem state missing for ${problemKey}.`);
  }

  return state;
}

function calculateSingleProblemScore(input: {
  slot: BattleDifficulty;
  wrongAttempts: number;
  acceptedMinute: number | null;
  playerAdditive: AdditiveChipSelection;
  opponentAdditive: AdditiveChipSelection;
  currentMinute: number;
}): { score: number; potentialScoreNow: number | null } {
  const baseScore = BASE_SCORES[input.slot];
  const waWeight = WA_WEIGHTS[input.slot] * getWaMultiplier(input.playerAdditive, input.opponentAdditive);
  const chargeableWrongAttempts = getChargeableWrongAttempts(input.wrongAttempts, input.playerAdditive);

  if (typeof input.acceptedMinute === "number") {
    return {
      score: Math.max(0, baseScore - input.acceptedMinute - chargeableWrongAttempts * waWeight),
      potentialScoreNow: null
    };
  }

  return {
    score: 0,
    potentialScoreNow: Math.max(0, baseScore - input.currentMinute - chargeableWrongAttempts * waWeight)
  };
}

function getParticipantBonuses(
  participant: BattleParticipantState,
  opponent: BattleParticipantState,
  solvedCount: number
): number {
  let multiplier = 1;

  if (opponent.crucialChip.type === "double_ban") {
    multiplier *= 1.05;
  }

  if (participant.additiveChip.type === "fast_start" && solvedCount > 0) {
    multiplier *= 1.05;
  }

  return multiplier;
}

function compareScores(
  left: BattleParticipantScore,
  right: BattleParticipantScore
): { winnerUserId: string | null; loserUserId: string | null; reason: string | null; draw: boolean } {
  if (left.totalScore !== right.totalScore) {
    return left.totalScore > right.totalScore
      ? { winnerUserId: left.userId, loserUserId: right.userId, reason: "higher total score", draw: false }
      : { winnerUserId: right.userId, loserUserId: left.userId, reason: "higher total score", draw: false };
  }

  if (left.solvedCount !== right.solvedCount) {
    return left.solvedCount > right.solvedCount
      ? { winnerUserId: left.userId, loserUserId: right.userId, reason: "more problems solved", draw: false }
      : { winnerUserId: right.userId, loserUserId: left.userId, reason: "more problems solved", draw: false };
  }

  const leftLastAccepted = left.lastAcceptedMinute ?? Number.MAX_SAFE_INTEGER;
  const rightLastAccepted = right.lastAcceptedMinute ?? Number.MAX_SAFE_INTEGER;
  if (leftLastAccepted !== rightLastAccepted) {
    return leftLastAccepted < rightLastAccepted
      ? { winnerUserId: left.userId, loserUserId: right.userId, reason: "earlier last accepted", draw: false }
      : { winnerUserId: right.userId, loserUserId: left.userId, reason: "earlier last accepted", draw: false };
  }

  if (left.wrongAttempts !== right.wrongAttempts) {
    return left.wrongAttempts < right.wrongAttempts
      ? { winnerUserId: left.userId, loserUserId: right.userId, reason: "fewer wrong attempts", draw: false }
      : { winnerUserId: right.userId, loserUserId: left.userId, reason: "fewer wrong attempts", draw: false };
  }

  return {
    winnerUserId: null,
    loserUserId: null,
    reason: "perfect tie",
    draw: true
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function calculateParticipantDelta(input: {
  participant: BattleParticipantState;
  opponent: BattleParticipantState;
  participantScore: number;
  opponentScore: number;
  result: 0 | 0.5 | 1;
  varianceMatch: boolean;
  battlesPlayed: number;
}): number {
  const expectedScore = getExpectedScore(input.participant.platformRating, input.opponent.platformRating);
  const kFactor = getKFactor(input.battlesPlayed);
  const denominator = input.participantScore <= 0 || input.opponentScore <= 0 ? 1 : input.opponentScore;
  const dominanceRaw =
    input.participantScore <= 0 && input.opponentScore <= 0
      ? 1
      : input.opponentScore <= 0
        ? 1.3
        : input.participantScore / denominator;
  const dominance = clamp(dominanceRaw, 0.7, 1.3);
  let delta = kFactor * (input.result - expectedScore);
  delta *= dominance;

  if (input.varianceMatch) {
    delta *= 0.95;
  }

  const rounded = Math.round(delta);
  const floor = input.participant.initialPlatformRating - 300;
  return Math.max(floor, input.participant.platformRating + rounded) - input.participant.platformRating;
}

function determineRevealReason(
  additive: AdditiveChipSelection,
  wrongAttempts: number,
  solvedCount: number,
  opponentWrongAttempts: number
): string | null {
  switch (additive.type) {
    case "second_chance":
      return wrongAttempts > 0 ? "First wrong attempt ignored." : null;
    case "precision":
      return wrongAttempts > 0 ? "Wrong-attempt penalty reduced." : null;
    case "strict_judge":
      return opponentWrongAttempts > 0 ? "Opponent penalty increased." : null;
    case "fast_start":
      return solvedCount > 0 ? "Fast Start bonus claimed." : null;
    default:
      return null;
  }
}

export function calculateBattleRoomState(
  room: Omit<BattleRoom, "scores" | "winnerUserId" | "loserUserId" | "resultLabel" | "resultReason">,
  now = new Date()
): Pick<BattleRoom, "scores" | "winnerUserId" | "loserUserId" | "resultLabel" | "resultReason"> {
  const currentMinute =
    room.startedAt && room.status !== "pending"
      ? Math.max(0, Math.floor((now.getTime() - new Date(room.startedAt).getTime()) / 60000))
      : 0;

  const [playerOne, playerTwo] = room.participants;
  const scores: Record<string, BattleParticipantScore> = {};

  const playerOneBreakdown: BattleParticipantScore["breakdown"] = [];
  const playerTwoBreakdown: BattleParticipantScore["breakdown"] = [];

  let playerOneWrongAttempts = 0;
  let playerTwoWrongAttempts = 0;
  let playerOneSolved = 0;
  let playerTwoSolved = 0;
  let playerOneLastAccepted: number | null = null;
  let playerTwoLastAccepted: number | null = null;
  let playerOneBaseScore = 0;
  let playerTwoBaseScore = 0;

  for (const problem of room.problems) {
    const state = getProblemState(room.progress, problem.problemKey);
    const playerOneAcceptedMinute = getAcceptedMinute(state.playerOneAcceptedMinute, state.playerOneAcceptedAt, room.startedAt);
    const playerTwoAcceptedMinute = getAcceptedMinute(state.playerTwoAcceptedMinute, state.playerTwoAcceptedAt, room.startedAt);
    const playerOneScoreState = calculateSingleProblemScore({
      slot: problem.slot,
      wrongAttempts: state.playerOneWrongAttempts,
      acceptedMinute: playerOneAcceptedMinute,
      playerAdditive: playerOne.additiveChip,
      opponentAdditive: playerTwo.additiveChip,
      currentMinute
    });
    const playerTwoScoreState = calculateSingleProblemScore({
      slot: problem.slot,
      wrongAttempts: state.playerTwoWrongAttempts,
      acceptedMinute: playerTwoAcceptedMinute,
      playerAdditive: playerTwo.additiveChip,
      opponentAdditive: playerOne.additiveChip,
      currentMinute
    });

    playerOneWrongAttempts += state.playerOneWrongAttempts;
    playerTwoWrongAttempts += state.playerTwoWrongAttempts;
    if (typeof playerOneAcceptedMinute === "number") {
      playerOneSolved += 1;
      playerOneLastAccepted = playerOneLastAccepted === null ? playerOneAcceptedMinute : Math.max(playerOneLastAccepted, playerOneAcceptedMinute);
    }
    if (typeof playerTwoAcceptedMinute === "number") {
      playerTwoSolved += 1;
      playerTwoLastAccepted = playerTwoLastAccepted === null ? playerTwoAcceptedMinute : Math.max(playerTwoLastAccepted, playerTwoAcceptedMinute);
    }
    playerOneBaseScore += playerOneScoreState.score;
    playerTwoBaseScore += playerTwoScoreState.score;

    playerOneBreakdown.push({
      problemKey: problem.problemKey,
      slot: problem.slot,
      score: playerOneScoreState.score,
      wrongAttempts: state.playerOneWrongAttempts,
      acceptedMinute: playerOneAcceptedMinute,
      potentialScoreNow: playerOneScoreState.potentialScoreNow
    });
    playerTwoBreakdown.push({
      problemKey: problem.problemKey,
      slot: problem.slot,
      score: playerTwoScoreState.score,
      wrongAttempts: state.playerTwoWrongAttempts,
      acceptedMinute: playerTwoAcceptedMinute,
      potentialScoreNow: playerTwoScoreState.potentialScoreNow
    });
  }

  const playerOneBonus = getParticipantBonuses(playerOne, playerTwo, playerOneSolved);
  const playerTwoBonus = getParticipantBonuses(playerTwo, playerOne, playerTwoSolved);
  const playerOneTotal = Math.round(playerOneBaseScore * playerOneBonus * 100) / 100;
  const playerTwoTotal = Math.round(playerTwoBaseScore * playerTwoBonus * 100) / 100;

  scores[playerOne.userId] = {
    userId: playerOne.userId,
    totalScore: playerOneTotal,
    solvedCount: playerOneSolved,
    wrongAttempts: playerOneWrongAttempts,
    lastAcceptedMinute: playerOneLastAccepted,
    bonusMultiplier: playerOneBonus,
    breakdown: playerOneBreakdown
  };
  scores[playerTwo.userId] = {
    userId: playerTwo.userId,
    totalScore: playerTwoTotal,
    solvedCount: playerTwoSolved,
    wrongAttempts: playerTwoWrongAttempts,
    lastAcceptedMinute: playerTwoLastAccepted,
    bonusMultiplier: playerTwoBonus,
    breakdown: playerTwoBreakdown
  };

  const compared = compareScores(scores[playerOne.userId], scores[playerTwo.userId]);
  const resultLabel = compared.draw
    ? "Draw"
    : `${compared.winnerUserId === playerOne.userId ? playerOne.handle : playerTwo.handle} wins`;

  return {
    scores,
    winnerUserId: compared.winnerUserId,
    loserUserId: compared.loserUserId,
    resultLabel,
    resultReason: compared.reason
  };
}

export function getTriggeredAdditiveReveal(
  participant: BattleParticipantState,
  ownScore: BattleParticipantScore,
  opponentScore: BattleParticipantScore
): { revealed: boolean; reason: string | null } {
  const reason = determineRevealReason(
    participant.additiveChip,
    ownScore.wrongAttempts,
    ownScore.solvedCount,
    opponentScore.wrongAttempts
  );

  return {
    revealed: Boolean(reason),
    reason
  };
}

export function shouldFinishBattle(room: BattleRoom, now = new Date()): boolean {
  if (room.status !== "active") {
    return false;
  }

  if (room.endsAt && now.getTime() >= new Date(room.endsAt).getTime()) {
    return true;
  }

  return room.progress.every((entry) => entry.playerOneAcceptedAt && entry.playerTwoAcceptedAt);
}

export function calculateRatingChanges(room: BattleRoom): Record<string, number> {
  const [playerOne, playerTwo] = room.participants;
  const playerOneScore = room.scores[playerOne.userId];
  const playerTwoScore = room.scores[playerTwo.userId];
  const varianceMatch =
    playerOne.crucialChip.type === "pressure_cooker" ||
    playerTwo.crucialChip.type === "pressure_cooker" ||
    playerOne.crucialChip.type === "double_ban" ||
    playerTwo.crucialChip.type === "double_ban";

  const playerOneResult = room.winnerUserId === null ? 0.5 : room.winnerUserId === playerOne.userId ? 1 : 0;
  const playerTwoResult = room.winnerUserId === null ? 0.5 : room.winnerUserId === playerTwo.userId ? 1 : 0;

  const playerOneDelta = calculateParticipantDelta({
    participant: playerOne,
    opponent: playerTwo,
    participantScore: playerOneScore.totalScore,
    opponentScore: playerTwoScore.totalScore,
    result: playerOneResult as 0 | 0.5 | 1,
    varianceMatch,
    battlesPlayed: playerOne.battlesPlayed
  });
  const playerTwoDelta = calculateParticipantDelta({
    participant: playerTwo,
    opponent: playerOne,
    participantScore: playerTwoScore.totalScore,
    opponentScore: playerOneScore.totalScore,
    result: playerTwoResult as 0 | 0.5 | 1,
    varianceMatch,
    battlesPlayed: playerTwo.battlesPlayed
  });

  return {
    [playerOne.userId]: playerOneDelta,
    [playerTwo.userId]: playerTwoDelta
  };
}

export function getCountrySummary(country: string | null, continent: Continent | null): string {
  if (country && continent) {
    return `${country} • ${continent}`;
  }

  return country || continent || "Country not set";
}
