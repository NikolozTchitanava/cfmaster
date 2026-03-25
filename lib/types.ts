export type Focus = "warmup" | "steady" | "stretch";

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
  total: number;
};
