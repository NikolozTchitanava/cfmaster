import type { CodeforcesProfile, RatingPoint, Snapshot, SolvedData } from "@/lib/types";
import { buildProblemLink, CODEFORCES_API_BASE, formatRank, makeProblemKey, normalizeHandle, nowIso } from "@/lib/utils";

type ApiEnvelope<T> = {
  status: "OK" | "FAILED";
  comment?: string;
  result: T;
};

type CodeforcesSubmission = {
  verdict?: string;
  contestId?: number;
  creationTimeSeconds?: number;
  problem?: {
    contestId?: number;
    index?: string;
    name?: string;
    rating?: number;
    tags?: string[];
  };
};

type CodeforcesRatingChange = {
  contestName?: string;
  newRating?: number;
  ratingUpdateTimeSeconds?: number;
};

type CodeforcesProblemsetResponse = {
  problems: Array<{
    contestId?: number;
    index?: string;
    name?: string;
    rating?: number;
    tags?: string[];
  }>;
};

export type ProblemCatalogItem = {
  contestId: number;
  index: string;
  key: string;
  link: string;
  name: string;
  rating: number;
  tags: string[];
};

async function codeforcesApi<T>(endpoint: string, params: Record<string, string | number>, revalidateSeconds = 0): Promise<T> {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    search.set(key, String(value));
  }

  const response = await fetch(`${CODEFORCES_API_BASE}/${endpoint}?${search.toString()}`, {
    headers: {
      "User-Agent": "cfmasters-next"
    },
    next: revalidateSeconds > 0 ? { revalidate: revalidateSeconds } : { revalidate: 0 }
  });

  if (!response.ok) {
    throw new Error("Codeforces is unavailable right now.");
  }

  const payload = (await response.json()) as ApiEnvelope<T>;
  if (payload.status !== "OK") {
    throw new Error(payload.comment || "Codeforces request failed.");
  }

  return payload.result;
}

function sortTasksByDifficulty(taskA: SolvedData[string][number], taskB: SolvedData[string][number]): number {
  const firstRating = typeof taskA.rating === "number" ? taskA.rating : -1;
  const secondRating = typeof taskB.rating === "number" ? taskB.rating : -1;

  if (firstRating !== secondRating) {
    return secondRating - firstRating;
  }

  return taskA.name.localeCompare(taskB.name);
}

export async function fetchCodeforcesSnapshot(handle: string): Promise<Snapshot> {
  const normalizedHandle = normalizeHandle(handle);
  const users = await codeforcesApi<Array<Record<string, unknown>>>("user.info", {
    handles: normalizedHandle
  });

  if (!users.length) {
    throw new Error("That Codeforces handle could not be found.");
  }

  const profileResult = users[0];
  const canonicalHandle = typeof profileResult.handle === "string" ? profileResult.handle : normalizedHandle;
  const submissions = await codeforcesApi<CodeforcesSubmission[]>("user.status", {
    handle: canonicalHandle,
    from: 1,
    count: 10000
  });

  let ratingResult: CodeforcesRatingChange[] = [];
  try {
    ratingResult = await codeforcesApi<CodeforcesRatingChange[]>("user.rating", {
      handle: canonicalHandle
    });
  } catch {
    ratingResult = [];
  }

  const grouped = new Map<string, CodeforcesSubmission[]>();
  for (const submission of submissions) {
    const problem = submission.problem;
    if (!problem) {
      continue;
    }

    const key = makeProblemKey(submission.contestId, problem.index, problem.name || "problem");
    const bucket = grouped.get(key) ?? [];
    bucket.push(submission);
    grouped.set(key, bucket);
  }

  const solved: SolvedData = {};
  for (const [problemKey, entries] of grouped.entries()) {
    const accepted = entries.filter((entry) => entry.verdict === "OK" && entry.problem);
    if (!accepted.length) {
      continue;
    }

    const firstAccepted = accepted.reduce((best, current) => {
      const bestTime = best.creationTimeSeconds ?? Number.MAX_SAFE_INTEGER;
      const currentTime = current.creationTimeSeconds ?? Number.MAX_SAFE_INTEGER;
      return currentTime < bestTime ? current : best;
    });

    const solvedAt = firstAccepted.creationTimeSeconds ?? 0;
    const solvedDay = new Date(solvedAt * 1000).toISOString().slice(0, 10);
    const problem = firstAccepted.problem!;
    const contestId = firstAccepted.contestId ?? problem.contestId ?? null;
    const index = problem.index ?? null;

    const task = {
      name: problem.name || "Unknown problem",
      rating: typeof problem.rating === "number" ? problem.rating : null,
      submissions: entries.length,
      link: contestId && index ? buildProblemLink(contestId, index) : "#",
      problemKey,
      contestId,
      index
    };

    const dayTasks = solved[solvedDay] ?? [];
    dayTasks.push(task);
    solved[solvedDay] = dayTasks.sort(sortTasksByDifficulty);
  }

  const profile: CodeforcesProfile = {
    handle: canonicalHandle,
    rating: typeof profileResult.rating === "number" ? profileResult.rating : null,
    maxRating: typeof profileResult.maxRating === "number" ? profileResult.maxRating : null,
    titlePhoto: typeof profileResult.titlePhoto === "string" ? profileResult.titlePhoto : "",
    rank: formatRank(typeof profileResult.rank === "string" ? profileResult.rank : ""),
    maxRank: formatRank(typeof profileResult.maxRank === "string" ? profileResult.maxRank : ""),
    organization: typeof profileResult.organization === "string" ? profileResult.organization : "",
    country: typeof profileResult.country === "string" ? profileResult.country : "",
    friendOfCount: typeof profileResult.friendOfCount === "number" ? profileResult.friendOfCount : null
  };

  const rating: RatingPoint[] = ratingResult
    .filter((entry) => typeof entry.newRating === "number" && typeof entry.ratingUpdateTimeSeconds === "number")
    .map((entry) => ({
      contest: entry.contestName || "Contest",
      newRating: entry.newRating as number,
      time: entry.ratingUpdateTimeSeconds as number
    }))
    .sort((left, right) => left.time - right.time);

  return {
    profile,
    solved,
    rating,
    syncedAt: nowIso()
  };
}

export async function fetchProblemCatalog(): Promise<ProblemCatalogItem[]> {
  const result = await codeforcesApi<CodeforcesProblemsetResponse>("problemset.problems", {}, 60 * 60 * 6);

  return result.problems
    .filter((problem) => {
      return (
        typeof problem.contestId === "number" &&
        typeof problem.index === "string" &&
        typeof problem.name === "string" &&
        typeof problem.rating === "number" &&
        !(problem.tags || []).includes("*special")
      );
    })
    .map((problem) => ({
      contestId: problem.contestId as number,
      index: problem.index as string,
      key: makeProblemKey(problem.contestId, problem.index, problem.name as string),
      link: buildProblemLink(problem.contestId as number, problem.index as string),
      name: problem.name as string,
      rating: problem.rating as number,
      tags: (problem.tags ?? []).filter((tag): tag is string => typeof tag === "string")
    }));
}
