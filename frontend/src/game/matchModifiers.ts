export type GameplayGearId = "tap_boost" | "combo_boost" | "score_multiplier";

export type DerivedMatchStats = {
  equippedGear: GameplayGearId | null;
  equippedGearName: string | null;
  tapPower: number;
  comboWindowMs: number;
  scoreMultiplier: number;
  heatGenerationMultiplier: number;
};

export type HeatGameplayModifiers = {
  tapAcceptanceRate: number;
  scoreMultiplier: number;
  comboWindowMultiplier: number;
};

export type AntacidUseResult = {
  inventory: number;
  heat: number;
  heatReduction: number;
  heatShieldUntil: number;
  freshStomachUntil: number;
};

export const BASE_MATCH_STATS: DerivedMatchStats = Object.freeze({
  equippedGear: null,
  equippedGearName: null,
  tapPower: 1,
  comboWindowMs: 700,
  scoreMultiplier: 1,
  heatGenerationMultiplier: 1,
});

const GEAR_STATS: Record<GameplayGearId, Omit<DerivedMatchStats, "equippedGear" | "equippedGearName">> = {
  tap_boost: {
    tapPower: 2,
    comboWindowMs: 700,
    scoreMultiplier: 1,
    heatGenerationMultiplier: 1.1,
  },
  combo_boost: {
    tapPower: 1,
    comboWindowMs: 875,
    scoreMultiplier: 1,
    heatGenerationMultiplier: 1,
  },
  score_multiplier: {
    tapPower: 1,
    comboWindowMs: 700,
    scoreMultiplier: 1.5,
    heatGenerationMultiplier: 1.15,
  },
};

export const HEAT_SHIELD_DURATION_MS = 2000;
export const FRESH_STOMACH_DURATION_MS = 5000;
export const FRESH_STOMACH_SCORE_MULTIPLIER = 1.1;

export function deriveMatchStats(equippedGear?: string | null): DerivedMatchStats {
  if (!equippedGear || !(equippedGear in GEAR_STATS)) return { ...BASE_MATCH_STATS };
  const gearId = equippedGear as GameplayGearId;
  const equippedGearName = {
    tap_boost: "Tap Boost",
    combo_boost: "Combo Boost",
    score_multiplier: "Score Multiplier",
  }[gearId];
  return { equippedGear: gearId, equippedGearName, ...GEAR_STATS[gearId] };
}

export function getHeatGameplayModifiers(heat: number): HeatGameplayModifiers {
  if (heat >= 100) {
    return {
      tapAcceptanceRate: 0.75,
      scoreMultiplier: 0.9,
      comboWindowMultiplier: 0.85,
    };
  }
  if (heat >= 80) {
    return {
      tapAcceptanceRate: 0.9,
      scoreMultiplier: 1,
      comboWindowMultiplier: 1,
    };
  }
  return {
    tapAcceptanceRate: 1,
    scoreMultiplier: 1,
    comboWindowMultiplier: 1,
  };
}

export function processHeatLimitedTap(
  credit: number,
  heat: number,
): { accepted: boolean; credit: number } {
  const rate = getHeatGameplayModifiers(heat).tapAcceptanceRate;
  if (rate >= 1) return { accepted: true, credit: 0 };
  const nextCredit = Math.max(0, credit) + rate;
  if (nextCredit < 1 - 1e-9) return { accepted: false, credit: nextCredit };
  return { accepted: true, credit: nextCredit - 1 };
}

export function effectiveComboWindowMs(baseWindowMs: number, heat: number): number {
  return Math.round(baseWindowMs * getHeatGameplayModifiers(heat).comboWindowMultiplier);
}

export function calculateTapScore(
  baseGain: number,
  heatTierMultiplier: number,
  matchStats: DerivedMatchStats,
  freshStomachActive: boolean,
  heat: number,
): number {
  const freshMultiplier = freshStomachActive ? FRESH_STOMACH_SCORE_MULTIPLIER : 1;
  const overheatMultiplier = getHeatGameplayModifiers(heat).scoreMultiplier;
  return Math.round(
    baseGain
    * matchStats.tapPower
    * heatTierMultiplier
    * matchStats.scoreMultiplier
    * freshMultiplier
    * overheatMultiplier,
  );
}

export function antacidHeatReduction(heat: number): number {
  return heat >= 100 ? 30 : 40;
}

export function reduceHeatForAntacid(heat: number): number {
  return Math.max(0, Math.min(100, heat) - antacidHeatReduction(heat));
}

export function applyHeatGain(
  heat: number,
  amount: number,
  heatGenerationMultiplier: number,
  shieldUntil: number,
  now: number,
): number {
  if (shieldUntil > now) return Math.max(0, Math.min(100, heat));
  const gain = Number.isFinite(amount) ? amount : 0;
  return Math.max(0, Math.min(100, heat + gain * heatGenerationMultiplier));
}

export function consumeAntacid(
  inventory: number,
  heat: number,
  now: number,
): AntacidUseResult | null {
  if (inventory <= 0 || heat <= 0) return null;
  return {
    inventory: inventory - 1,
    heat: reduceHeatForAntacid(heat),
    heatReduction: antacidHeatReduction(heat),
    heatShieldUntil: now + HEAT_SHIELD_DURATION_MS,
    freshStomachUntil: now + FRESH_STOMACH_DURATION_MS,
  };
}
