import type { Focus } from "@/lib/types";

export const SESSION_COOKIE_NAME = "cfmasters_session";
export const SESSION_TTL_DAYS = 30;
export const CODEFORCES_API_BASE = "https://codeforces.com/api";

export const FOCUS_LABELS: Record<Focus, string> = {
  warmup: "Warmup",
  steady: "Steady",
  stretch: "Stretch"
};

export const FOCUS_HINTS: Record<Focus, string> = {
  warmup: "Lower-pressure problems to keep streaks alive.",
  steady: "Balanced daily work close to your current level.",
  stretch: "Harder daily tasks to push rating growth."
};

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeHandle(value: string): string {
  return value.trim();
}

export function handleKey(value: string): string {
  return normalizeHandle(value).toLowerCase();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function parseDay(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const day = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(day.getTime()) ? null : day;
}

export function dayKey(day: Date): string {
  return day.toISOString().slice(0, 10);
}

export function todayKey(): string {
  return dayKey(new Date());
}

export function previousDay(value: string): string {
  const parsed = parseDay(value);
  if (!parsed) {
    return value;
  }

  parsed.setUTCDate(parsed.getUTCDate() - 1);
  return dayKey(parsed);
}

export function formatDayLabel(value: string | Date | null | undefined): string {
  if (!value) {
    return "No activity yet";
  }

  const day = typeof value === "string" ? parseDay(value) : value;
  if (!day) {
    return "No activity yet";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(day);
}

export function formatSyncLabel(value: string | null | undefined): string {
  if (!value) {
    return "Never synced";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Never synced";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

export function formatRating(value: number | null | undefined): string {
  return typeof value === "number" ? String(value) : "Unrated";
}

export function formatRank(value: string | null | undefined): string {
  if (!value) {
    return "Unrated";
  }

  return value.replaceAll("_", " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

export function formatDayCount(value: number): string {
  return `${value} day${value === 1 ? "" : "s"}`;
}

export function buildProblemLink(contestId: number, index: string): string {
  const contestType = contestId >= 100000 ? "gym" : "contest";
  return `https://codeforces.com/${contestType}/${contestId}/problem/${index}`;
}

export function buildProfileUrl(handle: string): string {
  return `https://codeforces.com/profile/${encodeURIComponent(handle)}`;
}

export function makeProblemKey(contestId: number | null | undefined, index: string | null | undefined, fallback = "problem"): string {
  if (contestId && index) {
    return `${contestId}-${index}`;
  }

  return fallback;
}

export function clampProblemRating(value: number): number {
  const rounded = Math.round(value / 100) * 100;
  return Math.max(800, Math.min(3500, rounded));
}

export function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function coerceText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function coerceNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function coerceJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }

  return value as T;
}

export function getSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export function withMessage(pathname: string, type: "success" | "error", message: string, hash?: string): string {
  const url = new URL(pathname, "https://cfmasters.local");
  url.searchParams.set("type", type);
  url.searchParams.set("message", message);

  return `${url.pathname}${url.search}${hash ? `#${hash}` : ""}`;
}
