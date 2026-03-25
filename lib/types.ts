export type Focus = "warmup" | "steady" | "stretch";

export type Continent =
  | "Africa"
  | "Asia"
  | "Europe"
  | "North America"
  | "Oceania"
  | "South America";

export type RankTier =
  | "Newbie"
  | "Pupil"
  | "Specialist"
  | "Expert"
  | "Candidate Master"
  | "Master"
  | "International Master"
  | "Grandmaster"
  | "Legendary";

export type BattleDifficulty = "easy" | "medium" | "hard";
export type BattleStatus = "pending" | "active" | "finished" | "declined" | "expired";

export type CrucialChipType =
  | "guarantee_tag"
  | "ban_tag"
  | "double_ban"
  | "pressure_cooker"
  | "anti_comfort";

export type AdditiveChipType = "second_chance" | "precision" | "strict_judge" | "fast_start";

export type CrucialChipSelection = {
  type: CrucialChipType;
  tag?: string | null;
  tags?: string[];
};

export type AdditiveChipSelection = {
  type: AdditiveChipType;
};

export type BattleChipLoadout = {
  crucial: CrucialChipSelection;
  additive: AdditiveChipSelection;
};

export type CodeforcesProfile = {
  handle: string;
  rating?: number | null;
  maxRating?: number | null;
  titlePhoto?: string;
  rank?: string;
  maxRank?: string;
  organization?: string;
  country?: string;
  friendOfCount?: number | null;
};

export type RatingPoint = {
  contest: string;
  newRating: number;
  time: number;
};

export type SolvedTask = {
  name: string;
  rating?: number | null;
  submissions: number;
  link: string;
  problemKey: string;
  contestId?: number | null;
  index?: string | null;
};

export type SolvedData = Record<string, SolvedTask[]>;

export type Snapshot = {
  profile: CodeforcesProfile;
  solved: SolvedData;
  rating: RatingPoint[];
  syncedAt?: string | null;
};

export type BattleProblem = {
  problemKey: string;
  contestId: number;
  index: string;
  name: string;
  link: string;
  tags: string[];
  rating: number;
  slot: BattleDifficulty;
  targetMin: number;
  targetMax: number;
  targetLabel: string;
};

export type BattleProblemProgress = {
  problemKey: string;
  playerOneWrongAttempts: number;
  playerTwoWrongAttempts: number;
  playerOneAcceptedAt: string | null;
  playerTwoAcceptedAt: string | null;
  playerOneAcceptedMinute: number | null;
  playerTwoAcceptedMinute: number | null;
};

export type BattleParticipantState = {
  userId: string;
  handle: string;
  platformRating: number;
  initialPlatformRating: number;
  battlesPlayed: number;
  country: string | null;
  continent: Continent | null;
  crucialChip: CrucialChipSelection;
  additiveChip: AdditiveChipSelection;
  additiveRevealed: boolean;
  additiveRevealReason: string | null;
  scoreBonusMultiplier: number;
  ratingDelta: number | null;
  ratingAfter: number | null;
};

export type BattleScoreBreakdown = {
  problemKey: string;
  slot: BattleDifficulty;
  score: number;
  wrongAttempts: number;
  acceptedMinute: number | null;
  potentialScoreNow: number | null;
};

export type BattleParticipantScore = {
  userId: string;
  totalScore: number;
  solvedCount: number;
  wrongAttempts: number;
  lastAcceptedMinute: number | null;
  bonusMultiplier: number;
  breakdown: BattleScoreBreakdown[];
};

export type BattleRoom = {
  id: string;
  status: BattleStatus;
  createdAt: string;
  startedAt: string | null;
  endsAt: string | null;
  finishedAt: string | null;
  problems: BattleProblem[];
  participants: [BattleParticipantState, BattleParticipantState];
  progress: BattleProblemProgress[];
  scores: Record<string, BattleParticipantScore>;
  winnerUserId: string | null;
  loserUserId: string | null;
  resultLabel: string;
  resultReason: string | null;
  ratingDeltasApplied: boolean;
};

export type CalendarCell = {
  date: string;
  count: number;
  level: number;
  isToday: boolean;
};

export type CalendarView = {
  weeks: CalendarCell[][];
  monthLabels: string[];
  weekdayLabels: string[];
  startLabel: string;
  endLabel: string;
};

export type SnapshotSummary = {
  currentStreak: number;
  longestStreak: number;
  totalSolved: number;
  activeDays: number;
  lastMonthSolved: number;
  lastYearSolved: number;
  hardestRating: number | null;
  ratingDisplay: string;
  syncedAtLabel: string;
  lastActiveLabel: string;
  bestDay: {
    label: string;
    count: number;
  } | null;
};

export type StatCard = {
  label: string;
  value: string;
};

export type RecentDay = {
  date: string;
  label: string;
  count: number;
  peakRating: string;
};

export type SuggestionTask = {
  name: string;
  link: string;
  rating: number;
  contestId: number;
  index: string;
  problemKey: string;
  targetRating: number;
  solvedToday: boolean;
};

export type DailySuggestions = {
  day: string;
  focus: Focus;
  focusLabel: string;
  streak: number;
  todayComplete: boolean;
  tasks: SuggestionTask[];
};

export type StoredUser = {
  id: string;
  email: string;
  handle: string;
  focus: Focus;
  rank: string | null;
  rating: number | null;
  titlePhoto: string | null;
  platformRating: number;
  initialPlatformRating: number;
  battleWins: number;
  battleLosses: number;
  battleDraws: number;
  battlesPlayed: number;
  country: string | null;
  continent: Continent | null;
  snapshot: Snapshot;
  createdAt: string;
};

export type FriendCard = {
  handle: string;
  rank: string;
  ratingDisplay: string;
  currentStreak: number;
  lastMonthSolved: number;
  syncedAtLabel: string;
  detailHref: string;
  isRegistered: boolean;
};

export type BattleRecord = {
  wins: number;
  losses: number;
  draws: number;
  total: number;
  winRate: number;
};

export type BattleSummaryCard = {
  id: string;
  opponentHandle: string;
  status: BattleStatus;
  startedAt: string | null;
  endsAt: string | null;
  scoreline: string;
  href: string;
};

export type LeaderboardEntry = {
  rank: number;
  handle: string;
  platformRating: number;
  rankTier: RankTier;
  country: string | null;
  continent: Continent | null;
  countryCode: string | null;
  battlesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
};
