export type BiteStyle =
  | "heavy"
  | "quick"
  | "rapid"
  | "wobble"
  | "slurp"
  | "spicy";

export type FoodMechanic =
  | "tap"
  | "rapid_tap"
  | "hold"
  | "swipe"
  | "tap_and_hold"
  | "tap_and_swipe";

export type FoodProfile = {
  id: string;
  displayName: string;
  biteStyle: BiteStyle;
  primaryMechanic: FoodMechanic;

  scoreMultiplier: number;
  comboMultiplier: number;
  heatMultiplier: number;

  cameraPunch: number;
  biteAnimationSpeed: number;
  foodWobble: number;

  specialMechanic?: {
    type: "hold_bite" | "heavy_bite" | "cheese_pull" | "shell_stability" | "noodle_slurp" | "speed_sprint" | "heat_rush";
    triggerEveryBites: number;
    holdDurationMs?: number;
    durationMs?: number;
    tapTarget?: number;
  };

  description: string;
};

export const FOOD_PROFILES: Record<string, FoodProfile> = {
  burger: {
    id: "burger",
    displayName: "Burger",
    biteStyle: "heavy",
    primaryMechanic: "tap",
    scoreMultiplier: 1.2,
    comboMultiplier: 0.85,
    heatMultiplier: 0.8,
    cameraPunch: 1.2,
    biteAnimationSpeed: 0.85,
    foodWobble: 0.25,
    specialMechanic: {
      type: "heavy_bite",
      triggerEveryBites: 5,
      holdDurationMs: 450,
    },
    description: "A weighty, high-value bite with deliberate pacing and a strong impact.",
  },
  pizza: {
    id: "pizza",
    displayName: "Pizza",
    biteStyle: "quick",
    primaryMechanic: "tap_and_swipe",
    scoreMultiplier: 1.05,
    comboMultiplier: 1.15,
    heatMultiplier: 1,
    cameraPunch: 1,
    biteAnimationSpeed: 1.15,
    foodWobble: 0.35,
    specialMechanic: {
      type: "cheese_pull",
      triggerEveryBites: 6,
    },
    description: "A quick, combo-friendly slice with an occasional stretchy cheese pull.",
  },
  taco: {
    id: "taco",
    displayName: "Taco",
    biteStyle: "wobble",
    primaryMechanic: "rapid_tap",
    scoreMultiplier: 1,
    comboMultiplier: 1.25,
    heatMultiplier: 1,
    cameraPunch: 0.95,
    biteAnimationSpeed: 1.2,
    foodWobble: 0.85,
    specialMechanic: {
      type: "shell_stability",
      triggerEveryBites: 5,
    },
    description: "A fast, unstable bite that rewards rhythm while keeping the shell together.",
  },
  ramen: {
    id: "ramen",
    displayName: "Ramen",
    biteStyle: "slurp",
    primaryMechanic: "tap_and_swipe",
    scoreMultiplier: 1.05,
    comboMultiplier: 1,
    heatMultiplier: 1,
    cameraPunch: 0.8,
    biteAnimationSpeed: 1,
    foodWobble: 0.5,
    specialMechanic: {
      type: "noodle_slurp",
      triggerEveryBites: 4,
    },
    description: "A smooth noodle challenge built around steady bites and periodic slurps.",
  },
  "hot-dog": {
    id: "hot-dog",
    displayName: "Hot Dog",
    biteStyle: "rapid",
    primaryMechanic: "rapid_tap",
    scoreMultiplier: 0.85,
    comboMultiplier: 1.35,
    heatMultiplier: 0.85,
    cameraPunch: 0.75,
    biteAnimationSpeed: 1.35,
    foodWobble: 0.2,
    specialMechanic: {
      type: "speed_sprint",
      triggerEveryBites: 8,
      durationMs: 1500,
      tapTarget: 6,
    },
    description: "A rapid-fire food with lighter bites and exceptionally fast combo potential.",
  },
  wings: {
    id: "wings",
    displayName: "Wings",
    biteStyle: "spicy",
    primaryMechanic: "tap",
    scoreMultiplier: 1.25,
    comboMultiplier: 1,
    heatMultiplier: 1.4,
    cameraPunch: 1.25,
    biteAnimationSpeed: 0.95,
    foodWobble: 0.45,
    specialMechanic: {
      type: "heat_rush",
      triggerEveryBites: 5,
      durationMs: 2000,
      tapTarget: 5,
    },
    description: "A high-value spicy bite with heavy impact and rapidly building heat.",
  },
};

const FOOD_KEYWORDS: ReadonlyArray<readonly [profileId: string, keywords: readonly string[]]> = [
  ["hot-dog", ["hot-dog", "hotdog", "dog"]],
  ["wings", ["wings", "wing", "chicken"]],
  ["ramen", ["ramen", "noodle"]],
  ["burger", ["burger"]],
  ["pizza", ["pizza"]],
  ["taco", ["taco"]],
];

const normalizeFoodKey = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const findProfile = (value: string): FoodProfile | undefined => {
  const normalized = normalizeFoodKey(value);
  const directProfile = FOOD_PROFILES[normalized];
  if (directProfile) return directProfile;

  const compact = normalized.replace(/-/g, "");
  for (const [profileId, keywords] of FOOD_KEYWORDS) {
    const matches = keywords.some((keyword) => {
      const normalizedKeyword = normalizeFoodKey(keyword);
      return normalized.includes(normalizedKeyword) || compact.includes(normalizedKeyword.replace(/-/g, ""));
    });
    if (matches) return FOOD_PROFILES[profileId];
  }

  return undefined;
};

export const getFoodProfile = (
  contestId?: string,
  foodId?: string,
): FoodProfile => {
  if (foodId) return findProfile(foodId) ?? FOOD_PROFILES.burger;
  if (contestId) return findProfile(contestId) ?? FOOD_PROFILES.burger;
  return FOOD_PROFILES.burger;
};
