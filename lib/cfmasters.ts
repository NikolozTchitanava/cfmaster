import { fetchProblemCatalog } from "@/lib/codeforces";
import type { CalendarView, DailySuggestions, Focus, RecentDay, Snapshot, SnapshotSummary, StatCard, SuggestionTask } from "@/lib/types";
import {
  clampProblemRating,
  FOCUS_LABELS,
  formatDayCount,
  formatDayLabel,
  formatRating,
  formatSyncLabel,
  parseDay,
  previousDay,
  stableHash,
  todayKey
} from "@/lib/utils";

const FOCUS_OFFSETS: Record<Focus, number[]> = {
  warmup: [-200, -100, 0],
  steady: [0, 100, 200],
  stretch: [200, 300, 400]
};

function activityLevel(count: number): number {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

function getSolvedDays(snapshot: Snapshot): string[] {
  return Object.keys(snapshot.solved)
    .filter((value) => Boolean(parseDay(value)))
    .sort();
}

function getSolvedFirstDays(snapshot: Snapshot): Map<string, string> {
  const map = new Map<string, string>();
  for (const [day, tasks] of Object.entries(snapshot.solved)) {
    for (const task of tasks) {
      const previous = map.get(task.problemKey);
      if (!previous || day < previous) {
        map.set(task.problemKey, day);
      }
    }
  }

  return map;
}

export function buildCalendar(snapshot: Snapshot, weeks = 30): CalendarView {
  const today = new Date();
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const mondayOffset = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - mondayOffset - (weeks - 1) * 7);

  const monthLabels: string[] = [];
  const weeksView = Array.from({ length: weeks }, (_, weekIndex) => {
    const weekStart = new Date(start);
    weekStart.setUTCDate(start.getUTCDate() + weekIndex * 7);

    if (weekIndex === 0) {
      monthLabels.push(
        new Intl.DateTimeFormat("en-US", {
          month: "short",
          timeZone: "UTC"
        }).format(weekStart)
      );
    } else {
      const marker = Array.from({ length: 7 }, (_, offset) => {
        const day = new Date(weekStart);
        day.setUTCDate(weekStart.getUTCDate() + offset);
        return day;
      }).find((day) => day.getUTCDate() === 1);

      monthLabels.push(
        marker
          ? new Intl.DateTimeFormat("en-US", {
              month: "short",
              timeZone: "UTC"
            }).format(marker)
          : ""
      );
    }

    return Array.from({ length: 7 }, (_, dayOffset) => {
      const current = new Date(weekStart);
      current.setUTCDate(weekStart.getUTCDate() + dayOffset);
      const key = current.toISOString().slice(0, 10);
      const count = snapshot.solved[key]?.length ?? 0;

      return {
        date: key,
        count,
        level: activityLevel(count),
        isToday: key === todayKey()
      };
    });
  });

  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + weeks * 7 - 1);

  return {
    weeks: weeksView,
    monthLabels,
    weekdayLabels: ["Mon", "", "Wed", "", "Fri", "", ""],
    startLabel: formatDayLabel(start),
    endLabel: formatDayLabel(end)
  };
}

function computeLongestStreak(days: string[]): number {
  let longest = 0;
  let current = 0;
  let previous: string | null = null;

  for (const day of days) {
    if (previous) {
      const previousDate = parseDay(previous);
      const currentDate = parseDay(day);
      if (previousDate && currentDate) {
        const distance = (currentDate.getTime() - previousDate.getTime()) / (1000 * 60 * 60 * 24);
        current = distance === 1 ? current + 1 : 1;
      } else {
        current = 1;
      }
    } else {
      current = 1;
    }

    longest = Math.max(longest, current);
    previous = day;
  }

  return longest;
}

function computeCurrentStreak(days: string[]): number {
  if (!days.length) {
    return 0;
  }

  const solvedLookup = new Set(days);
  let cursor = todayKey();

  if (!solvedLookup.has(cursor)) {
    cursor = previousDay(cursor);
    if (!solvedLookup.has(cursor)) {
      return 0;
    }
  }

  let streak = 0;
  while (solvedLookup.has(cursor)) {
    streak += 1;
    cursor = previousDay(cursor);
  }

  return streak;
}

export function buildSnapshotSummary(snapshot: Snapshot): {
  calendar: CalendarView;
  summary: SnapshotSummary;
  statCards: StatCard[];
  recentDays: RecentDay[];
} {
  const solvedDays = getSolvedDays(snapshot);
  const today = new Date();
  const lastMonthCutoff = new Date(today);
  lastMonthCutoff.setUTCDate(today.getUTCDate() - 30);
  const lastYearCutoff = new Date(today);
  lastYearCutoff.setUTCDate(today.getUTCDate() - 365);

  const totalSolved = Object.values(snapshot.solved).reduce((total, tasks) => total + tasks.length, 0);
  const activeDays = solvedDays.length;
  const lastMonthSolved = Object.entries(snapshot.solved).reduce((total, [day, tasks]) => {
    const parsed = parseDay(day);
    return parsed && parsed >= lastMonthCutoff ? total + tasks.length : total;
  }, 0);
  const lastYearSolved = Object.entries(snapshot.solved).reduce((total, [day, tasks]) => {
    const parsed = parseDay(day);
    return parsed && parsed >= lastYearCutoff ? total + tasks.length : total;
  }, 0);
  const hardestRating = Object.values(snapshot.solved)
    .flat()
    .reduce<number | null>((highest, task) => {
      if (typeof task.rating !== "number") {
        return highest;
      }

      return highest === null ? task.rating : Math.max(highest, task.rating);
    }, null);

  const bestEntry = Object.entries(snapshot.solved).reduce<[string, number] | null>((best, [day, tasks]) => {
    if (!best || tasks.length > best[1]) {
      return [day, tasks.length];
    }

    return best;
  }, null);

  const summary: SnapshotSummary = {
    currentStreak: computeCurrentStreak(solvedDays),
    longestStreak: computeLongestStreak(solvedDays),
    totalSolved,
    activeDays,
    lastMonthSolved,
    lastYearSolved,
    hardestRating,
    ratingDisplay: formatRating(snapshot.profile.rating),
    syncedAtLabel: formatSyncLabel(snapshot.syncedAt),
    lastActiveLabel: solvedDays.length ? formatDayLabel(solvedDays[solvedDays.length - 1]) : "No activity yet",
    bestDay: bestEntry ? { label: formatDayLabel(bestEntry[0]), count: bestEntry[1] } : null
  };

  const statCards: StatCard[] = [
    { label: "Current streak", value: formatDayCount(summary.currentStreak) },
    { label: "Longest streak", value: formatDayCount(summary.longestStreak) },
    { label: "Problems solved", value: String(summary.totalSolved) },
    { label: "Last 30 days", value: String(summary.lastMonthSolved) },
    { label: "Active days", value: String(summary.activeDays) },
    { label: "Current rating", value: summary.ratingDisplay }
  ];

  const recentDays: RecentDay[] = solvedDays
    .slice(-6)
    .reverse()
    .map((day) => {
      const tasks = snapshot.solved[day] ?? [];
      const peak = tasks.reduce<number | null>((highest, task) => {
        if (typeof task.rating !== "number") {
          return highest;
        }

        return highest === null ? task.rating : Math.max(highest, task.rating);
      }, null);

      return {
        date: day,
        label: formatDayLabel(day),
        count: tasks.length,
        peakRating: peak ? `Peak ${peak}` : "Mixed unrated set"
      };
    });

  return {
    calendar: buildCalendar(snapshot),
    summary,
    statCards,
    recentDays
  };
}

function buildTargetRatings(rating: number | null | undefined, focus: Focus): number[] {
  const base = clampProblemRating(rating ?? 1200);
  return FOCUS_OFFSETS[focus].map((offset) => clampProblemRating(base + offset));
}

async function buildSuggestionsForDay(
  snapshot: Snapshot,
  userId: string,
  focus: Focus,
  day: string,
  catalog: Awaited<ReturnType<typeof fetchProblemCatalog>>
): Promise<SuggestionTask[]> {
  const firstSolvedDays = getSolvedFirstDays(snapshot);
  const solvedBeforeDay = new Set<string>();
  const solvedOnDay = new Set<string>();

  for (const [problemKey, solvedDay] of firstSolvedDays.entries()) {
    if (solvedDay < day) {
      solvedBeforeDay.add(problemKey);
    }
    if (solvedDay === day) {
      solvedOnDay.add(problemKey);
    }
  }

  const selected = new Set<string>();
  const suggestions: SuggestionTask[] = [];
  const targets = buildTargetRatings(snapshot.profile.rating, focus);

  for (const [slot, targetRating] of targets.entries()) {
    const candidate = catalog
      .filter((problem) => !selected.has(problem.key) && !solvedBeforeDay.has(problem.key))
      .map((problem) => ({
        problem,
        distance: Math.abs(problem.rating - targetRating),
        hash: stableHash(`${userId}:${day}:${focus}:${slot}:${problem.key}`)
      }))
      .sort((left, right) => {
        if (left.distance !== right.distance) {
          return left.distance - right.distance;
        }

        if (left.hash !== right.hash) {
          return left.hash - right.hash;
        }

        return left.problem.key.localeCompare(right.problem.key);
      })[0];

    if (!candidate) {
      continue;
    }

    selected.add(candidate.problem.key);
    suggestions.push({
      name: candidate.problem.name,
      link: candidate.problem.link,
      rating: candidate.problem.rating,
      contestId: candidate.problem.contestId,
      index: candidate.problem.index,
      problemKey: candidate.problem.key,
      targetRating,
      solvedToday: solvedOnDay.has(candidate.problem.key)
    });
  }

  return suggestions;
}

export async function getDailySuggestions(snapshot: Snapshot, userId: string, focus: Focus): Promise<DailySuggestions> {
  const today = todayKey();
  const catalog = await fetchProblemCatalog();
  const todayTasks = await buildSuggestionsForDay(snapshot, userId, focus, today, catalog);
  const todayComplete = todayTasks.length === 3 && todayTasks.every((task) => task.solvedToday);

  let streak = 0;
  let cursor = todayComplete ? today : previousDay(today);
  for (let safety = 0; safety < 365; safety += 1) {
    const tasks = await buildSuggestionsForDay(snapshot, userId, focus, cursor, catalog);
    if (tasks.length !== 3 || !tasks.every((task) => task.solvedToday)) {
      break;
    }

    streak += 1;
    cursor = previousDay(cursor);
  }

  return {
    day: today,
    focus,
    focusLabel: FOCUS_LABELS[focus],
    streak,
    todayComplete,
    tasks: todayTasks
  };
}
