import { apiV1, request } from "./client";

export type Achievement = {
  id: string;
  key: string;
  name: string;
  description: string;
  icon: string;
  /** Uploaded badge art. Null means render `icon` (the emoji fallback). */
  imageUrl: string | null;
  criterion: string;
  threshold: number;
  progress: number;
  unlocked: boolean;
  unlockedAt: string | null;
  displayOrder: number | null;
  homeDisplayOrder: number | null;
};

/**
 * The server is the source of truth for the shelf size. It is returned with the
 * list rather than hard-coded here, so raising it in the backend does not need
 * a client release.
 */
export const DEFAULT_MAX_PROFILE_BADGES = 4;

export async function fetchAchievements(): Promise<{
  achievements: Achievement[];
  maxProfileBadges: number;
}> {
  const { data } = await apiV1<{ achievements: Achievement[]; maxProfileBadges?: number }>(
    "/api/v1/achievements",
  );
  return {
    achievements: data.achievements,
    maxProfileBadges: data.maxProfileBadges ?? DEFAULT_MAX_PROFILE_BADGES,
  };
}

export async function updateDisplayedAchievements({
  achievementIds,
  featuredAchievementId,
}: {
  achievementIds: string[];
  featuredAchievementId: string | null;
}): Promise<void> {
  const response = await request("/api/v1/achievements/display", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ achievementIds, featuredAchievementId }),
  });
  if (!response.ok) throw new Error("Could not update displayed badges");
}
