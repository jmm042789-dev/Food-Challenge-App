const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { initialResultFlow, transitionResultFlow } = require("../src/game/resultFlow.ts");
const { resolveFoodArtworkKey } = require("../src/assets/foodArtworkKeys.ts");
const { RESULT_VERIFICATION_TIMEOUT_MS, ResultVerificationTimeoutError, verifyResultWithTimeout } = require("../src/game/resultVerification.ts");

test("terminal result flow is deterministic across slow responses and repeated renders", () => {
  let state = initialResultFlow();
  state = transitionResultFlow(state, { type: "FINISH" });
  assert.equal(state.phase, "FINISHED");
  assert.strictEqual(transitionResultFlow(state, { type: "FINISH" }), state);
  state = transitionResultFlow(state, { type: "SUBMIT" });
  assert.equal(state.phase, "SUBMITTING_RESULT");
  assert.equal(state.attempt, 1);
  assert.strictEqual(transitionResultFlow(state, { type: "SUBMIT" }), state);
  const official = { coin_reward: 25, match_id: "synthetic" };
  state = transitionResultFlow(state, { type: "ACCEPT", result: official });
  assert.equal(state.phase, "OFFICIAL_RESULT_RECEIVED");
  assert.strictEqual(state.officialResult, official);
  assert.strictEqual(transitionResultFlow(state, { type: "ACCEPT", result: official }), state);
  state = transitionResultFlow(state, { type: "SHOW_RESULT" });
  assert.equal(state.phase, "NAVIGATING_RESULT");
  state = transitionResultFlow(state, { type: "SHOW_RESULT" });
  assert.equal(state.phase, "RESULT_SCREEN");
  assert.strictEqual(transitionResultFlow(state, { type: "SHOW_RESULT" }), state);
});

test("network, 5xx, and validation failures require an explicit safe retry", () => {
  for (const error of [new TypeError("Network request failed"), { status: 503 }, { status: 422 }]) {
    let state = transitionResultFlow(initialResultFlow(), { type: "FINISH" });
    state = transitionResultFlow(state, { type: "SUBMIT" });
    state = transitionResultFlow(state, { type: "REJECT", error });
    assert.equal(state.phase, "RESULT_ERROR");
    assert.strictEqual(transitionResultFlow(state, { type: "SUBMIT" }), state);
    state = transitionResultFlow(state, { type: "RETRY" });
    state = transitionResultFlow(state, { type: "SUBMIT" });
    assert.equal(state.phase, "SUBMITTING_RESULT");
    assert.equal(state.attempt, 2);
    state = transitionResultFlow(state, { type: "ACCEPT", result: { accepted: true } });
    assert.equal(state.phase, "OFFICIAL_RESULT_RECEIVED");
  }
});

test("result verification succeeds quickly and slowly before its production deadline", async () => {
  assert.equal(RESULT_VERIFICATION_TIMEOUT_MS, 15_000);
  assert.equal(await verifyResultWithTimeout(async () => "quick", 50), "quick");
  assert.equal(await verifyResultWithTimeout(() => new Promise((resolve) => setTimeout(() => resolve("slow"), 15)), 100), "slow");
});

test("a never-resolving request is aborted and rejects with a bounded timeout", async () => {
  let aborted = false;
  await assert.rejects(
    verifyResultWithTimeout((signal) => {
      signal.addEventListener("abort", () => { aborted = true; });
      return new Promise(() => {});
    }, 15),
    (error) => error instanceof ResultVerificationTimeoutError && error.code === "RESULT_VERIFICATION_TIMEOUT",
  );
  assert.equal(aborted, true);
});

test("late completion after timeout cannot become an accepted coordinator result", async () => {
  let lateResolve;
  const pending = verifyResultWithTimeout(() => new Promise((resolve) => { lateResolve = resolve; }), 10);
  await assert.rejects(pending, ResultVerificationTimeoutError);
  lateResolve({ accepted: true });
  let state = transitionResultFlow(transitionResultFlow(initialResultFlow(), { type: "FINISH" }), { type: "SUBMIT" });
  state = transitionResultFlow(state, { type: "REJECT", error: new ResultVerificationTimeoutError(10) });
  assert.equal(state.phase, "RESULT_ERROR");
  assert.strictEqual(transitionResultFlow(state, { type: "ACCEPT", result: { accepted: true } }), state);
});

test("the game clock performs terminal work outside React state updaters", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/game/useGameLoop.ts"), "utf8");
  assert.match(source, /setTimeRemaining\(nextTime\);[\s\S]*if \(nextTime === 0\) endGame\(\)/);
  assert.doesNotMatch(source, /setTimeRemaining\(\(time\)[\s\S]{0,300}endGame\(\)/);
});

test("weekly tournament uses resolved food artwork and no initials tile", () => {
  assert.equal(resolveFoodArtworkKey("pizza-hut-stuffed"), "pizza-hut-stuffed");
  const panel = fs.readFileSync(path.join(__dirname, "../src/tournaments/components/TournamentPanel.tsx"), "utf8");
  assert.match(panel, /getFoodArtwork\(tournament\.entryContestId/);
  assert.doesNotMatch(panel, /tournament\.artworkPlaceholder/);
});

test("menu screens share the compact header and avoid height-proportional scaling", () => {
  for (const file of ["contests.tsx", "shop.tsx", "leaderboard.tsx", "profile.tsx"]) {
    const source = fs.readFileSync(path.join(__dirname, `../app/(tabs)/${file}`), "utf8");
    assert.match(source, /CompactScreenHeader/);
    assert.doesNotMatch(source, /Dimensions\.get\(["']window["']\)\.height|useWindowDimensions\(\)\.height/);
  }
  const contests = fs.readFileSync(path.join(__dirname, "../app/(tabs)/contests.tsx"), "utf8");
  assert.equal((contests.match(/TOURNAMENT BOARD/g) || []).length, 1);
});
