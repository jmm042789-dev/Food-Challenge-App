const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { initialResultFlow, transitionResultFlow } = require("../src/game/resultFlow.ts");
const { RESULT_VERIFICATION_TIMEOUT_MS, RESULT_VERIFICATION_UI_TOLERANCE_MS, remainingResultDeadlineMs } = require("../src/game/resultVerification.ts");

test("result attempt owns one immutable absolute deadline across duplicate events", () => {
  let state = transitionResultFlow(initialResultFlow(), { type: "FINISH" });
  state = transitionResultFlow(state, { type: "SUBMIT", startedAt: 1000, timeoutMs: RESULT_VERIFICATION_TIMEOUT_MS });
  assert.equal(state.startedAt, 1000);
  assert.equal(state.deadlineAt, 16000);
  assert.equal(state.generation, 1);
  assert.strictEqual(transitionResultFlow(state, { type: "FINISH" }), state);
  assert.strictEqual(transitionResultFlow(state, { type: "SUBMIT", startedAt: 9000, timeoutMs: RESULT_VERIFICATION_TIMEOUT_MS }), state);
  assert.equal(remainingResultDeadlineMs(state.deadlineAt, 8000), 8000);
});

test("stale timeout and completion cannot affect a newer retry generation", () => {
  let state = transitionResultFlow(initialResultFlow(), { type: "FINISH" });
  state = transitionResultFlow(state, { type: "SUBMIT", startedAt: 0, timeoutMs: 15 });
  state = transitionResultFlow(state, { type: "REJECT", generation: 1, reason: "COORDINATOR_TIMEOUT", error: new Error("timeout") });
  state = transitionResultFlow(state, { type: "RETRY" });
  state = transitionResultFlow(state, { type: "SUBMIT", startedAt: 30, timeoutMs: 15 });
  assert.equal(state.generation, 2);
  assert.strictEqual(transitionResultFlow(state, { type: "ACCEPT", generation: 1, result: { accepted: true } }), state);
  assert.strictEqual(transitionResultFlow(state, { type: "REJECT", generation: 1, error: new Error("late") }), state);
  state = transitionResultFlow(state, { type: "ACCEPT", generation: 2, result: { accepted: true } });
  assert.equal(state.phase, "OFFICIAL_RESULT_RECEIVED");
});

test("production screen has coordinator and independent UI deadlines including missing-context escape", () => {
  const source = fs.readFileSync(path.join(__dirname, "../app/play/[contestId].tsx"), "utf8");
  assert.match(source, /COORDINATOR_TIMEOUT/);
  assert.match(source, /UI_FAILSAFE_TIMEOUT/);
  assert.match(source, /MATCH_CONTEXT_MISSING/);
  assert.match(source, /remainingResultDeadlineMs\(resultFlow\.deadlineAt\)/);
  assert.equal(RESULT_VERIFICATION_UI_TOLERANCE_MS, 1500);
});

test("arena spotlight is removed and responsive feedback remains bounded", () => {
  const arena = fs.readFileSync(path.join(__dirname, "../src/game/arena/ArenaEffects.tsx"), "utf8");
  const effects = fs.readFileSync(path.join(__dirname, "../src/game/ui/EffectsLayer.tsx"), "utf8");
  const heat = fs.readFileSync(path.join(__dirname, "../src/game/ui/HeatPresentationOverlay.tsx"), "utf8");
  assert.doesNotMatch(arena, /styles\.spotlight|height: "52%"/);
  assert.match(effects, /Math\.min\(164/);
  assert.match(effects, /Math\.min\(38/);
  assert.match(heat, /maxWidth: "72%"/);
  assert.match(heat, /\? 780/);
});
