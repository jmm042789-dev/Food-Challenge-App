import { ACHIEVEMENT_BY_ID, ACHIEVEMENT_CATALOG } from "./AchievementCatalog";
import { loadAchievementState, saveAchievementState } from "./AchievementStorage";
import type {
  AchievementDefinition,
  AchievementEvent,
  AchievementEventResult,
  AchievementMetric,
  AchievementMigrationSnapshot,
  AchievementProgress,
  AchievementState,
  ClaimAchievementResult,
  FoodMechanicType,
} from "./AchievementTypes";

const claimsInFlight = new Set<string>();
let updateQueue: Promise<unknown> = Promise.resolve();

const queueUpdate = <T>(operation: () => Promise<T>): Promise<T> => {
  const result = updateQueue.then(operation, operation);
  updateQueue = result.then(() => undefined, () => undefined);
  return result;
};

const mechanicMetric: Record<FoodMechanicType, AchievementMetric> = {
  cheese_pull: "PIZZA_CHEESE_PULLS_COMPLETED",
  shell_stability: "TACO_STABILITY_CHALLENGES_COMPLETED",
  noodle_slurp: "RAMEN_SLURPS_COMPLETED",
  heavy_bite: "BURGER_HEAVY_BITES_COMPLETED",
  speed_sprint: "HOT_DOG_SPRINTS_COMPLETED",
  heat_rush: "WINGS_HEAT_RUSHES_TRIGGERED",
};

function eventValue(definition: AchievementDefinition, event: AchievementEvent): number | null {
  if (event.type === "MATCH_COMPLETED") {
    switch (definition.metric) {
      case "MATCHES_PLAYED": return 1;
      case "MATCHES_WON": return event.won ? 1 : 0;
      case "TOTAL_SCORE": return event.score;
      case "BEST_SCORE": return event.score;
      case "HIGHEST_COMBO": return event.highestCombo;
      case "TOTAL_COMBO_TAPS": return event.highestCombo;
      case "COINS_EARNED": return event.coinsEarned ?? 0;
      case "XP_EARNED": return event.xpEarned ?? 0;
      case "SPECIFIC_FOOD_MATCHES_PLAYED": return definition.targetId === event.foodId ? 1 : 0;
      case "SPECIFIC_OPPONENTS_DEFEATED": return event.won && definition.targetId === event.opponentId ? 1 : 0;
      default: return null;
    }
  }
  if (event.type === "FOOD_MECHANIC_COMPLETED") {
    if (definition.metric === "FOOD_MECHANICS_COMPLETED") return 1;
    return definition.metric === mechanicMetric[event.mechanicType] ? 1 : null;
  }
  if (event.type === "DAILY_MISSION_COMPLETED") {
    return definition.metric === "DAILY_MISSIONS_COMPLETED" ? Math.max(0, event.amount ?? 1) : null;
  }
  if (event.type === "ITEM_ACQUIRED") {
    return definition.metric === "ITEMS_OWNED" ? event.ownedItemCount : null;
  }
  return definition.metric === "BELT_RANK_REACHED" ? event.rank : null;
}

function applyValue(progress: AchievementProgress, definition: AchievementDefinition, value: number, now: string) {
  const safeValue = Math.max(0, Number.isFinite(value) ? value : 0);
  const currentProgress = definition.progressMode === "HIGHEST_VALUE"
    ? Math.max(progress.currentProgress, safeValue)
    : progress.currentProgress + safeValue;
  const completed = progress.completed || currentProgress >= definition.goal;
  return {
    progress: {
      ...progress,
      currentProgress,
      completed,
      completedAt: !progress.completed && completed ? now : progress.completedAt,
    },
    newlyCompleted: !progress.completed && completed,
  };
}

export function getSortedAchievements(state: AchievementState) {
  const progressById = new Map(state.progress.map((item) => [item.achievementId, item]));
  return ACHIEVEMENT_CATALOG.map((definition, index) => ({ definition, progress: progressById.get(definition.id)!, index }))
    .sort((left, right) => {
      const bucket = (item: typeof left) => item.progress.completed && !item.progress.claimed ? 0 : item.progress.claimed ? 3 : 1;
      const bucketDifference = bucket(left) - bucket(right);
      if (bucketDifference) return bucketDifference;
      if (!left.progress.completed && !right.progress.completed) {
        const leftRatio = left.progress.currentProgress / left.progress.goal;
        const rightRatio = right.progress.currentProgress / right.progress.goal;
        if (rightRatio !== leftRatio) return rightRatio - leftRatio;
      }
      return left.index - right.index;
    });
}

export async function trackAchievementEvent(event: AchievementEvent): Promise<AchievementEventResult> {
  return queueUpdate(async () => {
    const state = await loadAchievementState();
    if (event.type === "MATCH_COMPLETED" && state.processedEventIds.includes(event.eventId)) {
      return { state, newlyCompleted: [] };
    }
    const now = new Date().toISOString();
    const newlyCompleted: AchievementEventResult["newlyCompleted"] = [];
    const progress = state.progress.map((item) => {
      const definition = ACHIEVEMENT_BY_ID.get(item.achievementId);
      if (!definition) return item;
      const value = eventValue(definition, event);
      if (value === null) return item;
      const update = applyValue(item, definition, value, now);
      if (update.newlyCompleted) newlyCompleted.push({ achievementId: definition.id, title: definition.title, reward: definition.reward });
      return update.progress;
    });
    const nextState: AchievementState = {
      ...state,
      progress,
      processedEventIds: event.type === "MATCH_COMPLETED"
        ? [...state.processedEventIds, event.eventId].slice(-100)
        : state.processedEventIds,
    };
    await saveAchievementState(nextState);
    return { state: nextState, newlyCompleted };
  });
}

export async function migrateAchievementProgress(snapshot: AchievementMigrationSnapshot): Promise<AchievementState> {
  return queueUpdate(async () => {
    const state = await loadAchievementState();
    const values: Partial<Record<AchievementMetric, number>> = {
      MATCHES_PLAYED: snapshot.matches,
      MATCHES_WON: snapshot.wins,
      BEST_SCORE: snapshot.bestScore,
      HIGHEST_COMBO: snapshot.highestCombo,
      XP_EARNED: snapshot.xp,
      ITEMS_OWNED: snapshot.itemsOwned,
      BELT_RANK_REACHED: snapshot.beltRank,
    };
    const now = new Date().toISOString();
    const progress = state.progress.map((item) => {
      const definition = ACHIEVEMENT_BY_ID.get(item.achievementId);
      const value = definition ? values[definition.metric] : undefined;
      if (!definition || value === undefined) return item;
      const migratedDefinition = { ...definition, progressMode: "HIGHEST_VALUE" as const };
      return applyValue(item, migratedDefinition, value, now).progress;
    });
    const nextState = { ...state, progress };
    await saveAchievementState(nextState);
    return nextState;
  });
}

export async function claimAchievement(achievementId: string): Promise<ClaimAchievementResult> {
  if (claimsInFlight.has(achievementId)) {
    return { ok: false, state: await loadAchievementState(), error: "CLAIM_IN_PROGRESS" };
  }
  claimsInFlight.add(achievementId);
  try {
    return await queueUpdate(async () => {
      const state = await loadAchievementState();
      const definition = ACHIEVEMENT_BY_ID.get(achievementId);
      const progress = state.progress.find((item) => item.achievementId === achievementId);
      if (!definition || !progress) return { ok: false, state, error: "NOT_FOUND" } as const;
      if (!progress.completed) return { ok: false, state, error: "NOT_COMPLETED" } as const;
      if (progress.claimed) return { ok: false, state, error: "ALREADY_CLAIMED" } as const;
      const claimedAt = new Date().toISOString();
      const nextState: AchievementState = {
        ...state,
        progress: state.progress.map((item) => item.achievementId === achievementId ? { ...item, claimed: true, claimedAt } : item),
        claimedRewards: {
          coins: state.claimedRewards.coins + definition.reward.coins,
          xp: state.claimedRewards.xp + definition.reward.xp,
        },
      };
      if (!await saveAchievementState(nextState)) return { ok: false, state, error: "PERSISTENCE_FAILED" } as const;
      return { ok: true, state: nextState, reward: definition.reward } as const;
    });
  } finally {
    claimsInFlight.delete(achievementId);
  }
}
