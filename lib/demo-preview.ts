import profileData from "@/profile.json";
import ratingData from "@/rating.json";
import solvedData from "@/solved_data.json";

import type { CodeforcesProfile, RatingPoint, Snapshot, SolvedData } from "@/lib/types";

export async function getHomePreviewSnapshot(): Promise<Snapshot> {
  return {
    profile: profileData as unknown as CodeforcesProfile,
    rating: ratingData as unknown as RatingPoint[],
    solved: solvedData as unknown as SolvedData,
    syncedAt: null
  };
}
