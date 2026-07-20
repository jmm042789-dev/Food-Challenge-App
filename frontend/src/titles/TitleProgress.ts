import { storage } from "../utils/storage";
import { TITLE_BY_ID, TITLE_CATALOG } from "./TitleCatalog";
import type { EquipTitleResult, TitleProgressContext, TitleProgressState, TitleSyncResult, TitleUnlockRequirement } from "./TitleTypes";

const STORAGE_KEY = "fire_feast_title_progress_v1";
let updateQueue: Promise<unknown> = Promise.resolve();

const queueUpdate = <T>(operation: () => Promise<T>): Promise<T> => {
  const result = updateQueue.then(operation, operation);
  updateQueue = result.then(() => undefined, () => undefined);
  return result;
};

export async function loadTitleProgress(): Promise<TitleProgressState> {
  const serialized = await storage.getItem(STORAGE_KEY, "");
  if (!serialized) return { version: 1, unlockedTitles: [], equippedTitleId: null };
  try {
    const stored = JSON.parse(serialized) as Partial<TitleProgressState>;
    const unlockedTitles = (stored.unlockedTitles ?? []).filter((record) => TITLE_BY_ID.has(record.titleId));
    const equippedTitleId = stored.equippedTitleId && unlockedTitles.some((record) => record.titleId === stored.equippedTitleId) ? stored.equippedTitleId : null;
    return { version: 1, unlockedTitles, equippedTitleId };
  } catch {
    return { version: 1, unlockedTitles: [], equippedTitleId: null };
  }
}

function requirementMet(requirement: TitleUnlockRequirement, context: TitleProgressContext): boolean {
  switch (requirement.type) {
    case "MATCHES_PLAYED": return context.matchesPlayed >= requirement.value;
    case "WINS": return context.wins >= requirement.value;
    case "BELT_RANK": return context.beltRank >= requirement.value;
    case "ACHIEVEMENT": return context.completedAchievementIds.includes(requirement.achievementId);
    case "ACHIEVEMENTS_COMPLETED": return context.completedAchievementIds.length >= requirement.value;
    case "RESTAURANTS_UNLOCKED": return context.unlockedRestaurantIds.length >= requirement.value;
    case "FOOD_MECHANIC_MASTERY": return context.completedAchievementIds.includes(requirement.achievementId);
    case "SEASON_REWARD": return context.claimedSeasonRewardIds?.includes(requirement.rewardId) ?? false;
    case "TOURNAMENT_REWARD": return context.claimedTournamentRewardIds?.includes(requirement.rewardId) ?? false;
  }
}

export async function syncTitleUnlocks(context: TitleProgressContext): Promise<TitleSyncResult> {
  return queueUpdate(async () => {
    const state = await loadTitleProgress();
    const unlockedIds = new Set(state.unlockedTitles.map((record) => record.titleId));
    const now = new Date().toISOString();
    const unlockedTitles = [...state.unlockedTitles];
    const newlyUnlocked: TitleSyncResult["newlyUnlocked"] = [];
    TITLE_CATALOG.forEach((title) => {
      if (unlockedIds.has(title.id) || !requirementMet(title.unlockRequirement, context)) return;
      unlockedIds.add(title.id);
      unlockedTitles.push({ titleId: title.id, dateUnlocked: now, newlyUnlocked: true });
      newlyUnlocked.push({ titleId: title.id, titleName: title.displayName, rarity: title.rarity, colorTheme: title.colorTheme });
    });
    const equippedTitleId = state.equippedTitleId ?? (unlockedIds.has("title_rookie_eater") ? "title_rookie_eater" : null);
    const nextState = { ...state, unlockedTitles, equippedTitleId };
    if (newlyUnlocked.length || equippedTitleId !== state.equippedTitleId) await storage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    return { state: nextState, newlyUnlocked };
  });
}

export async function acknowledgeTitleUnlocks(titleIds: readonly string[]): Promise<TitleProgressState> {
  return queueUpdate(async () => {
    const state = await loadTitleProgress();
    const ids = new Set(titleIds);
    const nextState = { ...state, unlockedTitles: state.unlockedTitles.map((record) => ids.has(record.titleId) ? { ...record, newlyUnlocked: false } : record) };
    await storage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    return nextState;
  });
}

export async function equipTitle(titleId: string): Promise<EquipTitleResult> {
  return queueUpdate(async () => {
    const state = await loadTitleProgress();
    if (!TITLE_BY_ID.has(titleId)) return { ok: false, state, error: "TITLE_NOT_FOUND" } as const;
    if (!state.unlockedTitles.some((record) => record.titleId === titleId)) return { ok: false, state, error: "TITLE_LOCKED" } as const;
    const nextState = { ...state, equippedTitleId: titleId };
    if (!await storage.setItem(STORAGE_KEY, JSON.stringify(nextState))) return { ok: false, state, error: "PERSISTENCE_FAILED" } as const;
    return { ok: true, state: nextState } as const;
  });
}
