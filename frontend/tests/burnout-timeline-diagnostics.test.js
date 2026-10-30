/* global __dirname */
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { createInputLogBuffer, VALIDATION_VERSION } = require("../src/game/inputLog.js");
const { createResultSubmissionCoordinator } = require("../src/game/resultSubmission.js");

const evidence = { source: "CONTROL", x: 0.5, y: 0.5 };
const plain = (value) => JSON.parse(JSON.stringify(value));
const backendRoot = path.resolve(__dirname, "../../backend");
const playSource = fs.readFileSync(path.join(__dirname, "../app/play/[contestId].tsx"), "utf8");
const { harness } = require("./helpers/gameplay-harness");
const backendActive = {
  allowed_duration_sec: 60,
  challenge_config: {
    bite_mechanic: "tap",
    contest_id: "nathans-hotdogs",
    heat_per_tap: 5,
  },
  perk_modifiers: {
    tap_power: 1,
    combo_window_ms: 700,
    score_multiplier: 1,
    heat_generation_multiplier: 1,
  },
  starting_antacid: 0,
};

function runBackendReplay(events, durationSeconds = 60) {
  const script = `
import json
import sys
sys.path.insert(0, r"${backendRoot}")
from services.match_validation import replay_input_log, InputReplayError
active = json.loads(sys.argv[1])
events = json.loads(sys.argv[2])
try:
    result = replay_input_log(active, events, 3)
    print(json.dumps({"accepted": True, "result": result}))
except InputReplayError as error:
    print(json.dumps({"accepted": False, "reason": error.reason, "details": error.details}))
`;
  const output = execFileSync("python", ["-B", "-c", script, JSON.stringify({ ...backendActive, allowed_duration_sec: durationSeconds }), JSON.stringify(events)], {
    cwd: path.resolve(__dirname, ".."),
    encoding: "utf8",
  });
  return JSON.parse(output);
}

function buildSharedFreshHistory() {
  return Array.from({ length: 20 }, (_, index) => ({
    seq: index + 1,
    t_ms: (index + 1) * 100,
    type: "BITE",
    ...evidence,
  }));
}

// Synthetic accepted prefixes generate the exact reported penalty intervals;
// the production payloads themselves were not supplied.
function prefixForPenalty(loop, start, previousTime) {
  let events = [];
  for (let i = 0; i < 100; i++) {
    events.push({ seq: i + 1, t_ms: i * 100, type: "BITE", ...evidence });
    const gate = loop.getReplayBurnoutGate(events, i * 100);
    if (gate.warningUntil) {
      const offset = start - gate.warningUntil;
      events = events.map(e => ({ ...e, t_ms: e.t_ms + offset }));
      events.push({ seq: events.length + 1, t_ms: previousTime, type: "BITE", ...evidence });
      return events;
    }
  }
  throw new Error("fixture never reached warning");
}

for (const [label, start, end, candidate, previous] of [
  ["Failure 1", 11623, 13123, 12183, 10907],
  ["Failure 2", 25055, 26555, 25177, 24999],
]) {
  for (const recovered of [false, true]) {
    for (const [time, accepted] of [[candidate, false], [start - 1, true], [start, false], [start + 1, false], [end - 1, false], [end, true], [end + 1, true]]) {
      test(`${label}: ${recovered ? "recovered" : "fresh"} replay gate at ${time} accepts=${accepted}`, () => {
        const h = harness(), log = createInputLogBuffer();
        const events = prefixForPenalty(h.loop, start, previous);
        const backend = runBackendReplay([...events, { seq: events.length + 1, t_ms: time, type: "BITE", ...evidence }]);
        assert.equal(backend.accepted, accepted);
        if (!backend.accepted) {
          assert.equal(backend.reason, "action_during_burnout");
          assert.equal(backend.details.event_t_ms, time);
          assert.equal(backend.details.burnout_start_ms, start);
          assert.equal(backend.details.burnout_end_ms, end);
        }
        const origin = 50000;
        if (recovered) {
          assert.equal(log.restore({ events, finalized: false }, previous, 60000, origin), true);
          h.setNow(origin + time - previous);
        } else {
          log.start(60000, origin);
          for (const event of events) assert.equal(log.recordAtElapsed(event.type, evidence, event.t_ms), true);
          h.setNow(origin + time);
        }
        const before = plain(h.loop.getBurnoutDiagnostics(h.now()));
        const handler = h.handler(log, recovered ? origin - previous : origin);
        const result = handler.tap(evidence);
        const diagnostic = JSON.parse(h.records.at(-1)[1]);
        assert.equal(result !== null, accepted);
        assert.equal(diagnostic.replayGate.t_ms, time);
        assert.equal(diagnostic.replayGate.canAccept, accepted);
        assert.equal(log.events().length, events.length + Number(accepted));
        if (accepted) {
          assert.equal(log.events().at(-1).t_ms, diagnostic.replayGate.t_ms);
          assert.equal(diagnostic.recordedEventTime, time);
          assert.equal(h.loop.getBurnoutDiagnostics(h.now()).acceptedTapCount, before.acceptedTapCount + 1);
          assert.equal(handler.calls.filter(c => c[0] === "tap").length, 1);
          assert.equal(handler.calls.filter(c => c[0] === "record").length, 1);
        } else {
          assert.deepEqual(plain(h.loop.getBurnoutDiagnostics(h.now())), before);
          assert.deepEqual(handler.calls, []);
          assert.equal(diagnostic.rejectionReason, "REPLAY_BURNOUT_REJECTED");
          assert.equal(diagnostic.replayGate.penaltyUntil, end);
        }
      });
    }
  }
}

test("burnout cooling resumes at warning deadline, never across the warning window", () => {
  const h = harness();
  h.loop.tap(10000);
  h.setNow(13500);
  assert.notEqual(h.loop.tap(13500), null);
  const biteHeat = h.loop.getReplayBurnoutGate([{ seq: 1, type: "BITE", t_ms: 0, ...evidence }], 0).heat;
  assert.equal(h.loop.getBurnoutDiagnostics(13500).heat, 68 - 9 * 1.5 + biteHeat);
});

test("ordered candidate time is recorded unchanged after a backwards clock observation", () => {
  const log = createInputLogBuffer(); log.start(60000, 50000);
  log.recordAtElapsed("BITE", evidence, 1000);
  const time = log.eventTimeFor(50999);
  assert.equal(time, 1000);
  assert.equal(log.recordAtElapsed("BITE", evidence, time), true);
  assert.deepEqual(log.events().map(e => e.t_ms), [1000, 1000]);
  assert.equal(log.recordAtElapsed("BITE", evidence, 999), false);
});


test("replay warning save and shield use accepted antacid event time", () => {
  const h = harness();
  const events = prefixForPenalty(h.loop, 11623, 10907);
  events.push({ seq: events.length + 1, t_ms: 11000, type: "ANTACID" });
  const gate = h.loop.getReplayBurnoutGate(events, 12183);
  assert.equal(gate.canAccept, true);
  assert.equal(gate.warningUntil, 0);
  assert.equal(gate.penaltyUntil, 0);
  assert.ok(gate.heat < 70);
  const before = JSON.stringify(events);
  h.loop.getReplayBurnoutGate(events, 14000);
  assert.equal(JSON.stringify(events), before);
});

test("recovered cooling remains active even when the saved heat shield extends beyond the cooling start", () => {
  const h = harness();
  const saved = {
    version: 1,
    capturedElapsedMs: 1000,
    scoreRaw: 0,
    combo: 0,
    maximumCombo: 0,
    acceptedTapCount: 1,
    completedProgress: 1,
    heartburn: 50,
    antacidCount: 0,
    lastTapMs: 900,
    heatProtectionUntilMs: 3000,
    freshStomachUntilMs: 0,
    lastOverheatAtMs: null,
    criticalCycleActive: false,
    perfectCooldownEligible: false,
    recoverable: true,
  };

  for (const [elapsedMs, expectedHeat] of [[2500, 39.65], [3000, 35.15], [4000, 26.15]]) {
    assert.equal(h.loop.resumeGame(saved, elapsedMs), true);
    assert.ok(Math.abs(h.loop.getBurnoutDiagnostics(elapsedMs).heat - expectedHeat) < 0.0001);
  }
});

// These helpers exercise frontend production code only. Backend answers always
// come from the Python replay result, including every appended candidate.
function freshGameplay() {
  const h = harness(true, undefined, true);
  const log = createInputLogBuffer();
  log.start(60000, 10000);
  return { h, log, origin: 10000 };
}

function playHistory(state, events) {
  const handler = state.h.handler(state.log, state.origin);
  for (const event of events) {
    state.h.setNow(state.origin + event.t_ms);
    assert.notEqual(handler.tap(evidence), null);
    assert.deepEqual(state.log.events().at(-1), event);
    if (state.h.loop.getBurnoutDiagnostics(state.h.now()).warningEndsAt && state.warningStartedAt === undefined) {
      state.warningStartedAt = event.t_ms;
    }
    if (state.h.loop.getReplayBurnoutGate(state.log.events(), event.t_ms).warningUntil && state.replayWarningStartedAt === undefined) {
      state.replayWarningStartedAt = event.t_ms;
    }
  }
}

function backendSuccess(events, durationSeconds = 60) {
  const backend = runBackendReplay(events, durationSeconds);
  assert.equal(backend.accepted, true, JSON.stringify(backend));
  assert.equal(backend.result.validation_version, 3);
  assert.equal(backend.result.input_event_count, events.length);
  return backend.result;
}

const roundedHeat = value => Number(value.toFixed(3)); // Backend diagnostics serialize three decimal places.

for (const recovered of [false, true]) {
  test(`${recovered ? "recovered" : "fresh"} full parity uses canonical history and real backend candidate results`, () => {
    const preRecovery = buildSharedFreshHistory().slice(0, 10);
    const recoveryAt = 4000;
    const postRecovery = Array.from({ length: 15 }, (_, index) => ({
      seq: preRecovery.length + index + 1, t_ms: recoveryAt + index * 100, type: "BITE", ...evidence,
    }));
    const history = recovered ? [...preRecovery, ...postRecovery] : buildSharedFreshHistory();

    function setup() {
      let state = freshGameplay();
      if (!recovered) {
        playHistory(state, history);
        return state;
      }
      playHistory(state, preRecovery);
      const saved = plain(state.h.loop.captureRecoveryState(1000));
      const backendSaved = backendSuccess(preRecovery, 1);
      assert.equal(saved.recoverable, true);
      assert.equal(roundedHeat(saved.heartburn), backendSaved.final_heat);
      assert.equal(roundedHeat(state.h.loop.getReplayBurnoutGate(preRecovery, 1000).heat), backendSaved.final_heat);
      // This history ends with a bite at 1000 and has no shield. It is separate
      // from the standalone saved last-bite=900 / shield=3000 / 26.15 fixture.
      const backendResumed = backendSuccess(preRecovery, recoveryAt / 1000);
      const resumed = freshGameplay();
      resumed.origin = 50000 - recoveryAt;
      resumed.h.setNow(50000);
      assert.equal(resumed.h.loop.resumeGame(saved, recoveryAt), true);
      resumed.log = createInputLogBuffer();
      assert.equal(resumed.log.restore({ events: preRecovery, finalized: false }, recoveryAt, 60000, 50000), true);
      const recoveredHeat = resumed.h.loop.getBurnoutDiagnostics(50000).heat;
      assert.equal(roundedHeat(recoveredHeat), backendResumed.final_heat);
      assert.equal(roundedHeat(resumed.h.loop.getReplayBurnoutGate(preRecovery, recoveryAt).heat), backendResumed.final_heat);
      assert.equal(roundedHeat(saved.heartburn - recoveredHeat), roundedHeat(backendSaved.final_heat - backendResumed.final_heat));
      state = resumed;
      playHistory(state, postRecovery);
      return state;
    }

    const backendHistory = backendSuccess(history);
    const warningStart = backendHistory.diagnostics.warning_started_at_ms;
    assert.equal(warningStart, history.at(-1).t_ms);
    // Timestamps select probes; the real rejection supplies both endpoints.
    const probe = runBackendReplay([...history, { seq: history.length + 1, t_ms: warningStart + 2000, type: "BITE", ...evidence }]);
    assert.equal(probe.accepted, false);
    assert.equal(probe.reason, "action_during_burnout");
    const penaltyStart = probe.details.burnout_start_ms;
    const penaltyEnd = probe.details.burnout_end_ms;
    const warningSnapshot = backendHistory.diagnostics.event_windows.find(event => event.t_ms === warningStart && event.warning_active);
    assert.ok(warningSnapshot);

    for (const [candidate, expectedAcceptance] of [[penaltyStart - 1, true], [penaltyStart, false], [penaltyStart + 1, false], [penaltyEnd - 1, false], [penaltyEnd, true], [penaltyEnd + 1, true]]) {
      const state = setup();
      const { h, log, origin } = state;
      assert.equal(state.warningStartedAt, warningStart);
      assert.equal(state.replayWarningStartedAt, warningStart);
      assert.deepEqual(log.events(), history);
      const historyGate = h.loop.getReplayBurnoutGate(history, history.at(-1).t_ms);
      const gameplay = h.loop.getBurnoutDiagnostics(h.now());
      assert.equal(roundedHeat(gameplay.heat), warningSnapshot.heat_after);
      assert.equal(roundedHeat(historyGate.heat), warningSnapshot.heat_after);
      assert.equal(gameplay.warningEndsAt - origin, penaltyStart);
      assert.equal(historyGate.warningUntil, penaltyStart);
      assert.equal(gameplay.authoritativeBurnoutUntil - origin, penaltyEnd);
      const candidateEvent = { seq: history.length + 1, t_ms: candidate, type: "BITE", ...evidence };
      const backend = runBackendReplay([...history, candidateEvent]);
      assert.equal(backend.accepted, expectedAcceptance, JSON.stringify({ candidate, backend }));
      const gate = h.loop.getReplayBurnoutGate(history, candidate);
      assert.equal(gate.canAccept, backend.accepted, JSON.stringify({ candidate, backend }));
      h.setNow(origin + candidate);
      const before = plain(h.loop.getBurnoutDiagnostics(h.now()));
      assert.equal(before.canAccept, backend.accepted);
      const handler = h.handler(log, origin);
      assert.equal(handler.tap(evidence) !== null, backend.accepted);
      const diagnostic = JSON.parse(h.records.at(-1)[1]);
      assert.equal(diagnostic.replayGate.t_ms, candidate);
      if (backend.accepted) {
        assert.equal(backend.result.input_event_count, history.length + 1);
        assert.deepEqual(log.events().at(-1), candidateEvent);
        assert.equal(diagnostic.recordedEventTime, diagnostic.replayGate.t_ms);
        const snapshot = backend.result.diagnostics.event_windows.find(event => event.event_index === candidateEvent.seq);
        assert.ok(snapshot, "backend must expose candidate heat and timestamp");
        assert.equal(snapshot.t_ms, candidate);
        if (candidate >= penaltyEnd) {
          assert.equal(backend.result.diagnostics.burnout_started_at_ms, penaltyStart);
          assert.equal(snapshot.warning_active, false);
          assert.equal(snapshot.burnout_active, false);
          assert.equal(gate.warningUntil, 0);
          assert.equal(gate.penaltyUntil, 0);
        } else {
          assert.equal(snapshot.warning_active, true);
          assert.equal(gate.warningUntil, penaltyStart);
        }
        assert.equal(roundedHeat(gate.heat), snapshot.heat_before);
        assert.equal(roundedHeat(h.loop.getBurnoutDiagnostics(h.now()).heat), snapshot.heat_after);
        assert.equal(roundedHeat(h.loop.getReplayBurnoutGate(log.events(), candidate).heat), snapshot.heat_after);
      } else {
        assert.equal(backend.reason, "action_during_burnout");
        assert.equal(backend.details.event_t_ms, candidate);
        assert.equal(backend.details.burnout_start_ms, penaltyStart);
        assert.equal(backend.details.burnout_end_ms, penaltyEnd);
        assert.equal(gate.penaltyUntil, backend.details.burnout_end_ms);
        assert.equal(roundedHeat(gate.heat), backend.details.replayed_heat_before_action);
        assert.deepEqual(log.events(), history);
        assert.deepEqual(handler.calls, []);
        assert.deepEqual(plain(h.loop.getBurnoutDiagnostics(h.now())), before);
        assert.equal(diagnostic.rejectionReason, "REPLAY_BURNOUT_REJECTED");
      }
    }
  });
}

test("historical burnout violation fails closed instead of rewriting or skipping events", () => {
  const h = harness();
  const events = prefixForPenalty(h.loop, 11623, 10907);
  events.push({ seq: events.length + 1, t_ms: 12183, type: "BITE", ...evidence });
  const gate = h.loop.getReplayBurnoutGate(events, 14000);
  assert.equal(gate.canAccept, false);
  assert.equal(gate.validHistory, false);
  assert.equal(events.at(-1).t_ms, 12183);
});

// Exercise the real hook and action handler; only React, presentation, and timers
// are replaced. No network, device runtime, or backend code is loaded.

test("hook diagnostics are frozen/read-only and do not change gameplay, clocks, rendering, or timers", () => {
  const h = harness(); h.loop.tap(h.now());
  const before = plain(h.loop.getBurnoutDiagnostics(h.now())), metrics = h.metrics();
  for (const timestamp of [h.now(), h.now() + 500, h.now() + 5000]) {
    const snapshot = h.loop.getBurnoutDiagnostics(timestamp);
    assert.equal(Object.isFrozen(snapshot), true);
    assert.equal(Object.isFrozen(snapshot.lastScoringGate), true);
    assert.equal(Reflect.set(snapshot, "heat", -1), false);
    assert.equal(Reflect.set(snapshot, "warningEndsAt", -1), false);
    assert.equal(Reflect.set(snapshot.lastScoringGate, "now", -1), false);
  }
  assert.deepEqual(plain(h.loop.getBurnoutDiagnostics(h.now())), before);
  assert.deepEqual(h.metrics(), metrics);
  for (const key of ["heat", "warningEndsAt", "penaltyEndsAt", "score", "combo", "acceptedTapCount", "acceptedActionSequence"]) assert.equal(h.loop.getBurnoutDiagnostics(h.now())[key], before[key]);
});

test("boundary snapshots predict exact start/end with a delayed warning ref and transitioned penalty ref", () => {
  const h = harness(); h.loop.tap(h.now());
  const initial = h.loop.getBurnoutDiagnostics(h.now());
  const start = initial.warningEndsAt, end = initial.authoritativeBurnoutUntil;
  assert.ok(start > h.now()); assert.equal(end - start, 1500);
  for (const [timestamp, canAccept] of [[start - 1, true], [start, false], [start + 1, false], [end - 1, false], [end, true], [end + 1, true]]) {
    const snapshot = h.loop.getBurnoutDiagnostics(timestamp);
    assert.equal(snapshot.now, timestamp);
    assert.equal(snapshot.canAccept, canAccept);
    assert.equal(snapshot.warningEndsAt, start);
    assert.equal(snapshot.penaltyEndsAt, 0);
    assert.equal(snapshot.authoritativeBurnoutUntil, end);
  }
  h.setNow(start); assert.equal(h.loop.tap(start), null);
  for (const [timestamp, canAccept] of [[start - 1, false], [start, false], [start + 1, false], [end - 1, false], [end, true], [end + 1, true]]) {
    const snapshot = h.loop.getBurnoutDiagnostics(timestamp);
    assert.equal(snapshot.canAccept, canAccept);
    assert.equal(snapshot.warningEndsAt, 0);
    assert.equal(snapshot.penaltyEndsAt, end);
  }
});

for (const recovered of [false, true]) {
  test(`${recovered ? "recovered" : "normal"} origin and diagnostics match serialized timestamps without changing the log`, () => {
    const log = createInputLogBuffer(() => { throw new Error("diagnostics must not read clock"); });
    if (recovered) assert.equal(log.restore({ events: [], finalized: false }, 10907, 60000, 50000), true);
    else log.start(60000, 50000);
    const previewed = [];
    for (const timestamp of [51276, 51275, 120000]) {
      const info = log.getDiagnostics(timestamp);
      previewed.push(info.event_t_ms);
      assert.equal(Object.isFrozen(info), true);
      assert.equal(info.startedAt, 50000);
      assert.equal(info.elapsedBase, recovered ? 10907 : 0);
      assert.equal(info.recovered, recovered);
      assert.equal(info.authoritativeElapsedMs, recovered ? 10907 : null);
      assert.deepEqual(log.getDiagnostics(timestamp), info);
      assert.equal(log.record("BITE", evidence, timestamp), true);
      assert.equal(log.getDiagnostics(timestamp).nextSequence, info.nextSequence + 1);
      // No clock read needed to inspect the final event; finishing occurs below.
    }
    const frozen = log.finish();
    assert.deepEqual(frozen.map((e) => e.t_ms), previewed);
    assert.deepEqual(frozen.map((e) => e.t_ms), recovered ? [12183, 12183, 80907] : [1276, 1276, 70000]);
    assert.strictEqual(log.finish(), frozen);
    log.getDiagnostics(130000);
    assert.strictEqual(log.finish(), frozen);
    assert.equal(log.record("BITE", evidence, 130000), false);
    assert.deepEqual(Object.keys(frozen[0]), ["seq", "t_ms", "type", "source", "x", "y"]);
    log.clear(); assert.equal(log.getDiagnostics(1).recovered, false);
  });
}

test("actual handler reports identical gate/record timestamps, accepted sequence, and before/after heat", () => {
  const h = harness(), log = createInputLogBuffer();
  const handler = h.handler(log, 9000);
  assert.equal(handler.tap(evidence), 5);
  const diagnostic = JSON.parse(h.records[0][1]);
  assert.equal(h.records[0][0], "Fire Feast burnout timeline");
  assert.deepEqual(handler.calls, [["tap", 10000], ["record", 1000]]);
  assert.equal(diagnostic.replayGate.t_ms, 1000);
  assert.equal(diagnostic.recordedEventTime, diagnostic.replayGate.t_ms);
  assert.equal(diagnostic.actionNow, 10000);
  assert.equal(diagnostic.localGate.now, 10000);
  assert.equal(diagnostic.tapTimestamp, 10000);
  assert.equal(diagnostic.recordTimestamp, 1000);
  assert.equal(diagnostic.sameActionTimestamp, true);
  assert.equal(diagnostic.matchStartedAt, 9000);
  assert.equal(diagnostic.inputLog.startedAt, 9000);
  assert.equal(diagnostic.inputLog.event_t_ms, log.finish()[0].t_ms);
  assert.equal(diagnostic.before.heat, 99);
  assert.equal(diagnostic.after.heat, 100);
  assert.equal(diagnostic.acceptedActionIndex, 5);
  assert.equal(diagnostic.canRecord, true);
  assert.equal(diagnostic.recordSucceeded, true);
  assert.equal(diagnostic.rejectionReason, null);
});

test("recovered handler reports elapsed base, independent origins, and preserved timeline", () => {
  const h = harness(), log = createInputLogBuffer();
  log.restore({ events: [], finalized: false }, 10907, 60000, 9000);
  const handler = h.handler(log, 9000 - 10907);
  handler.tap(evidence);
  const diagnostic = JSON.parse(h.records[0][1]);
  assert.equal(diagnostic.inputLog.recovered, true);
  assert.equal(diagnostic.inputLog.authoritativeElapsedMs, 10907);
  assert.equal(diagnostic.inputLog.startedAt, 9000);
  assert.equal(diagnostic.matchStartedAt, -1907);
  assert.equal(diagnostic.inputLog.event_t_ms, 11907);
  assert.equal(log.finish()[0].t_ms, 11907);
});

test("rejected burnout attempt reports both stale and synchronized refs without logging an event", () => {
  const h = harness(), log = createInputLogBuffer();
  const handler = h.handler(log, 9000);
  handler.tap(evidence);
  const start = h.loop.getBurnoutDiagnostics(h.now()).warningEndsAt;
  h.setNow(start + 560);
  assert.equal(handler.tap(evidence), null);
  const diagnostic = JSON.parse(h.records[1][1]);
  assert.equal(diagnostic.before.warningEndsAt, start);
  assert.equal(diagnostic.before.penaltyEndsAt, 0);
  assert.equal(diagnostic.localGate.warningEndsAt, 0);
  assert.equal(diagnostic.localGate.penaltyEndsAt, start + 1500);
  assert.equal(diagnostic.localGate.canAccept, false);
  assert.equal(diagnostic.acceptedLocally, false);
  assert.equal(diagnostic.rejectionReason, "SCORING_GATE_REJECTED");
  assert.equal(diagnostic.recordTimestamp, null);
  assert.equal(diagnostic.recordSucceeded, null);
  assert.equal(log.finish().length, 1);
});

test("diagnostics enabled/disabled yield identical gameplay, input payload, and return values", () => {
  const runs = [[false, undefined], [true, undefined], [false, "1"]].map(([dev, flag]) => {
    const h = harness(dev, flag), log = createInputLogBuffer();
    const handler = h.handler(log, 9000), results = [];
    for (const timestamp of [10000, 10080, 11200, 12183, 13124, 13200]) {
      h.setNow(timestamp); results.push(handler.tap(evidence));
      if (h.context.burnoutTimelineDiagnosticsEnabled) h.loop.getBurnoutDiagnostics(timestamp + 50);
    }
    const { lastScoringGate, ...state } = h.loop.getBurnoutDiagnostics(h.now());
    assert.equal(h.records.length, dev || flag === "1" ? 6 : 0);
    return { results, state: plain(state), events: plain(log.finish()), metrics: h.metrics() };
  });
  assert.deepEqual(runs[0], runs[1]);
  assert.deepEqual(runs[0], runs[2]);
});

for (const [dev, flag, enabled] of [
  [true, undefined, true], [true, "0", true], [false, "1", true],
  [false, undefined, false], [false, "", false], [false, "0", false],
  [false, "true", false], [false, "yes", false], [false, "01", false], [false, " 1 ", false],
]) {
  test(`diagnostic enablement: DEV=${dev}, flag=${String(flag)} => ${enabled}`, () => {
    const h = harness(dev, flag), log = createInputLogBuffer();
    assert.equal(h.context.burnoutTimelineDiagnosticsEnabled, enabled);
    const handler = h.handler(log, 9000);
    assert.equal(handler.tap(evidence), 5);
    const events = log.finish();
    assert.equal(h.records.length, enabled ? 1 : 0);
    assert.equal(h.loop.getBurnoutDiagnostics(h.now()).lastScoringGate !== null, enabled);
    if (enabled) {
      const diagnostic = JSON.parse(h.records[0][1]);
      assert.equal(diagnostic.sameActionTimestamp, true);
      assert.equal(diagnostic.localGate.now, h.now());
      assert.equal(diagnostic.recordTimestamp, diagnostic.replayGate.t_ms);
      assert.equal(diagnostic.inputLog.event_t_ms, events[0].t_ms);
    }
    assert.deepEqual(events, [{ seq: 1, t_ms: 1000, type: "BITE", ...evidence }]);
    assert.doesNotMatch(JSON.stringify(events), /DIAGNOSTICS|diagnosticFlag|burnoutTimeline/);
  });
}

test("diagnostic logging failures cannot change an accepted action's return or event", () => {
  const h = harness(), log = createInputLogBuffer();
  const handler = h.handler(log, 9000);
  h.context.console.info = () => { throw new Error("sink unavailable"); };
  assert.equal(handler.tap(evidence), 5);
  assert.equal(log.finish().length, 1);
});

test("validation v3, frozen retry payload, and serialized coordinator remain authoritative", async () => {
  assert.equal(VALIDATION_VERSION, 3);
  const log = createInputLogBuffer(); log.start(60000, 9000);
  log.getDiagnostics(10000); log.record("BITE", evidence, 10000);
  const events = log.finish(), calls = [];
  let release;
  const coordinator = createResultSubmissionCoordinator(async (payload) => { calls.push(payload); await new Promise((resolve) => { release = resolve; }); return {}; });
  const preserved = coordinator.preserve({ match_id: "test", validation_version: 3, input_events: events });
  const first = coordinator.submit(), simultaneous = coordinator.submit();
  await Promise.resolve(); assert.equal(calls.length, 1); release(); await Promise.all([first, simultaneous]);
  log.getDiagnostics(20000);
  const retry = coordinator.submit(); await Promise.resolve(); release(); await retry;
  assert.strictEqual(calls[0], calls[1]); assert.strictEqual(calls[0], preserved);
  assert.deepEqual(Object.keys(preserved), ["match_id", "validation_version", "input_events"]);
  assert.deepEqual(Object.keys(log.snapshot()), ["validation_version", "next_sequence", "elapsed_ms", "finalized", "events"]);
  assert.match(playSource, /validation_version: 3/);
  const payloadSource = playSource.slice(playSource.indexOf("const completedPayload"), playSource.indexOf("const handleTap"));
  assert.ok(payloadSource.length > 0);
  assert.doesNotMatch(payloadSource, /getBurnoutDiagnostics|getDiagnostics|burnout timeline/);
});
