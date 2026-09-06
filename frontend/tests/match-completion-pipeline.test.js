const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("match result request is not preempted by the shared eight-second API timeout", () => {
  const api = fs.readFileSync(path.join(__dirname, "../src/api.ts"), "utf8");
  assert.match(api, /req\(`\/match\/result`[\s\S]*}, true, true, 20_000\)/);
  assert.match(api, /setTimeout\(\(\) => controller\.abort\(\), requestTimeoutMs\)/);
});

test("verified result requires authoritative stash totals and renders one rewards screen", () => {
  const play = fs.readFileSync(path.join(__dirname, "../app/play/[contestId].tsx"), "utf8");
  const overlay = fs.readFileSync(path.join(__dirname, "../src/game/ui/VictoryOverlay.tsx"), "utf8");
  assert.match(play, /typeof reward\.new_coins !== "number"/);
  assert.match(play, /typeof reward\.new_tums !== "number"/);
  assert.match(overlay, /FEAST COMPLETE/);
  assert.match(overlay, /YOUR STASH/);
  assert.match(overlay, /RETURN TO ARENA/);
  assert.doesNotMatch(overlay, /REPLAY/);
  assert.match(play, /router\.replace\("\/\(tabs\)\/home"\)/);
});

test("retry remains serialized and reuses the retained server match identity", () => {
  const play = fs.readFileSync(path.join(__dirname, "../app/play/[contestId].tsx"), "utf8");
  assert.match(play, /if \(resultRequestInFlight\.current\) return;[\s\S]*dispatchResultFlow\(\{ type: "RETRY" \}\)/);
  assert.match(play, /match_id: matchId/);
  assert.doesNotMatch(play, /coin_reward\s*:/);
});

test("completed submission calls the API, retries the same payload, and serializes taps", async () => {
  const { createResultSubmissionCoordinator } = require("../src/game/resultSubmission.js");
  const calls = [];
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const coordinator = createResultSubmissionCoordinator(async (payload) => { calls.push(payload); await gate; return { ok: true }; });
  coordinator.preserve({ match_id: "match-real-123", contest_id: "contest-1", score: 42 });
  const first = coordinator.submit();
  const simultaneous = coordinator.submit();
  await Promise.resolve();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].match_id, "match-real-123");
  release();
  await Promise.all([first, simultaneous]);
  await coordinator.submit();
  assert.equal(calls.length, 2);
  assert.strictEqual(calls[1], calls[0]);
});

test("contest duration resolution cannot reset server match identity", () => {
  const play = fs.readFileSync(path.join(__dirname, "../app/play/[contestId].tsx"), "utf8");
  assert.match(play, /resultSubmission\.clear\(\);[\s\S]*?\}, \[matchRouteKey\]\);/);
});

test("result failures expose release-safe diagnostic classes", async () => {
  const {
    ResultResponseInvalidError,
    ResultVerificationTimeoutError,
    ResultVerificationUnavailableError,
    classifyResultFailure,
    publicResultDiagnosticCode,
    safeResultBackendCode,
  } = await import("../src/game/resultVerification.ts");

  assert.equal(classifyResultFailure(new ResultVerificationUnavailableError()), "MATCH_CONTEXT_MISSING");
  assert.equal(classifyResultFailure(new ResultVerificationTimeoutError(15_000)), "RESULT_REQUEST_TIMEOUT");
  assert.equal(classifyResultFailure(new TypeError("Network request failed")), "RESULT_NETWORK_ERROR");
  assert.equal(classifyResultFailure({ status: 401 }), "RESULT_AUTH_FAILURE");
  assert.equal(classifyResultFailure({ status: 409, code: "MATCH_NOT_ACTIVE" }), "RESULT_MATCH_NOT_FOUND");
  assert.equal(classifyResultFailure({ status: 400, code: "MATCH_RESULT_REJECTED" }), "RESULT_INPUT_REJECTED");
  assert.equal(classifyResultFailure({ status: 422, message: "extra_forbidden: input_events" }), "RESULT_SCHEMA_INVALID");
  assert.equal(classifyResultFailure({ status: 503 }), "RESULT_HTTP_5XX");
  assert.equal(classifyResultFailure(new ResultResponseInvalidError()), "RESULT_RESPONSE_INVALID");

  assert.equal(publicResultDiagnosticCode({ status: 400, code: "MATCH_RESULT_REJECTED" }), "RESULT-REJECTED");
  assert.equal(publicResultDiagnosticCode({ status: 401 }), "RESULT-AUTH");
  assert.equal(publicResultDiagnosticCode({ status: 403 }), "RESULT-AUTH");
  assert.equal(publicResultDiagnosticCode({ status: 404 }), "RESULT-NOT-FOUND");
  assert.equal(publicResultDiagnosticCode({ status: 422 }), "RESULT-SCHEMA");
  assert.equal(publicResultDiagnosticCode({ status: 503 }), "RESULT-SERVER");
  assert.equal(publicResultDiagnosticCode(new ResultVerificationTimeoutError(15_000)), "RESULT-TIMEOUT");
  assert.equal(publicResultDiagnosticCode(new TypeError("Network request failed")), "RESULT-NETWORK");
  assert.equal(publicResultDiagnosticCode(new ResultResponseInvalidError()), "RESULT-INVALID-RESPONSE");
  assert.equal(publicResultDiagnosticCode(new ResultVerificationUnavailableError()), "RESULT-CONTEXT");
  assert.equal(publicResultDiagnosticCode(new Error("unclassified")), "RESULT-UNKNOWN");
  assert.equal(safeResultBackendCode({ code: "MATCH_RESULT_REJECTED" }), "MATCH_RESULT_REJECTED");
  assert.equal(safeResultBackendCode({ code: "Bearer secret/value" }), null);
});

test("rendered result diagnostics contain only safe categories and validated correlation IDs", () => {
  const play = fs.readFileSync(path.join(__dirname, "../app/play/[contestId].tsx"), "utf8");
  assert.match(play, /CODE \{publicResultDiagnosticCode\(resultFlow\.error\)\}/);
  assert.match(play, /requestIdForError\(resultFlow\.error, null\)/);
  assert.doesNotMatch(play, /CODE \{classifyResultFailure\(resultFlow\.error\)\}/);
  assert.doesNotMatch(play, /console\.(?:info|error)\([^\n]*completedPayload\.match_id/);
  assert.match(play, /submitResultCalled: true/);
  assert.match(play, /retryReusedPreservedPayload: resultFlow\.attempt > 1/);
});

test("Build 15 preserves validation evidence instead of downgrading for an old deployment", () => {
  const api = fs.readFileSync(path.join(__dirname, "../src/api.ts"), "utf8");
  const play = fs.readFileSync(path.join(__dirname, "../app/play/[contestId].tsx"), "utf8");
  assert.match(api, /validation_version: 3/);
  assert.match(api, /input_events:/);
  assert.match(play, /validation_version: 3/);
  assert.match(play, /input_events: finalizedInputEvents/);
  assert.match(play, /CODE \{publicResultDiagnosticCode\(resultFlow\.error\)\}/);
});
