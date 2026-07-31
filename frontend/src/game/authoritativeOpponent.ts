import type { Difficulty, Opponent, Personality } from "./ai/types";

export type AuthoritativeOpponentConfig = {
  seed: number;
  finalScore: number;
  pacePerSec: number;
  durationSec: number;
};

type MatchStartOpponent = {
  id?: unknown;
  name?: unknown;
  title?: unknown;
  emoji?: unknown;
  difficulty?: unknown;
  tap_speed?: unknown;
  accuracy?: unknown;
  combo_skill?: unknown;
  aggression?: unknown;
};

type MatchStartOpponentConfig = {
  seed?: unknown;
  final_score?: unknown;
  pace_per_sec?: unknown;
  duration_sec?: unknown;
  opponent?: MatchStartOpponent;
};

const finite = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const difficulty = (value: unknown): Difficulty => {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized === "easy") return "Easy";
  if (normalized === "medium") return "Medium";
  if (normalized === "hard") return "Hard";
  if (normalized === "legendary" || normalized === "legend") return "Legend";
  return "Medium";
};

const personality = (comboSkill: number, aggression: number): Personality => {
  if (comboSkill >= 0.7) return "Combo Master";
  if (aggression >= 0.7) return "Aggressive";
  if (aggression <= 0.35) return "Defensive";
  return "Balanced";
};

export function parseAuthoritativeOpponent(
  raw: MatchStartOpponentConfig | null | undefined,
): { opponent: Opponent; config: AuthoritativeOpponentConfig } | null {
  const source = raw?.opponent;
  const id = typeof source?.id === "string" ? source.id : "";
  const name = typeof source?.name === "string" ? source.name : "";
  const finalScore = finite(raw?.final_score, -1);
  const durationSec = finite(raw?.duration_sec, -1);
  if (!id || !name || finalScore < 0 || durationSec <= 0) return null;
  const accuracy = Math.min(1, Math.max(0, finite(source?.accuracy, 0.75)));
  const comboSkill = Math.min(1, Math.max(0, finite(source?.combo_skill, 0)));
  const aggression = Math.min(1, Math.max(0, finite(source?.aggression, 0.5)));
  return {
    opponent: {
      id,
      name,
      avatar: typeof source?.emoji === "string" ? source.emoji : "VS",
      level: 1,
      difficulty: difficulty(source?.difficulty),
      personality: personality(comboSkill, aggression),
      speed: Math.max(0.1, finite(source?.tap_speed, 1)),
      accuracy,
      comboChance: comboSkill,
      mistakeChance: Math.max(0, Math.min(0.35, 1 - accuracy)),
      aggression,
      rewardCoins: 0,
      rewardXP: 0,
    },
    config: {
      seed: Math.floor(finite(raw?.seed, 0)),
      finalScore: Math.floor(finalScore),
      pacePerSec: Math.max(0, finite(raw?.pace_per_sec, finalScore / durationSec)),
      durationSec: Math.floor(durationSec),
    },
  };
}

export function authoritativeOpponentScoreAtElapsed(
  config: AuthoritativeOpponentConfig,
  elapsedSeconds: number,
): number {
  const progress = Math.min(1, Math.max(0, elapsedSeconds / config.durationSec));
  // A gentle ease-in preserves the arcade presentation while guaranteeing the
  // backend-issued final target at the timer boundary.
  const easedProgress = progress * (0.88 + 0.12 * progress);
  return Math.floor(config.finalScore * easedProgress);
}
