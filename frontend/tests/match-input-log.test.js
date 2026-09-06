const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { VALIDATION_VERSION, createInputLogBuffer, hasValidInputEvidence } = require("../src/game/inputLog.js");
const { ACTIVE_MATCH_INPUT_LOG_KEY, createActiveMatchInputLogPersistence } = require("../src/game/activeMatchInputLog.js");
const { createResultSubmissionCoordinator } = require("../src/game/resultSubmission.js");

test("input events are compact, sequenced, and match-relative", () => {
  const times = [10_000, 10_080, 10_075, 10_240];
  const log = createInputLogBuffer(() => times.shift());
  log.start();
  assert.equal(log.record("BITE", { source: "CONTROL", x: 0.5, y: 0.5 }, 10_080), true);
  assert.equal(log.record("SLICE", { source: "CONTROL", start_x: 0.1, start_y: 0.5, end_x: 0.9, end_y: 0.5, duration_ms: 180 }, 10_075), true);
  assert.equal(log.record("ANTACID", undefined, 10_240), true);
  assert.deepEqual(log.finish(), [
    { seq: 1, t_ms: 80, type: "BITE", source: "CONTROL", x: 0.5, y: 0.5 },
    { seq: 2, t_ms: 80, type: "SLICE", source: "CONTROL", start_x: 0.1, start_y: 0.5, end_x: 0.9, end_y: 0.5, duration_ms: 180 },
    { seq: 3, t_ms: 240, type: "ANTACID" },
  ]);
});

test("completed input log is frozen and reused by retry", async () => {
  let now = 5_000;
  const log = createInputLogBuffer(() => now);
  log.start();
  now += 120;
  log.record("BITE", { source: "CONTROL", x: 0.5, y: 0.5 }, now);
  const completed = log.finish();
  assert.strictEqual(log.finish(), completed);
  assert.equal(log.record("BITE"), false);

  const calls = [];
  const coordinator = createResultSubmissionCoordinator(async (payload) => { calls.push(payload); return {}; });
  const payload = coordinator.preserve({ match_id: "match-a", input_events: completed });
  await coordinator.submit();
  await coordinator.submit();
  assert.strictEqual(calls[0], calls[1]);
  assert.strictEqual(calls[0].input_events, completed);
  assert.strictEqual(payload.input_events, completed);
});

test("play route validates official evidence before scoring and freezes it into result submission", () => {
  const play = fs.readFileSync(path.join(__dirname, "../app/play/[contestId].tsx"), "utf8");
  assert.match(play, /hasValidInputEvidence\(\{ type: actionType, \.\.\.evidence \}\)\) return null;[\s\S]*const acceptedActionSequence = tapLatest\(actionNow\)/);
  assert.match(play, /inputLog\.start\(matchDurationSeconds \* 1000, matchStartedAt\.current \?\? actionNow\);[\s\S]*if \(!inputLog\.canRecord\(\)\) return false;[\s\S]*const used = applyAntacid\(actionNow\)/);
  assert.match(play, /if \(!used\) return false;[\s\S]*if \(!inputLog\.record\("ANTACID", undefined, actionNow\)\) return false/);
  assert.match(play, /const finalizedInputEvents = inputLog\.finish\(\)[\s\S]*input_events: finalizedInputEvents/);
  assert.match(play, /validation_version: 3/);
});

function memoryStorage() {
  const values = new Map();
  return {
    values,
    async getItem(key) { return values.get(key) ?? null; },
    async setItem(key, value) { values.set(key, value); },
    async removeItem(key) { values.delete(key); },
  };
}

const authority = {
  matchId: "match-a",
  contestId: "nathans",
  serverStartedAt: "2026-08-16T12:00:00.000Z",
  serverTime: "2026-08-16T12:00:05.000Z",
  durationMs: 60000,
};

test("persisted input log restores only for the same authoritative match", async () => {
  const storage = memoryStorage();
  let now = 1000;
  const original = createInputLogBuffer(() => now);
  const persistence = createActiveMatchInputLogPersistence(storage);
  await persistence.bind({ ...authority, serverTime: authority.serverStartedAt }, original);
  original.start(authority.durationMs, now);
  original.record("BITE", { source: "CONTROL", x: 0.5, y: 0.5 }, now);
  now += 300;
  original.record("BITE", { source: "CONTROL", x: 0.5, y: 0.5 }, now);
  await persistence.flush(original, { version: 1, recoverable: true });

  const recovered = createInputLogBuffer(() => now);
  const result = await createActiveMatchInputLogPersistence(storage).bind(authority, recovered);
  assert.equal(result.status, "restored");
  assert.equal(recovered.snapshot().next_sequence, 3);
  assert.equal(recovered.record("BITE", { source: "CONTROL", x: 0.5, y: 0.5 }, result.localOrigin + 100), true);
  assert.equal(recovered.finish()[2].seq, 3);
  assert.ok(recovered.finish()[2].t_ms >= 5000);
});

test("stale match persistence is discarded and settled cleanup removes it", async () => {
  const storage = memoryStorage();
  storage.values.set(ACTIVE_MATCH_INPUT_LOG_KEY, JSON.stringify({
    schema_version: 1, validation_version: 3, match_id: "old-match", contest_id: "nathans",
    server_started_at: authority.serverStartedAt, next_sequence: 1, finalized: false, input_events: [],
  }));
  const persistence = createActiveMatchInputLogPersistence(storage);
  const result = await persistence.bind(authority, createInputLogBuffer(() => 0));
  assert.equal(result.status, "discarded");
  await persistence.flush(createInputLogBuffer(() => 0), null);
  await persistence.clear();
  assert.equal(storage.values.has(ACTIVE_MATCH_INPUT_LOG_KEY), false);
});

test("geometry metadata survives persistence and sequence capacity is checked before scoring", async () => {
  const storage = memoryStorage();
  let now = 0;
  const buffer = createInputLogBuffer(() => now);
  const persistence = createActiveMatchInputLogPersistence(storage);
  await persistence.bind({ ...authority, serverTime: authority.serverStartedAt }, buffer);
  buffer.start(authority.durationMs, now);
  assert.equal(buffer.canRecord(), true);
  buffer.record("SLICE", { source: "CONTROL", start_x: 0.1, start_y: 0.5, end_x: 0.9, end_y: 0.5, duration_ms: 180 }, now);
  await persistence.flush(buffer, null);
  const restored = createInputLogBuffer(() => now);
  await createActiveMatchInputLogPersistence(storage).bind(authority, restored);
  assert.deepEqual(restored.finish()[0], buffer.finish()[0]);
});



test("live input recording rejects malformed v2 evidence", () => {
  const log = createInputLogBuffer(() => 1000);
  log.start();
  assert.equal(log.record("BITE"), false);
  assert.equal(log.record("BITE", { source: "CONTROL", x: 1.2, y: 0.5 }, 1000), false);
  assert.equal(log.record("SLICE", { source: "CONTROL", start_x: 0.1, start_y: 0.5, end_x: 0.9, end_y: 0.5, duration_ms: 180 }, 1000), true);
  assert.deepEqual(log.finish(), [{ seq: 1, t_ms: 0, type: "SLICE", source: "CONTROL", start_x: 0.1, start_y: 0.5, end_x: 0.9, end_y: 0.5, duration_ms: 180 }]);
});
test("restored v2 logs reject legacy events without authoritative geometry", () => {
  assert.equal(hasValidInputEvidence({ seq: 1, t_ms: 100, type: "BITE" }), false);
  assert.equal(hasValidInputEvidence({ seq: 1, t_ms: 100, type: "BITE", source: "CONTROL", x: 0.5, y: 0.5 }), true);
  const restored = createInputLogBuffer(() => 1000);
  assert.equal(restored.restore({ events: [{ seq: 1, t_ms: 100, type: "BITE" }], finalized: false }, 100, 60000), false);
});
test("recovered final log stays frozen and retry reuses the identical payload", async () => {
  const storage = memoryStorage();
  let now = 0;
  const first = createInputLogBuffer(() => now);
  const persistence = createActiveMatchInputLogPersistence(storage);
  await persistence.bind({ ...authority, serverTime: authority.serverStartedAt }, first);
  first.start(authority.durationMs, now);
  first.record("BITE", { source: "CONTROL", x: 0.5, y: 0.5 }, now);
  first.finish();
  await persistence.flush(first, { version: 1 }, true);
  const restored = createInputLogBuffer(() => now);
  const recovery = await createActiveMatchInputLogPersistence(storage).bind(authority, restored);
  assert.equal(recovery.finalized, true);
  assert.equal(restored.record("BITE"), false);
  const log = restored.finish();
  const calls = [];
  const coordinator = createResultSubmissionCoordinator(async (payload) => { calls.push(payload); return {}; });
  const payload = coordinator.preserve({ match_id: "match-a", input_events: log });
  await coordinator.submit();
  await coordinator.submit();
  assert.strictEqual(calls[0], calls[1]);
  assert.strictEqual(payload.input_events, log);
});

test("persistence remains bounded and never serializes a server seed", async () => {
  const storage = memoryStorage();
  let now = 0;
  const buffer = createInputLogBuffer(() => now++);
  const persistence = createActiveMatchInputLogPersistence(storage);
  await persistence.bind({ ...authority, serverTime: authority.serverStartedAt, match_seed: "must-not-persist" }, buffer);
  buffer.start(authority.durationMs, 0);
  for (let index = 0; index < 2100; index += 1) buffer.record("BITE", { source: "CONTROL", x: 0.5, y: 0.5 }, index);
  assert.equal(buffer.finish().length, 2000);
  await persistence.flush(buffer, { version: 1 }, true);
  const serialized = storage.values.get(ACTIVE_MATCH_INPUT_LOG_KEY);
  assert.doesNotMatch(serialized, /match_seed|must-not-persist/);
});

test("account deletion and confirmed guest reset clear persisted active-match telemetry", () => {
  const api = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "src", "api.ts"), "utf8");
  assert.match(api, /PLAYER_DATA_KEYS = \[[\s\S]*"firefeast_active_match_input_log_v2"/);
  assert.match(api, /clearLocalGuestData\(\)[\s\S]*\.\.\.PLAYER_DATA_KEYS/);
  assert.match(api, /const asyncKeys = \[[\s\S]*\.\.\.PLAYER_DATA_KEYS/);
});

test("final flush supersedes a scheduled write and clear cannot be resurrected", async () => {
  const storage = memoryStorage();
  const timers = [];
  let now = 0;
  const buffer = createInputLogBuffer(() => now);
  const persistence = createActiveMatchInputLogPersistence(storage, {
    setTimer(callback) { timers.push(callback); return timers.length; },
    clearTimer() {},
  });
  await persistence.bind({ ...authority, serverTime: authority.serverStartedAt }, buffer);
  buffer.start(authority.durationMs, now);
  buffer.record("BITE", { source: "CONTROL", x: 0.5, y: 0.5 }, now);
  persistence.schedule(buffer, () => ({ version: 1, scoreRaw: 1 }));
  buffer.finish();
  await persistence.flush(buffer, { version: 1, scoreRaw: 1 }, true);
  const stored = JSON.parse(storage.values.get(ACTIVE_MATCH_INPUT_LOG_KEY));
  assert.equal(stored.finalized, true);
  for (const timer of timers) timer();
  await persistence.clear();
  assert.equal(storage.values.has(ACTIVE_MATCH_INPUT_LOG_KEY), false);
});

test("Build19 input log records explicit accepted-action timestamps without duration clamping", () => {
  let now = 1000;
  const log = createInputLogBuffer(() => now);
  log.start(30_000);
  assert.equal(log.record("BITE", { source: "CONTROL", x: 0.5, y: 0.5 }, 30_900), true);
  assert.deepEqual(log.finish(), [
    { seq: 1, t_ms: 29_900, type: "BITE", source: "CONTROL", x: 0.5, y: 0.5 },
  ]);
  assert.equal(log.snapshot().validation_version, VALIDATION_VERSION);
  assert.equal(VALIDATION_VERSION, 3);
});

test("Build19 explicit timestamps keep distinct terminal actions instead of collapsing to duration", () => {
  let now = 1000;
  const log = createInputLogBuffer(() => now);
  log.start(30_000);
  assert.equal(log.record("BITE", { source: "CONTROL", x: 0.5, y: 0.5 }, 30_900), true);
  assert.equal(log.record("BITE", { source: "CONTROL", x: 0.5, y: 0.5 }, 31_020), true);
  assert.deepEqual(log.finish().map((event) => event.t_ms), [29_900, 30_020]);
});

test("Build19 v3 recording fails closed without an explicit accepted-action timestamp", () => {
  let now = 1000;
  const log = createInputLogBuffer(() => now);
  log.start(30_000, now);
  now = 31_000;
  assert.equal(log.record("BITE", { source: "CONTROL", x: 0.5, y: 0.5 }), false);
  assert.deepEqual(log.finish(), []);
});

test("Build18 implicit recording can collapse many late events to the duration cap", () => {
  let now = 1000;
  const log = createInputLogBuffer(() => now, { requireExplicitTimestamps: false });
  log.start(30_000);
  const times = [31_000, 31_050, 31_100, 31_150];
  for (const timestamp of times) {
    now = timestamp;
    assert.equal(log.record("BITE", { source: "CONTROL", x: 0.5, y: 0.5 }), true);
  }
  assert.deepEqual(log.finish().map((event) => event.t_ms), [30_000, 30_000, 30_000, 30_000]);
});

test("play route samples one action timestamp for scoring and official evidence", () => {
  const play = fs.readFileSync(path.join(__dirname, "../app/play/[contestId].tsx"), "utf8");
  const tap = play.slice(play.indexOf("const handleTap = useCallback"), play.indexOf("const handleUseAntacid"));
  assert.ok(tap.indexOf("const actionNow = Date.now()") < tap.indexOf("tapLatest(actionNow)"));
  assert.ok(tap.indexOf("tapLatest(actionNow)") < tap.indexOf("inputLog.record(actionType, evidence, actionNow)"));
  const antacid = play.slice(play.indexOf("const handleUseAntacid = useCallback"), play.indexOf("const abandonAndReturn"));
  assert.ok(antacid.indexOf("const actionNow = Date.now()") < antacid.indexOf("applyAntacid(actionNow)"));
  assert.ok(antacid.indexOf("applyAntacid(actionNow)") < antacid.indexOf("inputLog.record(\"ANTACID\", undefined, actionNow)"));
});

test("play route starts v3 input evidence from the same match-time origin as gameplay", () => {
  const play = fs.readFileSync(path.join(__dirname, "../app/play/[contestId].tsx"), "utf8");
  assert.match(play, /const originNow = Date\.now\(\);[\s\S]*matchStartedAt\.current = originNow;[\s\S]*inputLog\.start\(matchDurationSeconds \* 1000, originNow\)/);
  assert.match(play, /const recoveryOrigin = typeof recovery\.localOrigin === "number" \? recovery\.localOrigin : Date\.now\(\);[\s\S]*matchStartedAt\.current = recoveryOrigin - recovery\.authoritativeElapsedMs/);
  const tap = play.slice(play.indexOf("const handleTap = useCallback"), play.indexOf("const handleUseAntacid"));
  assert.ok(tap.indexOf("inputLog.start(matchDurationSeconds * 1000, matchStartedAt.current ?? actionNow)") < tap.indexOf("tapLatest(actionNow)"));
});

test("play route rejects post-deadline actions before gameplay mutation", () => {
  const play = fs.readFileSync(path.join(__dirname, "../app/play/[contestId].tsx"), "utf8");
  const tap = play.slice(play.indexOf("const handleTap = useCallback"), play.indexOf("const handleUseAntacid"));
  assert.ok(tap.indexOf("elapsedMs > matchDurationSeconds * 1000") < tap.indexOf("tapLatest(actionNow)"));
  const antacid = play.slice(play.indexOf("const handleUseAntacid = useCallback"), play.indexOf("const abandonAndReturn"));
  assert.ok(antacid.indexOf("actionNow - matchStartedAt.current > matchDurationSeconds * 1000") < antacid.indexOf("applyAntacid(actionNow)"));
});
