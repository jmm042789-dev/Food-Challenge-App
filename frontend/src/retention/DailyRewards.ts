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

export function responsiveWheelSize(viewportWidth: number, viewportHeight: number) {
  const widthAllowance = Math.max(0, viewportWidth - 40);
  const heightAllowance = Math.max(0, viewportHeight * 0.46);
  return Math.max(160, Math.min(360, widthAllowance, heightAllowance));
}

export function normalizeClockwiseDegrees(degrees: number) {
  return ((degrees % 360) + 360) % 360;
}

/**
 * Slice zero is centered at 12 o'clock and slice centers increase clockwise.
 * The fixed pointer is also at 12 o'clock, so the wheel rotates clockwise by
 * the normalized inverse of the selected slice's center angle.
 */
export function landingRotationForReward(
  rewardId: string,
  slices: readonly Pick<DailyRewardSlice, "id">[],
  turns: number,
) {
  const rewardIndex = slices.findIndex((slice) => slice.id === rewardId);
  if (rewardIndex < 0 || slices.length < 1) return null;
  const sliceAngle = 360 / slices.length;
  const landingAngle = normalizeClockwiseDegrees(-rewardIndex * sliceAngle);
  return Math.max(0, Math.floor(turns)) * 360 + landingAngle;
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
