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

export function wheelStageSize(usableWidth: number) {
  return Math.min(420, Math.max(240, usableWidth - 28));
}

export function rewardPosition(index: number, sliceCount: number, stageSize: number) {
  const wedgeAngle = ((index + 0.5) / sliceCount) * Math.PI * 2 - Math.PI / 2;
  const radius = stageSize * 0.31;
  return {
    left: stageSize / 2 + Math.cos(wedgeAngle) * radius,
    top: stageSize / 2 + Math.sin(wedgeAngle) * radius,
    angle: wedgeAngle * 180 / Math.PI + 90,
  };
}

export type ImageContentGeometry = {
  canvasWidth: number;
  canvasHeight: number;
  bounds: { x: number; y: number; width: number; height: number };
};

export function centerImageContentInSquare(geometry: ImageContentGeometry, squareSize: number) {
  const scale = squareSize / Math.max(geometry.bounds.width, geometry.bounds.height);
  const width = geometry.canvasWidth * scale;
  const height = geometry.canvasHeight * scale;
  const contentCenterX = (geometry.bounds.x + geometry.bounds.width / 2) * scale;
  const contentCenterY = (geometry.bounds.y + geometry.bounds.height / 2) * scale;
  return {
    height,
    left: squareSize / 2 - contentCenterX,
    scale,
    top: squareSize / 2 - contentCenterY,
    width,
  };
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
