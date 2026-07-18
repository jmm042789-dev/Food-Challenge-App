export type HeatTier = "COOL" | "WARM" | "HOT" | "CRITICAL" | "OVERHEATED";

import { COMPLETED_FOOD_BONUS_HEAT, DEFAULT_HEARTBURN, HEAT_MULTIPLIERS, OVERHEAT_TIME, RECOVERY_HEAT } from "./balance";

export const DEFAULT_HEARTBURN_PER_BITE = DEFAULT_HEARTBURN;
export const COMPLETED_FOOD_HEARTBURN_BONUS = COMPLETED_FOOD_BONUS_HEAT;
export const OVERHEAT_DURATION_MS = OVERHEAT_TIME;
export const OVERHEAT_RECOVERY_HEARTBURN = RECOVERY_HEAT;

export function clampHeartburn(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function getHeatTier(heartburn: number): HeatTier {
  const heat = clampHeartburn(heartburn);
  if (heat >= 100) return "OVERHEATED";
  if (heat >= 75) return "CRITICAL";
  if (heat >= 50) return "HOT";
  if (heat >= 25) return "WARM";
  return "COOL";
}

export function getHeatMultiplier(tier: HeatTier): number {
  return HEAT_MULTIPLIERS[tier];
}

export function addHeartburnValue(current: number, amount = DEFAULT_HEARTBURN_PER_BITE): number {
  return clampHeartburn(current + (Number.isFinite(amount) ? amount : DEFAULT_HEARTBURN_PER_BITE));
}
