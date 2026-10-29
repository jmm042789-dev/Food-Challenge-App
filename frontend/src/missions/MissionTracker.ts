import { storage } from "../utils/storage";
import { generateDailyMissions, getLocalDateKey } from "./MissionGenerator";
import type { DailyMission, DailyMissionState, MissionClaimResult, MissionEvent } from "./MissionTypes";
import { trackAchievementEvent } from "../achievements/AchievementTracker";

const STORAGE_KEY = "fire_feast_daily_missions_v1";
const claimsInFlight = new Set<string>();
let updateQueue: Promise<unknown> = Promise.resolve();
const queueUpdate = <T>(operation: () => Promise<T>): Promise<T> => {
  const result = updateQueue.then(operation, operation);
  updateQueue = result.then(() => undefined, () => undefined);
  return result;
};

const createDailyState = (
  dateKey: string,
  claimedRewards: DailyMissionState["claimedRewards"] = { coins: 0, xp: 0 },
): DailyMissionState => ({
  lastGeneratedDate: dateKey,
  missions: generateDailyMissions(dateKey),
  claimedRewards,
});

const saveState = async (state: DailyMissionState): Promise<boolean> => {
  try { return await storage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch { return false; }
};

// Internal read never queues or writes. Public mutations own the queue.
async function readState(date: Date) {
  const dateKey = getLocalDateKey(date);
  const serialized = await storage.getItem(STORAGE_KEY, "");
  let previous: DailyMissionState | null = null;
  if (serialized) {
    try { previous = JSON.parse(serialized) as DailyMissionState; } catch { /* Existing fallback policy. */ }
  }
  if (previous?.lastGeneratedDate === dateKey && previous.missions?.length === 3) return { state: previous, previous, rollover: false };
  return { state: createDailyState(dateKey, previous?.claimedRewards), previous, rollover: true };
}

export function loadDailyMissions(date = new Date()): Promise<DailyMissionState> {
  return queueUpdate(async () => {
    const { state, previous, rollover } = await readState(date);
    if (rollover && !await saveState(state)) {
      if (previous) return previous;
      throw new Error("Mission persistence failed");
    }
    return state;
  });
}

function progressForEvent(mission: DailyMission, event: MissionEvent): number {
  switch (mission.category) {
    case "PLAY_MATCHES": return 1;
    case "WIN_MATCHES": return event.won ? 1 : 0;
    case "EARN_COINS": return Math.max(0, event.coinsEarned);
    case "EARN_XP": return Math.max(0, event.xpEarned);
    case "BUILD_COMBOS": return Math.max(0, event.highestCombo - mission.currentProgress);
    case "COMPLETE_FOOD_MECHANICS": return event.completedFoodMechanic ? 1 : 0;
    case "PLAY_SPECIFIC_FOOD": return event.foodId === mission.targetId ? 1 : 0;
    case "DEFEAT_SPECIFIC_OPPONENT": return event.won && event.opponentId === mission.targetId ? 1 : 0;
  }
}

export function trackMissionEvent(event: MissionEvent): Promise<DailyMissionState> {
  return queueUpdate(async () => {
  const { state, previous } = await readState(new Date());
  const missions = state.missions.map((mission) => {
    if (mission.completed) return mission;
    const currentProgress = Math.min(mission.goal, mission.currentProgress + progressForEvent(mission, event));
    return { ...mission, currentProgress, completed: currentProgress >= mission.goal };
  });
  const nextState = { ...state, missions };
  if (!await saveState(nextState)) {
    if (previous) return previous;
    throw new Error("Mission persistence failed");
  }
  const completedNow = missions.filter((mission) => mission.completed && !state.missions.find((old) => old.id === mission.id)?.completed).length;
  if (completedNow > 0) await trackAchievementEvent({ type: "DAILY_MISSION_COMPLETED", amount: completedNow });
  return nextState;
  });
}

export async function claimMission(missionId: string): Promise<MissionClaimResult> {
  if (claimsInFlight.has(missionId)) {
    return queueUpdate(async () => ({ ok: false, state: (await readState(new Date())).state, error: "CLAIM_IN_PROGRESS" }));
  }
  claimsInFlight.add(missionId);
  try {
    return await queueUpdate(async () => {
      const { state, previous } = await readState(new Date());
      const mission = state.missions.find((item) => item.id === missionId);
      if (!mission) return { ok: false, state: previous ?? state, error: "NOT_FOUND" };
      if (!mission.completed) return { ok: false, state, error: "NOT_COMPLETED" };
      if (mission.claimed) return { ok: false, state, error: "ALREADY_CLAIMED" };
      const nextState: DailyMissionState = {
        ...state,
        missions: state.missions.map((item) => item.id === missionId ? { ...item, claimed: true } : item),
        claimedRewards: { coins: state.claimedRewards.coins + mission.reward.coins, xp: state.claimedRewards.xp + mission.reward.xp },
      };
      if (!await saveState(nextState)) return { ok: false, state: previous ?? state, error: "PERSISTENCE_FAILED" };
      return { ok: true, state: nextState, reward: mission.reward };
    });
  } finally { claimsInFlight.delete(missionId); }
}
