import { readFile } from "node:fs/promises";
import path from "node:path";

import type { CodeforcesProfile, RatingPoint, Snapshot, SolvedData } from "@/lib/types";

async function readJsonFile<T>(filename: string, fallback: T): Promise<T> {
  try {
    const filePath = path.join(process.cwd(), filename);
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function getHomePreviewSnapshot(): Promise<Snapshot> {
  const [profile, rating, solved] = await Promise.all([
    readJsonFile<CodeforcesProfile>("profile.json", { handle: "cfmasters" }),
    readJsonFile<RatingPoint[]>("rating.json", []),
    readJsonFile<SolvedData>("solved_data.json", {})
  ]);

  return {
    profile,
    rating,
    solved,
    syncedAt: null
  };
}
