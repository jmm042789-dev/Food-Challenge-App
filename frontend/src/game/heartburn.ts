import { COMPLETED_FOOD_BONUS_HEAT, DEFAULT_HEARTBURN, HEAT_MULTIPLIERS, OVERHEAT_TIME, RECOVERY_HEAT } from "./balance";
import { BURNOUT_DURATION_MS } from "./burnoutPolicy";

export type HeatTier = "COOL" | "WARM" | "HOT" | "CRITICAL" | "OVERHEATED";

export const DEFAULT_HEARTBURN_PER_BITE = DEFAULT_HEARTBURN;
export const COMPLETED_FOOD_HEARTBURN_BONUS = COMPLETED_FOOD_BONUS_HEAT;
export const OVERHEAT_DURATION_MS = OVERHEAT_TIME;
export const OVERHEAT_RECOVERY_HEARTBURN = RECOVERY_HEAT;
export const BASE_BITE_HEAT = DEFAULT_HEARTBURN;
export const COOLING_DELAY_MS = 450;
export const COOLING_PER_SECOND = 9;
export const MAX_HEARTBURN = 100;
export const OVERHEAT_WARNING_DURATION_MS = 2000;
export const OVERHEAT_RESET_HEAT = 68;
// The warning remains the Antacid save window. Once it expires, burnout is a
// deterministic scoring lockout shared with authoritative server replay.
export const OVERHEAT_PENALTY_MS = BURNOUT_DURATION_MS;
export const ANTACID_CRITICAL_THRESHOLD = 85;
export const ANTACID_PROMPT_THRESHOLD = 90;
export const REPEATED_OVERHEAT_WINDOW_MS = 5000;
export const PERFECT_COOLDOWN_THRESHOLD = 70;
export const PERFECT_COOLDOWN_BONUS = 5;

export function clampHeartburn(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(MAX_HEARTBURN, Math.max(0, value));
}

export function getHeatTier(heartburn: number): HeatTier {
  const heat = clampHeartburn(heartburn);
  if (heat >= 100) return "OVERHEATED";
  if (heat >= 85) return "CRITICAL";
  if (heat >= 65) return "HOT";
  if (heat >= 40) return "WARM";
  return "COOL";
}

export function getHeatMultiplier(tier: HeatTier): number {
  return HEAT_MULTIPLIERS[tier];
}

export function addHeartburnValue(current: number, amount = DEFAULT_HEARTBURN_PER_BITE): number {
  return clampHeartburn(current + (Number.isFinite(amount) ? amount : DEFAULT_HEARTBURN_PER_BITE));
}

export function coolHeartburn(heartburn: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return clampHeartburn(heartburn);
  return clampHeartburn(heartburn - COOLING_PER_SECOND * elapsedMs / 1000);
}

export function getOverheatCombo(combo: number, now: number, lastOverheatAt: number): number {
  return 0;
}

export function canConsumeAntacid(inventory: number, status: string, heartburn: number, protectedUntil: number, now: number): boolean {
  return status === "PLAYING" && inventory > 0 && heartburn > 0 && now >= protectedUntil;
}

export function isHeatGainProtected(protectedUntil: number, now: number): boolean {
  return protectedUntil > now;
}

export function shouldAwardPerfectCooldown(
  eligible: boolean,
  criticalCycleActive: boolean,
  previousHeat: number,
  nextHeat: number,
): boolean {
  return eligible
    && criticalCycleActive
    && previousHeat >= PERFECT_COOLDOWN_THRESHOLD
    && nextHeat < PERFECT_COOLDOWN_THRESHOLD;
}
