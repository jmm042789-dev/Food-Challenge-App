export type DailyRewardSlice = {
  id: string;
  label: string;
  kind: "coins" | "xp" | "antacid";
  amount: number;
};

export type DailySpinStatus = {
  eligible: boolean;
  server_time: string;
  next_daily_spin: string;
  daily_spin_streak: number;
  total_daily_spins: number;
  free_spins_available: number;
  bonus_spins_available: number;
  reward_slices: DailyRewardSlice[];
};

export type DailySpinClaim = {
  reward: DailyRewardSlice;
  reward_index: number;
  player: { coins?: number; xp?: number; antacid?: number };
  server_time: string;
  next_daily_spin: string;
  daily_spin_streak: number;
  free_spins_available: number;
  bonus_spins_available: number;
};

export function landingRotation(rewardIndex: number, sliceCount: number, turns: number) {
  if (sliceCount < 1 || rewardIndex < 0 || rewardIndex >= sliceCount) return 0;
  const sliceAngle = 360 / sliceCount;
  return turns * 360 + (360 - (rewardIndex + 0.5) * sliceAngle);
}

export function serverCountdownMs(
  serverTime: string,
  nextSpin: string,
  elapsedSinceResponseMs: number,
) {
  const initial = Date.parse(nextSpin) - Date.parse(serverTime);
  if (!Number.isFinite(initial)) return 0;
  return Math.max(0, initial - Math.max(0, elapsedSinceResponseMs));
}

export function formatCountdown(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return [hours, minutes, remainder].map((value) => String(value).padStart(2, "0")).join(":");
}
