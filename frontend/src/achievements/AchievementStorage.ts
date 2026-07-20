import { storage } from "../utils/storage";
import { ACHIEVEMENT_CATALOG } from "./AchievementCatalog";
import type { AchievementProgress, AchievementState } from "./AchievementTypes";

const STORAGE_KEY = "fire_feast_achievements_v1";

const initialProgress = (): AchievementProgress[] => ACHIEVEMENT_CATALOG.map((definition) => ({
  achievementId: definition.id,
  currentProgress: 0,
  goal: definition.goal,
  completed: false,
  completedAt: null,
  claimed: false,
  claimedAt: null,
}));

export function createAchievementState(): AchievementState {
  return { version: 1, progress: initialProgress(), claimedRewards: { coins: 0, xp: 0 }, processedEventIds: [] };
}

export async function loadAchievementState(): Promise<AchievementState> {
  const serialized = await storage.getItem(STORAGE_KEY, "");
  if (!serialized) return createAchievementState();
  try {
    const stored = JSON.parse(serialized) as Partial<AchievementState>;
    const storedById = new Map((stored.progress ?? []).map((item) => [item.achievementId, item]));
    return {
      version: 1,
      progress: initialProgress().map((fresh) => ({ ...fresh, ...storedById.get(fresh.achievementId), goal: fresh.goal })),
      claimedRewards: stored.claimedRewards ?? { coins: 0, xp: 0 },
      processedEventIds: (stored.processedEventIds ?? []).slice(-100),
    };
  } catch {
    return createAchievementState();
  }
}

export async function saveAchievementState(state: AchievementState): Promise<boolean> {
  return storage.setItem(STORAGE_KEY, JSON.stringify(state));
}
