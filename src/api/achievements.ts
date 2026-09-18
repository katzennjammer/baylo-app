import { apiV1, request } from "./client";

export type Achievement = {
  id: string;
  key: string;
  name: string;
  description: string;
  icon: string;
  criterion: string;
  threshold: number;
  progress: number;
  unlocked: boolean;
  unlockedAt: string | null;
  displayOrder: number | null;
  homeDisplayOrder: number | null;
};

export async function fetchAchievements(): Promise<{ achievements: Achievement[] }> {
  const { data } = await apiV1<{ achievements: Achievement[] }>("/api/v1/achievements");
  return data;
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
