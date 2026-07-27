export const DEFAULT_HEARTBURN = 5;
export const COMPLETED_FOOD_BONUS_HEAT = 4;
export const OVERHEAT_TIME = 2000;
export const RECOVERY_HEAT = 68;
export const BASE_COMBO_WINDOW_MS = 700;
export const CRITICAL_COMBO_WINDOW_MULTIPLIER = 0.9;

export const HEAT_MULTIPLIERS = {
  COOL: 1,
  WARM: 1.1,
  HOT: 1.25,
  CRITICAL: 1.5,
  OVERHEATED: 0.5,
} as const;

export const FOOD_HEAT_VALUES = {
  SALAD: 3,
  APPLE: 2,
  BURGER: 6,
  CHEESEBURGER: 6,
  PIZZA: 6,
  TACO: 8,
  FRIES: 4,
  HOT_DOG: 5,
  CHICKEN_WINGS: 7,
  BBQ: 7,
  SPICY_RAMEN: 9,
  NASHVILLE_HOT: 9,
  HABANERO: 10,
  GHOST_PEPPER: 10,
  CAROLINA_REAPER: 10,
} as const;

export const DIFFICULTY_VALUES = {
  EASY: 0.8,
  NORMAL: 1,
  HARD: 1.2,
  EXTREME: 1.5,
} as const;

export const BONUS_VALUES = {
  CRITICAL_COMBO_REWARD: 1.25,
  HEAT_SURVIVOR_SCORE: 250,
} as const;

export const HEAT_EVENT_VALUES = {
  KITCHEN_FIRE: 25,
  COLD_DRINK: -20,
  BONUS_ICE: -50,
  SPICY_SAUCE: 15,
} as const;
