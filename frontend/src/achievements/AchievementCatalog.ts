import type { AchievementDefinition } from "./AchievementTypes";

export const ACHIEVEMENT_CATALOG: readonly AchievementDefinition[] = [
  { id: "matches_played_001", title: "First Bite", description: "Play your first match.", category: "MATCHES", metric: "MATCHES_PLAYED", progressMode: "INCREMENTAL", goal: 1, tier: "BRONZE", reward: { coins: 25, xp: 25 } },
  { id: "matches_played_010", title: "Getting Hungry", description: "Play 10 matches.", category: "MATCHES", metric: "MATCHES_PLAYED", progressMode: "INCREMENTAL", goal: 10, tier: "SILVER", reward: { coins: 100, xp: 100 } },
  { id: "matches_played_050", title: "Feast Regular", description: "Play 50 matches.", category: "MATCHES", metric: "MATCHES_PLAYED", progressMode: "INCREMENTAL", goal: 50, tier: "GOLD", reward: { coins: 300, xp: 300 } },
  { id: "matches_played_100", title: "Arcade Glutton", description: "Play 100 matches.", category: "MATCHES", metric: "MATCHES_PLAYED", progressMode: "INCREMENTAL", goal: 100, tier: "PLATINUM", reward: { coins: 600, xp: 600 } },
  { id: "matches_won_001", title: "First Victory", description: "Win your first match.", category: "WINS", metric: "MATCHES_WON", progressMode: "INCREMENTAL", goal: 1, tier: "BRONZE", reward: { coins: 50, xp: 40 } },
  { id: "matches_won_010", title: "Hot Streak", description: "Win 10 matches.", category: "WINS", metric: "MATCHES_WON", progressMode: "INCREMENTAL", goal: 10, tier: "SILVER", reward: { coins: 175, xp: 150 } },
  { id: "matches_won_050", title: "Feast Champion", description: "Win 50 matches.", category: "WINS", metric: "MATCHES_WON", progressMode: "INCREMENTAL", goal: 50, tier: "GOLD", reward: { coins: 500, xp: 500 } },
  { id: "best_score_050", title: "Plate Breaker", description: "Score 50 points in one match.", category: "SCORING", metric: "BEST_SCORE", progressMode: "HIGHEST_VALUE", goal: 50, tier: "BRONZE", reward: { coins: 60, xp: 60 } },
  { id: "total_score_1000", title: "Score Smelter", description: "Earn 1,000 total match points.", category: "SCORING", metric: "TOTAL_SCORE", progressMode: "INCREMENTAL", goal: 1000, tier: "SILVER", reward: { coins: 200, xp: 200 } },
  { id: "combo_highest_005", title: "Combo Starter", description: "Reach a 5x combo.", category: "COMBOS", metric: "HIGHEST_COMBO", progressMode: "HIGHEST_VALUE", goal: 5, tier: "BRONZE", reward: { coins: 40, xp: 40 } },
  { id: "combo_highest_015", title: "Combo Cooker", description: "Reach a 15x combo.", category: "COMBOS", metric: "HIGHEST_COMBO", progressMode: "HIGHEST_VALUE", goal: 15, tier: "SILVER", reward: { coins: 125, xp: 125 } },
  { id: "combo_highest_030", title: "Combo Inferno", description: "Reach a 30x combo.", category: "COMBOS", metric: "HIGHEST_COMBO", progressMode: "HIGHEST_VALUE", goal: 30, tier: "GOLD", reward: { coins: 350, xp: 350 } },
  { id: "mechanic_cheese_005", title: "Cheese Wrangler", description: "Complete 5 Pizza Cheese Pulls.", category: "MECHANICS", metric: "PIZZA_CHEESE_PULLS_COMPLETED", progressMode: "INCREMENTAL", goal: 5, reward: { coins: 125, xp: 100 } },
  { id: "mechanic_taco_005", title: "Shell Saver", description: "Survive 5 Taco Stability challenges.", category: "MECHANICS", metric: "TACO_STABILITY_CHALLENGES_COMPLETED", progressMode: "INCREMENTAL", goal: 5, reward: { coins: 125, xp: 100 } },
  { id: "mechanic_ramen_005", title: "Slurp Specialist", description: "Complete 5 Ramen Slurps.", category: "MECHANICS", metric: "RAMEN_SLURPS_COMPLETED", progressMode: "INCREMENTAL", goal: 5, reward: { coins: 125, xp: 100 } },
  { id: "mechanic_burger_005", title: "Heavy Hitter", description: "Complete 5 Burger Heavy Bites.", category: "MECHANICS", metric: "BURGER_HEAVY_BITES_COMPLETED", progressMode: "INCREMENTAL", goal: 5, reward: { coins: 125, xp: 100 } },
  { id: "mechanic_hotdog_005", title: "Speed Eater", description: "Complete 5 Hot Dog Speed Sprints.", category: "MECHANICS", metric: "HOT_DOG_SPRINTS_COMPLETED", progressMode: "INCREMENTAL", goal: 5, reward: { coins: 150, xp: 125 } },
  { id: "mechanic_wings_005", title: "Wing Warrior", description: "Trigger 5 Wings Heat Rushes.", category: "MECHANICS", metric: "WINGS_HEAT_RUSHES_TRIGGERED", progressMode: "INCREMENTAL", goal: 5, reward: { coins: 150, xp: 125 } },
  { id: "coins_earned_1000", title: "Coin Collector", description: "Earn 1,000 coins from tracked rewards.", category: "PROGRESSION", metric: "COINS_EARNED", progressMode: "INCREMENTAL", goal: 1000, tier: "SILVER", reward: { coins: 250, xp: 150 } },
  { id: "xp_earned_1000", title: "XP Climber", description: "Earn 1,000 XP from tracked rewards.", category: "PROGRESSION", metric: "XP_EARNED", progressMode: "INCREMENTAL", goal: 1000, tier: "SILVER", reward: { coins: 150, xp: 250 } },
  { id: "items_owned_005", title: "Gear Collector", description: "Own 5 pieces of gear.", category: "COLLECTION", metric: "ITEMS_OWNED", progressMode: "HIGHEST_VALUE", goal: 5, tier: "SILVER", reward: { coins: 200, xp: 175 } },
  { id: "belt_rank_003", title: "Golden Appetite", description: "Reach the third belt rank.", category: "PROGRESSION", metric: "BELT_RANK_REACHED", progressMode: "HIGHEST_VALUE", goal: 3, tier: "GOLD", reward: { coins: 300, xp: 300 } },
] as const;

export const ACHIEVEMENT_BY_ID = new Map(ACHIEVEMENT_CATALOG.map((achievement) => [achievement.id, achievement]));
