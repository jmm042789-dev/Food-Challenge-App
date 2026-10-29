const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { PlayerSchemaError, classifyStartupFailure, isOptionalStartupRouteMissing, startupDiagnosticCode, validateBootstrapPlayer, withTransientStartupRetry } = require("../src/startupReliability.ts");

test("startup distinguishes timeout, offline, server, auth, and permanent client failures", () => {
  const timeout = new Error("slow"); timeout.name = "RequestTimeoutError";
  assert.equal(classifyStartupFailure(timeout).kind, "TIMEOUT");
  assert.equal(classifyStartupFailure(new TypeError("Network request failed")).kind, "OFFLINE");
  assert.deepEqual(classifyStartupFailure({ status: 503 }), { kind: "SERVER", transient: true, status: 503, message: "Fire Feast couldn't reach the game server. Try again in a moment." });
  assert.equal(classifyStartupFailure({ status: 401, code: "AUTH_BEARER_REJECTED" }).kind, "AUTH");
  assert.equal(classifyStartupFailure({ status: 404 }).transient, false);
});

test("transient fetch and 504 failures retry with bounded backoff then recover", async () => {
  let calls = 0;
  const sleeps = [];
  const result = await withTransientStartupRetry(async () => {
    calls += 1;
    if (calls === 1) throw new TypeError("Network request failed");
    if (calls === 2) throw { status: 504 };
    return "ready";
  }, { operationName: "test", sleep: async (ms) => { sleeps.push(ms); } });
  assert.equal(result, "ready");
  assert.equal(calls, 3);
  assert.equal(sleeps.length, 2);
});

test("permanent 4xx does not retry and attempts are capped", async () => {
  let permanentCalls = 0;
  await assert.rejects(withTransientStartupRetry(async () => { permanentCalls += 1; throw { status: 404 }; }, { operationName: "test", sleep: async () => {} }));
  assert.equal(permanentCalls, 1);
  let transientCalls = 0;
  await assert.rejects(withTransientStartupRetry(async () => { transientCalls += 1; throw { status: 503 }; }, { operationName: "test", sleep: async () => {} }));
  assert.equal(transientCalls, 3);
});

test("startup screen uses generation, single-flight, manual retry, and safe recovery order", () => {
  const source = fs.readFileSync(path.join(__dirname, "../app/index.tsx"), "utf8");
  assert.match(source, /const currentGeneration = \+\+generation\.current/);
  assert.match(source, /bootstrapInFlight\.current/);
  assert.match(source, /withTransientStartupRetry/);
  assert.match(source, /api\.startupActiveMatch\(\)/);
  assert.match(source, /if \(!bootstrapInFlight\.current\) setAttempt/);
  assert.doesNotMatch(source, /peekBootstrapPlayer/);
});

test("critical startup timeouts allow backend wake-up without changing ordinary requests", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/api.ts"), "utf8");
  assert.match(source, /REQUEST_TIMEOUT_MS = 8000/);
  assert.match(source, /GUEST_BOOTSTRAP_TIMEOUT_MS = 20000/);
  assert.match(source, /PLAYER_BOOTSTRAP_TIMEOUT_MS = 18000/);
  assert.match(source, /STARTUP_RECOVERY_TIMEOUT_MS = 12000/);
  assert.match(source, /credentialsPromise: Promise<GuestCredentials> \| null/);
});

test("production deployment skew treats only a missing optional PvP startup route as absent", () => {
  assert.equal(isOptionalStartupRouteMissing({ status: 404 }), true);
  assert.equal(isOptionalStartupRouteMissing({ status: 401 }), false);
  assert.equal(isOptionalStartupRouteMissing({ status: 500 }), false);
  const api = fs.readFileSync(path.join(__dirname, "../src/api.ts"), "utf8");
  const startup = fs.readFileSync(path.join(__dirname, "../app/index.tsx"), "utf8");
  assert.match(api, /startupActivePvpMatch:[\s\S]*isOptionalStartupRouteMissing/);
  assert.match(startup, /api\.startupActivePvpMatch\(\)/);
  assert.doesNotMatch(startup, /\(\) => api\.activePvpMatch\(\)/);
});

test("fresh player parser validates core state and tolerates optional new-player fields", () => {
  const player = validateBootstrapPlayer({
    player_id: "guest_test",
    tutorial_done: false,
    optional_future_system: null,
  });
  assert.equal(player.player_id, "guest_test");
  assert.equal(player.tutorial_done, false);
  assert.equal(player.welcome_reward_claimed, false);
  assert.equal(player.optional_future_system, null);
  assert.throws(() => validateBootstrapPlayer("not-json-object"), PlayerSchemaError);
  assert.throws(() => validateBootstrapPlayer({ tutorial_done: false }), /core identity/);
  assert.throws(() => validateBootstrapPlayer({ player_id: "guest_test", tutorial_done: null }), /tutorial state/);
});

test("release-safe startup diagnostics distinguish operation and failure class", () => {
  assert.equal(startupDiagnosticCode(new TypeError("Network request failed"), "PLAYER_FETCH"), "PLAYER_FETCH_NETWORK");
  assert.equal(startupDiagnosticCode({ status: 404 }, "PLAYER_FETCH"), "PLAYER_FETCH_HTTP");
  assert.equal(startupDiagnosticCode({ status: 404 }, "ACTIVE_PVP"), "ACTIVE_PVP_HTTP");
  assert.equal(startupDiagnosticCode(new PlayerSchemaError("bad"), "PLAYER_FETCH"), "PLAYER_SCHEMA");
  assert.equal(startupDiagnosticCode({ status: 503 }, "PLAYER_FETCH", "AUTH_STAGE_BOOTSTRAP_SENT"), "GUEST_CREATE_NETWORK");
  const source = fs.readFileSync(path.join(__dirname, "../app/index.tsx"), "utf8");
  assert.match(source, /Diagnostic \{failure\.startupCode\}/);
  assert.doesNotMatch(source, /Diagnostic[^\n]*(authToken|playerId|installationId)/);
});
