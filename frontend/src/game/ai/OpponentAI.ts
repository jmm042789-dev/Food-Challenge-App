import { Opponent } from "./types";

export interface OpponentState {
  score: number;
  combo: number;
}

export function createOpponentState(): OpponentState {
  return {
    score: 0,
    combo: 0,
  };
}

export function updateOpponent(
  opponent: Opponent,
  state: OpponentState
): OpponentState {

  let combo = state.combo;

  // Did the AI make a mistake?
  if (Math.random() < opponent.mistakeChance) {
    combo = 0;

    return {
      score: state.score,
      combo,
    };
  }

  // Did the AI extend its combo?
  if (Math.random() < opponent.comboChance) {
    combo += 1;
  } else {
    combo = Math.max(combo - 1, 0);
  }

  // Base eating speed
  let gain = opponent.speed;

  // Accuracy bonus
  gain *= opponent.accuracy;

  // Combo bonus
  gain *= 1 + combo * 0.08;

  // Aggressive opponents occasionally burst
  if (
    opponent.personality === "Aggressive" &&
    Math.random() < opponent.aggression * 0.10
  ) {
    gain *= 1.4;
  }

  // Combo Masters get larger combo rewards
  if (
    opponent.personality === "Combo Master" &&
    combo >= 5
  ) {
    gain *= 1.35;
  }

  // Defensive opponents stay consistent
  if (
    opponent.personality === "Defensive"
  ) {
    gain *= 1.05;
  }

  // Wild opponents can be amazing...or terrible
  if (
    opponent.personality === "Wild"
  ) {
    gain *= 0.7 + Math.random() * 0.8;
  }

  // Small randomness so nobody feels robotic
  gain *= 0.95 + Math.random() * 0.10;

  return {
    score: state.score + gain,
    combo,
  };
}