import { Opponent, type Personality } from "./types";

export type MatchPhase = "OPENING" | "MIDGAME" | "FINAL_STRETCH";
export type OpponentBehavior =
  | "STEADY"
  | "PRESSING"
  | "BUILDING_COMBO"
  | "COMEBACK"
  | "BURSTING"
  | "HESITATING"
  | "RECOVERING";

type WildMode = "NONE" | "BURSTING" | "HESITATING";

export interface OpponentState {
  score: number;
  combo: number;
  behavior: OpponentBehavior;
  wildMode: WildMode;
  wildModeUntil: number;
  recoveryTicks: number;
}

export type OpponentUpdateContext = {
  timeRemaining: number;
  matchDuration: number;
  playerScore: number;
  now: number;
};

type PersonalityModifiers = {
  speed: number;
  accuracy: number;
  mistakeChance: number;
  comboChance: number;
  behavior: OpponentBehavior;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export function getMatchPhase(timeRemaining: number, matchDuration: number): MatchPhase {
  if (matchDuration <= 0) return "MIDGAME";
  const elapsedRatio = clamp(1 - timeRemaining / matchDuration, 0, 1);
  if (elapsedRatio < 0.2) return "OPENING";
  if (elapsedRatio >= 0.8) return "FINAL_STRETCH";
  return "MIDGAME";
}

export function createOpponentState(): OpponentState {
  return {
    score: 0,
    combo: 0,
    behavior: "STEADY",
    wildMode: "NONE",
    wildModeUntil: 0,
    recoveryTicks: 0,
  };
}

function getPersonalityModifiers(
  personality: Personality,
  phase: MatchPhase,
  isMeaningfullyTrailing: boolean,
  combo: number,
  recoveryTicks: number,
): PersonalityModifiers {
  const modifiers: PersonalityModifiers = {
    speed: 1,
    accuracy: 0,
    mistakeChance: 0,
    comboChance: 0,
    behavior: "STEADY",
  };

  switch (personality) {
    case "Aggressive":
      modifiers.speed = phase === "OPENING" ? 1.18 : 1.05;
      modifiers.accuracy = -0.03;
      modifiers.mistakeChance = 0.035;
      modifiers.behavior = "PRESSING";
      break;
    case "Defensive":
      modifiers.speed = 0.92;
      modifiers.accuracy = 0.025;
      modifiers.mistakeChance = -0.035;
      modifiers.comboChance = 0.04;
      break;
    case "Combo Master":
      modifiers.speed = recoveryTicks > 0 ? 0.82 : combo >= 5 ? 1.14 : phase === "OPENING" ? 0.9 : 0.98;
      modifiers.comboChance = recoveryTicks > 0 ? -0.08 : 0.1;
      modifiers.mistakeChance = combo >= 5 ? 0.015 : 0;
      modifiers.behavior = recoveryTicks > 0 ? "RECOVERING" : "BUILDING_COMBO";
      break;
    case "Comeback Specialist":
      if (isMeaningfullyTrailing) {
        modifiers.speed = phase === "FINAL_STRETCH" ? 1.22 : 1.1;
        modifiers.accuracy = phase === "FINAL_STRETCH" ? 0.06 : 0.035;
        modifiers.comboChance = 0.05;
        modifiers.behavior = "COMEBACK";
      }
      break;
    case "Wild":
    case "Balanced":
      break;
  }

  return modifiers;
}

export function updateOpponent(
  opponent: Opponent,
  state: OpponentState,
  context: OpponentUpdateContext,
): OpponentState {
  const phase = getMatchPhase(context.timeRemaining, context.matchDuration);
  const trailingBy = context.playerScore - state.score;
  const comebackThreshold = Math.max(10, Math.max(context.playerScore, state.score) * 0.1);
  const isMeaningfullyTrailing = trailingBy >= comebackThreshold;
  let wildMode = state.wildMode;
  let wildModeUntil = state.wildModeUntil;

  if (opponent.personality === "Wild") {
    if (wildMode !== "NONE" && context.now >= wildModeUntil) {
      wildMode = "NONE";
      wildModeUntil = 0;
    }
    if (wildMode === "NONE" && Math.random() < 0.08) {
      wildMode = Math.random() < 0.55 ? "BURSTING" : "HESITATING";
      wildModeUntil = context.now + (wildMode === "BURSTING"
        ? 500 + Math.random() * 700
        : 250 + Math.random() * 450);
    }
  } else {
    wildMode = "NONE";
    wildModeUntil = 0;
  }

  const modifiers = getPersonalityModifiers(
    opponent.personality,
    phase,
    isMeaningfullyTrailing,
    state.combo,
    state.recoveryTicks,
  );
  if (wildMode === "BURSTING") {
    modifiers.speed = 1.25;
    modifiers.accuracy += 0.02;
    modifiers.behavior = "BURSTING";
  } else if (wildMode === "HESITATING") {
    modifiers.speed = 0.75;
    modifiers.mistakeChance += 0.08;
    modifiers.behavior = "HESITATING";
  }

  const speedModifier = clamp(modifiers.speed, 0.75, 1.3);
  const accuracy = clamp(opponent.accuracy + modifiers.accuracy, 0, 1);
  const mistakeChance = clamp(opponent.mistakeChance + modifiers.mistakeChance, 0, 0.35);
  const comboChance = clamp(opponent.comboChance + modifiers.comboChance, 0, 1);
  const recoveryTicks = Math.max(0, state.recoveryTicks - 1);

  if (Math.random() < mistakeChance) {
    return {
      score: state.score,
      combo: 0,
      behavior: opponent.personality === "Combo Master" ? "RECOVERING" : modifiers.behavior,
      wildMode,
      wildModeUntil,
      recoveryTicks: opponent.personality === "Combo Master" ? 2 : recoveryTicks,
    };
  }

  const extendedCombo = Math.random() < comboChance;
  const protectedCombo = opponent.personality === "Defensive"
    && state.combo > 0
    && Math.random() < 0.6;
  const combo = extendedCombo
    ? state.combo + 1
    : protectedCombo ? state.combo : Math.max(state.combo - 1, 0);
  let gain = opponent.speed * speedModifier * accuracy;
  if (opponent.personality === "Aggressive") {
    gain *= 0.9 + Math.random() * 0.2;
  }
  gain *= clamp(1 + combo * 0.08, 1, 1.8);
  gain *= 0.95 + Math.random() * 0.1;

  return {
    score: state.score + gain,
    combo,
    behavior: modifiers.behavior,
    wildMode,
    wildModeUntil,
    recoveryTicks,
  };
}
