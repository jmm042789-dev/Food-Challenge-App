import { DEFAULT_HEARTBURN, FOOD_HEAT_VALUES, HEAT_EVENT_VALUES } from "./balance";
import { getDifficultyMultiplier } from "./difficulty";
import { addHeartburnValue } from "./heartburn";

export type FoodHeatKey = keyof typeof FOOD_HEAT_VALUES;
export type HeatEvent = keyof typeof HEAT_EVENT_VALUES;
export type ChallengeHeatModifiers = {
  heatMultiplier?: number;
  extraHeat?: number;
};
export type FoodHeatOptions = ChallengeHeatModifiers & { difficulty?: string; foodName?: string };

const FOOD_ALIASES: Readonly<Record<string, FoodHeatKey>> = {
  NATHANS_HOTDOGS: "HOT_DOG",
  HOTDOG: "HOT_DOG",
  HOT_DOGS: "HOT_DOG",
  WING_BOWL: "CHICKEN_WINGS",
  WINGS: "CHICKEN_WINGS",
  PIZZA_HUT_STUFFED: "PIZZA",
  PIZZA_PEPPERONI: "PIZZA",
  IN_N_OUT_BURGERS: "BURGER",
  BURGERS: "BURGER",
};

function normalizeKey(value?: string): string {
  return value?.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") ?? "";
}

function findFoodHeat(foodId?: string): number | undefined {
  const normalized = normalizeKey(foodId);
  const key = FOOD_ALIASES[normalized] ?? normalized;
  return Object.prototype.hasOwnProperty.call(FOOD_HEAT_VALUES, key) ? FOOD_HEAT_VALUES[key as FoodHeatKey] : undefined;
}

export function getFoodHeat(foodId?: string): number {
  return findFoodHeat(foodId) ?? DEFAULT_HEARTBURN;
}

export function resolveFoodHeat(foodId: string | undefined, options: FoodHeatOptions = {}): number {
  const difficultyMultiplier = getDifficultyMultiplier(options.difficulty);
  const challengeMultiplier = Number.isFinite(options.heatMultiplier) ? Math.max(0, options.heatMultiplier ?? 1) : 1;
  const extraHeat = Number.isFinite(options.extraHeat) ? options.extraHeat ?? 0 : 0;
  const baseHeat = findFoodHeat(foodId) ?? findFoodHeat(options.foodName) ?? DEFAULT_HEARTBURN;
  return Math.round(baseHeat * difficultyMultiplier * challengeMultiplier + extraHeat);
}

export function getHeatEventAmount(event: HeatEvent): number {
  return HEAT_EVENT_VALUES[event];
}

export function applyHeatEvent(currentHeartburn: number, event: HeatEvent): number {
  return addHeartburnValue(currentHeartburn, getHeatEventAmount(event));
}
