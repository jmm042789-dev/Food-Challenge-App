import { storage } from "../utils/storage";
import { RESTAURANT_BY_ID, RESTAURANT_CATALOG } from "./RestaurantCatalog";
import type { RestaurantProgressContext, RestaurantProgressRecord, RestaurantProgressState, RestaurantUnlockRequirement, RestaurantUnlockResult } from "./RestaurantTypes";

const STORAGE_KEY = "fire_feast_restaurant_progress_v1";
let updateQueue: Promise<unknown> = Promise.resolve();

const queueUpdate = <T>(operation: () => Promise<T>): Promise<T> => {
  const result = updateQueue.then(operation, operation);
  updateQueue = result.then(() => undefined, () => undefined);
  return result;
};

const freshRecord = (restaurantId: string): RestaurantProgressRecord => ({ restaurantId, status: "locked", newlyUnlocked: false, dateUnlocked: null });

export async function loadRestaurantProgress(): Promise<RestaurantProgressState> {
  const serialized = await storage.getItem(STORAGE_KEY, "");
  let storedRecords: RestaurantProgressRecord[] = [];
  if (serialized) {
    try { storedRecords = (JSON.parse(serialized) as Partial<RestaurantProgressState>).restaurants ?? []; } catch { storedRecords = []; }
  }
  const storedById = new Map(storedRecords.map((record) => [record.restaurantId, record]));
  return { version: 1, restaurants: RESTAURANT_CATALOG.map(({ id }) => ({ ...freshRecord(id), ...storedById.get(id), restaurantId: id })) };
}

function requirementMet(requirement: RestaurantUnlockRequirement, context: RestaurantProgressContext): boolean {
  switch (requirement.type) {
    case "XP": return Math.max(0, context.xp) >= requirement.value;
    case "BELT_RANK": return (context.beltRank ?? 0) >= requirement.value;
    case "MATCHES_WON": return (context.matchesWon ?? 0) >= requirement.value;
    case "ACHIEVEMENT": return context.completedAchievementIds?.includes(requirement.achievementId) ?? false;
    case "EVENT": return context.eventIds?.includes(requirement.eventId) ?? false;
    case "SPONSOR": return context.sponsorIds?.includes(requirement.sponsorId) ?? false;
  }
}

export async function syncRestaurantUnlocks(context: RestaurantProgressContext): Promise<RestaurantUnlockResult> {
  return queueUpdate(async () => {
    const state = await loadRestaurantProgress();
    const now = new Date().toISOString();
    const newlyUnlocked: RestaurantUnlockResult["newlyUnlocked"] = [];
    const restaurants = state.restaurants.map((record) => {
      const definition = RESTAURANT_BY_ID.get(record.restaurantId);
      if (!definition || record.status === "unlocked" || !requirementMet(definition.unlockRequirement, context)) return record;
      newlyUnlocked.push({ restaurantId: definition.id, restaurantName: definition.displayName, theme: definition.theme });
      return { ...record, status: "unlocked" as const, newlyUnlocked: true, dateUnlocked: now };
    });
    const nextState = { ...state, restaurants };
    if (newlyUnlocked.length) await storage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    return { state: nextState, newlyUnlocked };
  });
}

export async function acknowledgeRestaurantUnlocks(restaurantIds: readonly string[]): Promise<RestaurantProgressState> {
  return queueUpdate(async () => {
    const state = await loadRestaurantProgress();
    const ids = new Set(restaurantIds);
    const nextState = { ...state, restaurants: state.restaurants.map((record) => ids.has(record.restaurantId) ? { ...record, newlyUnlocked: false } : record) };
    await storage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    return nextState;
  });
}
