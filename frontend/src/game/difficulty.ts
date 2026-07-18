import { DIFFICULTY_VALUES } from "./balance";

export type GameDifficulty = keyof typeof DIFFICULTY_VALUES;

export function normalizeDifficulty(value?: string): GameDifficulty {
  const normalized = value?.trim().toUpperCase();
  if (normalized === "EASY") return "EASY";
  if (normalized === "HARD") return "HARD";
  if (normalized === "EXTREME") return "EXTREME";
  return "NORMAL";
}

export function getDifficultyMultiplier(value?: string): number {
  return DIFFICULTY_VALUES[normalizeDifficulty(value)];
}
