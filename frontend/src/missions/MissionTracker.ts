import { storage } from "../utils/storage";
import { generateDailyMissions, getLocalDateKey } from "./MissionGenerator";
import type { DailyMission, DailyMissionState, MissionClaimResult, MissionEvent } from "./MissionTypes";
import { trackAchievementEvent } from "../achievements/AchievementTracker";

const STORAGE_KEY = "fire_feast_daily_missions_v1";
const claimsInFlight = new Set<string>();

const createDailyState = (
  dateKey: string,
  claimedRewards: DailyMissionState["claimedRewards"] = { coins: 0, xp: 0 },
): DailyMissionState => ({
  lastGeneratedDate: dateKey,
  missions: generateDailyMissions(dateKey),
  claimedRewards,
});

const saveState = async (state: DailyMissionState): Promise<void> => {
  await storage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export async function loadDailyMissions(date = new Date()): Promise<DailyMissionState> {
  const dateKey = getLocalDateKey(date);
  const serialized = await storage.getItem(STORAGE_KEY, "");
  let carriedRewards: DailyMissionState["claimedRewards"] = { coins: 0, xp: 0 };
  if (serialized) {
    try {
      const stored = JSON.parse(serialized) as DailyMissionState;
      if (stored.lastGeneratedDate === dateKey && stored.missions?.length === 3) return stored;
      carriedRewards = stored.claimedRewards ?? carriedRewards;
    } catch {
      // Invalid or old mission data is safely replaced below.
    }
  }
  const state = createDailyState(dateKey, carriedRewards);
  await saveState(state);
  return state;
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

export async function trackMissionEvent(event: MissionEvent): Promise<DailyMissionState> {
  const state = await loadDailyMissions();
  const missions = state.missions.map((mission) => {
    if (mission.completed) return mission;
    const currentProgress = Math.min(mission.goal, mission.currentProgress + progressForEvent(mission, event));
    return { ...mission, currentProgress, completed: currentProgress >= mission.goal };
  });
  const nextState = { ...state, missions };
  await saveState(nextState);
  const completedNow = missions.filter((mission) => mission.completed && !state.missions.find((old) => old.id === mission.id)?.completed).length;
  if (completedNow > 0) await trackAchievementEvent({ type: "DAILY_MISSION_COMPLETED", amount: completedNow });
  return nextState;
}

export async function claimMission(missionId: string): Promise<MissionClaimResult> {
  if (claimsInFlight.has(missionId)) {
    return { state: await loadDailyMissions(), reward: null };
  }
  claimsInFlight.add(missionId);
  try {
  const state = await loadDailyMissions();
  const mission = state.missions.find((item) => item.id === missionId);
  if (!mission || !mission.completed || mission.claimed) return { state, reward: null };
  const missions = state.missions.map((item) => item.id === missionId ? { ...item, claimed: true } : item);
  const nextState: DailyMissionState = {
    ...state,
    missions,
    claimedRewards: {
      coins: state.claimedRewards.coins + mission.reward.coins,
      xp: state.claimedRewards.xp + mission.reward.xp,
    },
  };
  await saveState(nextState);
  return { state: nextState, reward: mission.reward };
  } finally {
    claimsInFlight.delete(missionId);
  }
}
