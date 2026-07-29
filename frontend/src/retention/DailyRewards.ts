import { storage } from "../utils/storage";

const STORAGE_KEY = "fire_feast_daily_rewards_v1";
const DAY_MS = 86_400_000;

export const DAILY_REWARDS = [
  { day: 1, label: "50 COINS", icon: "C" },
  { day: 2, label: "75 XP", icon: "XP" },
  { day: 3, label: "1 ANTACID", icon: "+" },
  { day: 4, label: "100 COINS", icon: "C" },
  { day: 5, label: "125 XP", icon: "XP" },
  { day: 6, label: "2 ANTACID", icon: "+" },
  { day: 7, label: "BETA CHEST", icon: "★" },
] as const;

export type DailyRewardState = {
  version: 1;
  cycleStart: string;
  claimedDays: number[];
};

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dayNumber(start: string, now = new Date()) {
  const [year, month, day] = start.split("-").map(Number);
  const startUtc = Date.UTC(year, month - 1, day);
  const nowUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((nowUtc - startUtc) / DAY_MS) + 1;
}

export async function loadDailyRewards(now = new Date()): Promise<{ state: DailyRewardState; currentDay: number }> {
  const serialized = await storage.getItem(STORAGE_KEY, "");
  let state: DailyRewardState = { version: 1, cycleStart: localDateKey(now), claimedDays: [] };
  if (serialized) {
    try {
      const stored = JSON.parse(serialized) as DailyRewardState;
      if (stored.version === 1 && stored.cycleStart && Array.isArray(stored.claimedDays)) state = stored;
    } catch {
      // Invalid beta data starts a fresh local cycle.
    }
  }
  let currentDay = dayNumber(state.cycleStart, now);
  if (currentDay < 1 || currentDay > 7) {
    state = { version: 1, cycleStart: localDateKey(now), claimedDays: [] };
    currentDay = 1;
    await storage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
  return { state, currentDay };
}

export async function claimDailyReward(now = new Date()) {
  const loaded = await loadDailyRewards(now);
  if (loaded.state.claimedDays.includes(loaded.currentDay)) return { ...loaded, claimed: false };
  const state = { ...loaded.state, claimedDays: [...loaded.state.claimedDays, loaded.currentDay] };
  await storage.setItem(STORAGE_KEY, JSON.stringify(state));
  return { state, currentDay: loaded.currentDay, claimed: true };
}
