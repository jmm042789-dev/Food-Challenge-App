const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  authoritativeOpponentScoreAtElapsed,
  parseAuthoritativeOpponent,
} = require("../src/game/authoritativeOpponent.ts");

test("parses and reproduces the backend-issued opponent target", () => {
  const parsed = parseAuthoritativeOpponent({
    seed: 42,
    final_score: 87,
    pace_per_sec: 2.9,
    duration_sec: 30,
    opponent: {
      id: "wing_walter",
      name: "Wing Walter",
      emoji: "W",
      difficulty: "Hard",
      tap_speed: 4,
      accuracy: 0.82,
      combo_skill: 0.7,
      aggression: 0.75,
    },
  });
  assert.ok(parsed);
  assert.equal(parsed.opponent.id, "wing_walter");
  assert.equal(parsed.opponent.personality, "Combo Master");
  assert.equal(authoritativeOpponentScoreAtElapsed(parsed.config, 0), 0);
  assert.equal(authoritativeOpponentScoreAtElapsed(parsed.config, 30), 87);
});

test("rejects incomplete opponent authority payloads", () => {
  assert.equal(parseAuthoritativeOpponent(null), null);
  assert.equal(parseAuthoritativeOpponent({ final_score: 20, duration_sec: 30 }), null);
});

test("settlement submits telemetry only and gates progression on acceptance", () => {
  const screen = fs.readFileSync(
    path.join(__dirname, "../app/play/[contestId].tsx"),
    "utf8",
  );
  assert.match(screen, /opponentConfig: authoritativeOpponentConfig/);
  assert.match(screen, /authoritative_outcome/);
  assert.match(screen, /Result Not Verified/);
  assert.match(screen, /resultReward === null/);
  assert.doesNotMatch(screen, /score_multiplier\s*:/);
  assert.doesNotMatch(screen, /tap_power\s*:/);
  assert.doesNotMatch(screen, /coin_reward\s*:/);
});
