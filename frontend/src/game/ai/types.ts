// ===============================
// Fire Feast AI Opponent Types
// ===============================

export type Difficulty =
  | "Easy"
  | "Medium"
  | "Hard"
  | "Elite"
  | "Legend";

export type Personality =
  | "Balanced"
  | "Aggressive"
  | "Defensive"
  | "Combo Master"
  | "Wild";

export interface Opponent {
  // Identity
  id: string;
  name: string;
  avatar: string;

  // Progression
  level: number;
  difficulty: Difficulty;
  personality: Personality;

  // AI Stats
  speed: number;
  accuracy: number;
  comboChance: number;
  mistakeChance: number;
  aggression: number;

  // Rewards
  rewardCoins: number;
  rewardXP: number;
}