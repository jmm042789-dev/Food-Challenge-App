const assert = require("node:assert/strict");
const test = require("node:test");

const {
  applyHeatGain,
  calculateTapScore,
  consumeAntacid,
  deriveMatchStats,
  effectiveTapPower,
  effectiveComboWindowMs,
  FRESH_STOMACH_DURATION_MS,
  FRESH_STOMACH_SCORE_MULTIPLIER,
  getHeatGameplayModifiers,
  HEAT_SHIELD_DURATION_MS,
} = require("../src/game/matchModifiers.ts");

test("derives base stats and exactly one equipped gear modifier", () => {
  assert.deepEqual(deriveMatchStats(null), {
    equippedGear: null,
    equippedGearName: null,
    tapPower: 1,
    comboWindowMs: 700,
    scoreMultiplier: 1,
    heatGenerationMultiplier: 1,
  });
  assert.equal(deriveMatchStats("tap_boost").tapPower, 2);
  assert.equal(deriveMatchStats("tap_boost").heatGenerationMultiplier, 1.1);
  assert.equal(deriveMatchStats("combo_boost").comboWindowMs, 875);
  assert.equal(deriveMatchStats("score_multiplier").scoreMultiplier, 1.5);
  assert.equal(deriveMatchStats("score_multiplier").heatGenerationMultiplier, 1.15);
  assert.deepEqual(deriveMatchStats("unknown_gear"), deriveMatchStats(null));
  assert.equal(deriveMatchStats("score_multiplier").tapPower, 1);
});

test("reduces tap effectiveness without rejecting input and keeps overheat penalties", () => {
  assert.equal(getHeatGameplayModifiers(79.99).tapEffectivenessMultiplier, 1);
  assert.equal(getHeatGameplayModifiers(80).tapEffectivenessMultiplier, 0.9);
  assert.equal(getHeatGameplayModifiers(99).tapEffectivenessMultiplier, 0.9);
  assert.equal(getHeatGameplayModifiers(100).tapEffectivenessMultiplier, 0.75);
  assert.equal(getHeatGameplayModifiers(100).scoreMultiplier, 0.9);
  assert.equal(effectiveComboWindowMs(700, 100), 595);
  assert.equal(effectiveComboWindowMs(875, 100), 744);
  assert.equal(effectiveComboWindowMs(700, 79), 700);
  assert.equal(getHeatGameplayModifiers(70).scoreMultiplier, 1);

  const base = deriveMatchStats(null);
  const tapBoost = deriveMatchStats("tap_boost");
  assert.equal(effectiveTapPower(base, 79), 1);
  assert.equal(effectiveTapPower(base, 80), 0.9);
  assert.equal(effectiveTapPower(base, 100), 0.75);
  assert.equal(effectiveTapPower(tapBoost, 79), 2);
  assert.equal(effectiveTapPower(tapBoost, 80), 1.8);
  assert.equal(effectiveTapPower(tapBoost, 100), 1.5);

  const contributions = Array.from({ length: 100 }, () => effectiveTapPower(base, 100));
  assert.equal(contributions.length, 100);
  assert.equal(contributions.every((value) => value > 0), true);
});

test("fractional tap contribution accumulates without per-tap rounding", () => {
  const base = deriveMatchStats(null);
  const accumulatedHotProgress = Array.from(
    { length: 10 },
    () => effectiveTapPower(base, 80),
  ).reduce((total, contribution) => total + contribution, 0);
  assert.ok(Math.abs(accumulatedHotProgress - 9) < 1e-9);

  const tapBoost = deriveMatchStats("tap_boost");
  const accumulatedBoostedProgress = Array.from(
    { length: 5 },
    () => effectiveTapPower(tapBoost, 80),
  ).reduce((total, contribution) => total + contribution, 0);
  assert.ok(Math.abs(accumulatedBoostedProgress - 9) < 1e-9);
});

test("antacid consumes once, uses skilled reduction, clamps, and refreshes buffs", () => {
  const first = consumeAntacid(2, 90, 1000);
  assert.ok(first);
  assert.equal(first.inventory, 1);
  assert.equal(first.heatReduction, 40);
  assert.equal(first.heat, 50);
  assert.equal(first.heatShieldUntil, 1000 + HEAT_SHIELD_DURATION_MS);
  assert.equal(first.freshStomachUntil, 1000 + FRESH_STOMACH_DURATION_MS);

  const overheated = consumeAntacid(1, 100, 2000);
  assert.ok(overheated);
  assert.equal(overheated.heatReduction, 30);
  assert.equal(overheated.heat, 70);
  assert.equal(effectiveTapPower(deriveMatchStats(null), overheated.heat), 1);

  assert.equal(consumeAntacid(1, 20, 0).heat, 0);
  assert.equal(consumeAntacid(0, 90, 0), null);

  const refreshed = consumeAntacid(1, 50, 4000);
  assert.equal(refreshed.freshStomachUntil, 4000 + FRESH_STOMACH_DURATION_MS);
  assert.equal(FRESH_STOMACH_SCORE_MULTIPLIER, 1.1);
});

test("heat shield blocks heat gain until it expires", () => {
  assert.equal(applyHeatGain(50, 10, 1.15, 3000, 2999), 50);
  assert.equal(applyHeatGain(50, 10, 1.15, 3000, 3000), 61.5);
});

test("scoring applies gear, fresh stomach, and overheat exactly once", () => {
  const base = deriveMatchStats(null);
  const scoreGear = deriveMatchStats("score_multiplier");
  assert.equal(calculateTapScore(10, 1, base, false, 0), 10);
  assert.equal(calculateTapScore(10, 1, scoreGear, false, 0), 15);
  assert.equal(calculateTapScore(10, 1, scoreGear, true, 0), 16.5);
  assert.equal(calculateTapScore(10, 1, base, false, 100), 6.75);
  assert.ok(Math.abs(calculateTapScore(10, 1, scoreGear, true, 100) - 11.1375) < 1e-9);
});
