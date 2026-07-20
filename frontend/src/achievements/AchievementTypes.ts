export type AchievementCategory =
  | "MATCHES" | "WINS" | "SCORING" | "COMBOS" | "FOOD"
  | "OPPONENTS" | "MECHANICS" | "PROGRESSION" | "COLLECTION" | "SPECIAL";

export type AchievementMetric =
  | "MATCHES_PLAYED" | "MATCHES_WON" | "TOTAL_SCORE" | "BEST_SCORE"
  | "HIGHEST_COMBO" | "TOTAL_COMBO_TAPS" | "COINS_EARNED" | "XP_EARNED"
  | "FOOD_MECHANICS_COMPLETED" | "PIZZA_CHEESE_PULLS_COMPLETED"
  | "TACO_STABILITY_CHALLENGES_COMPLETED" | "RAMEN_SLURPS_COMPLETED"
  | "BURGER_HEAVY_BITES_COMPLETED" | "HOT_DOG_SPRINTS_COMPLETED"
  | "WINGS_HEAT_RUSHES_TRIGGERED" | "SPECIFIC_FOOD_MATCHES_PLAYED"
  | "SPECIFIC_OPPONENTS_DEFEATED" | "SIGNATURE_MOVES_SURVIVED"
  | "DAILY_MISSIONS_COMPLETED" | "ITEMS_OWNED" | "BELT_RANK_REACHED";

export type AchievementTier = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";
export type AchievementProgressMode = "INCREMENTAL" | "HIGHEST_VALUE";

export type AchievementReward = { coins: number; xp: number; cosmeticId?: string };

export type AchievementDefinition = {
  id: string;
  title: string;
  description: string;
  category: AchievementCategory;
  metric: AchievementMetric;
  progressMode: AchievementProgressMode;
  goal: number;
  reward: AchievementReward;
  tier?: AchievementTier;
  targetId?: string;
};

export type AchievementProgress = {
  achievementId: string;
  currentProgress: number;
  goal: number;
  completed: boolean;
  completedAt: string | null;
  claimed: boolean;
  claimedAt: string | null;
};

export type AchievementState = {
  version: 1;
  progress: AchievementProgress[];
  claimedRewards: { coins: number; xp: number };
  processedEventIds: string[];
};

export type FoodMechanicType =
  | "cheese_pull" | "shell_stability" | "noodle_slurp"
  | "heavy_bite" | "speed_sprint" | "heat_rush";

export type AchievementEvent =
  | { type: "MATCH_COMPLETED"; eventId: string; won: boolean; score: number; highestCombo: number; foodId?: string; opponentId?: string; coinsEarned?: number; xpEarned?: number }
  | { type: "FOOD_MECHANIC_COMPLETED"; mechanicType: FoodMechanicType }
  | { type: "DAILY_MISSION_COMPLETED"; amount?: number }
  | { type: "ITEM_ACQUIRED"; ownedItemCount: number }
  | { type: "BELT_RANK_CHANGED"; rank: number };

export type AchievementCompletionNotification = {
  achievementId: string;
  title: string;
  reward: AchievementReward;
};

export type AchievementEventResult = {
  state: AchievementState;
  newlyCompleted: AchievementCompletionNotification[];
};

export type AchievementMigrationSnapshot = {
  matches?: number;
  wins?: number;
  bestScore?: number;
  highestCombo?: number;
  xp?: number;
  itemsOwned?: number;
  beltRank?: number;
};

export type ClaimAchievementResult =
  | { ok: true; state: AchievementState; reward: AchievementReward }
  | { ok: false; state: AchievementState; error: "NOT_FOUND" | "NOT_COMPLETED" | "ALREADY_CLAIMED" | "CLAIM_IN_PROGRESS" | "PERSISTENCE_FAILED" };
