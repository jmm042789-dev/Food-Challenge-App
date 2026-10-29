const assert = require("node:assert/strict");
const test = require("node:test");
const { productionContests, runBackend, activeFor } = require("./helpers/backend-replay");
const { createMechanic, mountControl, mountHeavyBite } = require("./helpers/mechanic-driver");
const contests = productionContests();

test("production inventory includes each of the six contests and reachable heavy-bite profiles", () => {
  assert.deepEqual(contests.map(c => c.id).sort(), [
    "ben-jerry-icecream", "in-n-out-burgers", "katz-pastrami",
    "nathans-hotdogs", "pizza-hut-stuffed", "wing-bowl",
  ]);
  const heavy = contests.filter(contest => {
    const state = createMechanic(contest);
    const { getFoodProfile } = state.h.load(require("node:path").resolve("src/game/food/FoodProfiles.ts"));
    return getFoodProfile(contest.id, contest.food).specialMechanic?.type === "heavy_bite";
  });
  assert.deepEqual(heavy.map(c => c.id).sort(), ["ben-jerry-icecream", "in-n-out-burgers", "katz-pastrami"]);
});

for (const id of ["pizza-hut-stuffed", "wing-bowl"]) {
  test(`${id}: reject pixel-valid / normalized-invalid gesture before mutation`, () => {
    const contest = contests.find(c => c.id === id);
    const state = createMechanic(contest);
    state.h.setNow(state.origin + 1000);
    const before = JSON.stringify(state.h.loop.getBurnoutDiagnostics(state.h.now()));
    const driver = mountControl(state);
    driver.act(1000, { dx: 120, dy: 30 });
    assert.equal(state.log.events().length, 0);
    assert.equal(JSON.stringify(state.h.loop.getBurnoutDiagnostics(state.h.now())), before);
    assert.deepEqual(driver.handler.calls, []);
    const backend = runBackend(activeFor(contest), [{ ...driver.attemptedEvidence[0], seq: 1, t_ms: 1000, type: "SLICE" }]);
    assert.equal(backend.accepted, false);
    assert.equal(backend.reason, "invalid_slice_geometry");
  });
}

for (const id of ["katz-pastrami", "in-n-out-burgers"]) {
  test(`${id}: heavy-bite callback records measured tap coordinates accepted by backend`, () => {
    const contest = contests.find(c => c.id === id);
    const state = createMechanic(contest);
    mountHeavyBite(state).act(1000);
    assert.equal(state.log.events().length, 1);
    const backend = runBackend(activeFor(contest), state.log.events());
    assert.equal(backend.accepted, true, JSON.stringify(backend));
    assert.equal(state.log.events()[0].x, 0.4);
    assert.equal(state.log.events()[0].y, 0.6);
  });
}

const { createInputLogBuffer } = require("../src/game/inputLog");
const plain = value => JSON.parse(JSON.stringify(value));
const heat = value => Number(value.toFixed(3)); // Match backend diagnostic serialization, not a legality tolerance.
const modes = [...contests, ...contests.filter(c => ["katz-pastrami", "in-n-out-burgers", "ben-jerry-icecream"].includes(c.id)).map(c => ({ ...c, heavy: true }))];
const label = c => `${c.id}${c.heavy ? "/heavy-bite" : ""}`;

function accept(state, driver, time) {
  const count = state.log.events().length;
  driver.act(time);
  assert.equal(state.log.events().length, count + 1, `${label(state.contest)} action at ${time}`);
  const diagnostic = JSON.parse(state.h.records.at(-1)[1]);
  assert.equal(diagnostic.replayGate.t_ms, time);
  assert.equal(state.log.events().at(-1).t_ms, time);
  assert.equal(diagnostic.recordedEventTime, time);
}

function setup(contest, recovered, times) {
  let state = createMechanic(contest), driver = mountControl(state);
  if (recovered) {
    for (const time of [400, 800, 1200, 1600, 2000]) {
      // Each heavy-bite overlay completes once and is remounted by the arena.
      if (contest.heavy) driver = mountControl(state);
      accept(state, driver, time);
    }
    const saved = plain(state.h.loop.captureRecoveryState(2000));
    const prefix = state.log.events();
    const backendSaved = runBackend(activeFor(contest, 2), prefix);
    const backendRecovered = runBackend(activeFor(contest, 4), prefix);
    assert.equal(backendSaved.accepted, true);
    assert.equal(backendRecovered.accepted, true);
    assert.equal(saved.recoverable, true);
    assert.equal(heat(saved.heartburn), backendSaved.result.final_heat);
    state = createMechanic(contest);
    state.origin = 46000;
    state.h.setNow(50000);
    assert.equal(state.h.loop.resumeGame(saved, 4000), true);
    state.log = createInputLogBuffer();
    assert.equal(state.log.restore({ events: prefix, finalized: false }, 4000, contest.duration_sec * 1000, 50000), true);
    const recoveredHeat = state.h.loop.getBurnoutDiagnostics(50000).heat;
    assert.equal(heat(recoveredHeat), backendRecovered.result.final_heat);
    assert.equal(heat(state.h.loop.getReplayBurnoutGate(prefix, 4000).heat), backendRecovered.result.final_heat);
    assert.equal(heat(saved.heartburn - recoveredHeat), heat(backendSaved.result.final_heat - backendRecovered.result.final_heat));
    driver = mountControl(state);
  }
  let warningStart = null, replayWarningStart = null;
  const actionTimes = times ?? Array.from({ length: 40 }, (_, index) => (recovered ? 4000 : 0) + (index + 1) * 400);
  const played = [];
  for (const time of actionTimes) {
    if (contest.heavy) driver = mountControl(state);
    accept(state, driver, time);
    played.push(time);
    const gameplay = state.h.loop.getBurnoutDiagnostics(state.h.now());
    const gate = state.h.loop.getReplayBurnoutGate(state.log.events(), time);
    if (gameplay.warningEndsAt && warningStart === null) warningStart = time;
    if (gate.warningUntil && replayWarningStart === null) replayWarningStart = time;
    if (!times && warningStart !== null) break;
  }
  return { state, driver, played, warningStart, replayWarningStart };
}

for (const contest of modes) {
  test(`${label(contest)}: malformed geometry rejects before score, heat, combo or log mutation`, () => {
    const state = createMechanic(contest);
    state.evidenceOverrides = contest.bite_mechanic === "swipe" || contest.bite_mechanic === "hold_release"
      ? { end_x: 1.01 } : { x: 1.01 };
    const driver = mountControl(state);
    state.h.setNow(state.origin + 1000);
    const before = plain(state.h.loop.getBurnoutDiagnostics(state.h.now()));
    driver.act(1000);
    assert.equal(driver.attemptedEvidence.length, 1);
    const event = { ...plain(driver.attemptedEvidence[0]), seq: 1, t_ms: 1000,
      type: contest.bite_mechanic === "swipe" ? "SLICE" : "BITE" };
    const backend = runBackend(activeFor(contest), [event]);
    assert.equal(backend.accepted, false);
    assert.equal(backend.reason, "invalid_input_geometry");
    assert.deepEqual(plain(state.h.loop.getBurnoutDiagnostics(state.h.now())), before);
    assert.deepEqual(driver.handler.calls, []);
    assert.deepEqual(state.log.events(), []);
  });

  for (const recovered of [false, true]) {
    test(`${label(contest)} ${recovered ? "recovered" : "fresh"}: real-control heat, cooling, warning, penalty, timestamp and backend-v3 parity`, () => {
      const canonical = setup(contest, recovered);
      const history = canonical.state.log.events();
      const backend = runBackend(activeFor(contest), history);
      assert.equal(backend.accepted, true, JSON.stringify(backend));
      const warningStart = backend.result.diagnostics.warning_started_at_ms;
      assert.equal(canonical.warningStart, warningStart);
      assert.equal(canonical.replayWarningStart, warningStart);
      assert.notEqual(warningStart, null);
      assert.equal(heat(canonical.state.h.loop.getBurnoutDiagnostics(canonical.state.h.now()).heat), backend.result.final_heat);
      assert.equal(heat(canonical.state.h.loop.getReplayBurnoutGate(history, history.at(-1).t_ms).heat), backend.result.final_heat);
      const probe = runBackend(activeFor(contest), [...history, { ...history.at(-1), seq: history.length + 1, t_ms: warningStart + 2000 }]);
      assert.equal(probe.accepted, false);
      assert.equal(probe.reason, "action_during_burnout");
      const start = probe.details.burnout_start_ms, end = probe.details.burnout_end_ms;
      assert.equal(canonical.state.h.loop.getBurnoutDiagnostics(canonical.state.h.now()).warningEndsAt - canonical.state.origin, start);
      assert.equal(canonical.state.h.loop.getBurnoutDiagnostics(canonical.state.h.now()).authoritativeBurnoutUntil - canonical.state.origin, end);
      assert.equal(canonical.state.h.loop.getReplayBurnoutGate(history, history.at(-1).t_ms).warningUntil, start);

      for (const [candidate, accepted] of [[start - 1, true], [start, false], [start + 1, false], [end - 1, false], [end, true], [end + 1, true]]) {
        const replayed = setup(contest, recovered, canonical.played);
        const { state } = replayed;
        const driver = contest.heavy ? mountControl(state) : replayed.driver;
        assert.deepEqual(state.log.events(), history);
        state.h.setNow(state.origin + candidate);
        const before = plain(state.h.loop.getBurnoutDiagnostics(state.h.now()));
        const gate = state.h.loop.getReplayBurnoutGate(history, candidate);
        const callsBefore = driver.handler.calls.length;
        driver.act(candidate);
        const event = { ...plain(driver.attemptedEvidence.at(-1)), seq: history.length + 1, t_ms: candidate, type: history.at(-1).type };
        const result = runBackend(activeFor(contest), [...history, event]);
        assert.equal(result.accepted, accepted, JSON.stringify({ candidate, result }));
        assert.equal(gate.canAccept, result.accepted);
        assert.equal(before.canAccept, result.accepted);
        const diagnostic = JSON.parse(state.h.records.at(-1)[1]);
        assert.equal(diagnostic.replayGate.t_ms, candidate);
        if (result.accepted) {
          assert.deepEqual(state.log.events(), [...history, event]);
          assert.equal(diagnostic.recordedEventTime, candidate);
          const snapshot = result.result.diagnostics.event_windows.find(e => e.event_index === event.seq);
          assert.ok(snapshot);
          assert.equal(snapshot.t_ms, candidate);
          assert.equal(heat(gate.heat), snapshot.heat_before);
          assert.equal(heat(state.h.loop.getBurnoutDiagnostics(state.h.now()).heat), snapshot.heat_after);
          assert.equal(heat(state.h.loop.getReplayBurnoutGate(state.log.events(), candidate).heat), snapshot.heat_after);
          assert.equal(snapshot.warning_active, candidate < start);
          assert.equal(snapshot.burnout_active, false);
          if (candidate >= end) assert.equal(result.result.diagnostics.burnout_started_at_ms, start);
        } else {
          assert.equal(result.reason, "action_during_burnout");
          assert.equal(result.details.event_t_ms, candidate);
          assert.equal(result.details.burnout_start_ms, start);
          assert.equal(result.details.burnout_end_ms, end);
          assert.equal(gate.penaltyUntil, end);
          assert.equal(heat(gate.heat), result.details.replayed_heat_before_action);
          assert.deepEqual(plain(state.h.loop.getBurnoutDiagnostics(state.h.now())), before);
          assert.deepEqual(state.log.events(), history);
          assert.equal(driver.handler.calls.length, callsBefore);
          assert.equal(diagnostic.rejectionReason, "REPLAY_BURNOUT_REJECTED");
        }
      }
    });
  }

  test(`${label(contest)}: overheating near match end, waiting, and final legal action`, () => {
    const canonical = setup(contest, false);
    const duration = contest.duration_sec * 1000;
    // Put penalty start at duration-200, preserving the physical action spacing.
    const offset = duration - 2200 - canonical.warningStart;
    const nearEnd = setup(contest, false, canonical.played.map(t => t + offset));
    const { state } = nearEnd;
    let driver = contest.heavy ? mountControl(state) : nearEnd.driver;
    accept(state, driver, duration - 201);
    const history = state.log.events();
    assert.equal(runBackend(activeFor(contest), history).accepted, true);
    if (contest.heavy) driver = mountControl(state);
    state.h.setNow(state.origin + duration - 1);
    const before = plain(state.h.loop.getBurnoutDiagnostics(state.h.now()));
    const count = driver.handler.calls.length;
    driver.act(duration - 1);
    const event = { ...plain(driver.attemptedEvidence.at(-1)), seq: history.length + 1, t_ms: duration - 1, type: history.at(-1).type };
    const backend = runBackend(activeFor(contest), [...history, event]);
    assert.equal(backend.accepted, false);
    assert.equal(backend.reason, "action_during_burnout");
    assert.deepEqual(plain(state.h.loop.getBurnoutDiagnostics(state.h.now())), before);
    assert.equal(driver.handler.calls.length, count);
    assert.deepEqual(state.log.events(), history);
    const final = createMechanic(contest);
    accept(final, mountControl(final), duration - 1);
    assert.equal(runBackend(activeFor(contest), final.log.events()).accepted, true);

    for (const closedStatus of [false, true]) {
      const closed = createMechanic(contest);
      const control = mountControl(closed);
      const time = closedStatus ? 1000 : duration + 1;
      closed.h.setNow(closed.origin + time);
      if (closedStatus) closed.h.context.arenaCallbacksRef.current.status = "FINISHED";
      const unchanged = plain(closed.h.loop.getBurnoutDiagnostics(closed.h.now()));
      control.act(time);
      assert.deepEqual(plain(closed.h.loop.getBurnoutDiagnostics(closed.h.now())), unchanged);
      assert.deepEqual(closed.log.events(), []);
      assert.deepEqual(control.handler.calls, []);
      if (!closedStatus) {
        const candidate = { ...plain(control.attemptedEvidence.at(-1)), seq: 1, t_ms: time, type: contest.bite_mechanic === "swipe" ? "SLICE" : "BITE" };
        const rejected = runBackend(activeFor(contest), [candidate]);
        assert.equal(rejected.accepted, false);
        assert.equal(rejected.reason, "action_after_match_end");
      }
    }
  });

  test(`${label(contest)}: reserved evidence fields, monotonic time and frozen retry events`, async () => {
    const state = createMechanic(contest);
    state.evidenceOverrides = { seq: 900, t_ms: 1, type: "ANTACID" };
    accept(state, mountControl(state), 1000);
    const event = state.log.events()[0];
    assert.equal(event.seq, 1);
    assert.equal(event.t_ms, 1000);
    assert.equal(event.type, contest.bite_mechanic === "swipe" ? "SLICE" : "BITE");
    assert.equal(runBackend(activeFor(contest), [event]).accepted, true);
    assert.equal(state.log.recordAtElapsed(event.type, event, 999), false);
    const events = state.log.finish();
    assert.equal(Object.isFrozen(events), true);
    assert.equal(Object.isFrozen(event), true);
    assert.strictEqual(state.log.finish(), events);
    const { createResultSubmissionCoordinator } = require("../src/game/resultSubmission");
    const sent = [];
    const coordinator = createResultSubmissionCoordinator(async payload => { sent.push(payload); return {}; });
    coordinator.preserve({ match_id: "test", validation_version: 3, input_events: events });
    await coordinator.submit();
    await coordinator.submit();
    assert.strictEqual(sent[0], sent[1]);
    assert.strictEqual(sent[0].input_events, events);
    assert.equal(state.log.recordAtElapsed(event.type, event, 1001), false);
  });
}

for (const id of ["pizza-hut-stuffed", "wing-bowl"]) {
  test(`${id}: actual release coordinates, not the last move, determine evidence`, () => {
    const contest = contests.find(c => c.id === id);
    for (const options of [{ moveDy: 30, dy: 0 }, { releaseOnly: true, dy: 0 }, { moveDy: 0, dy: 30 }]) {
      const state = createMechanic(contest);
      const driver = mountControl(state);
      driver.act(1000, { dx: 120, duplicate: true, ...options });
      assert.equal(driver.attemptedEvidence.length, 1, "duplicate release must not submit twice");
      const evidence = plain(driver.attemptedEvidence[0]);
      assert.equal(evidence.end_y, Number(((25 + options.dy) / 82).toFixed(4)));
      const result = runBackend(activeFor(contest), [{ ...evidence, seq: 1, t_ms: 1000, type: "SLICE" }]);
      assert.equal(result.accepted, options.dy === 0);
      assert.equal(state.log.events().length, Number(result.accepted));
      if (!result.accepted) {
        assert.equal(result.reason, "invalid_slice_geometry");
        assert.deepEqual(driver.handler.calls, []);
      }
    }
  });
}

test("rapid taps preserve the 90ms debounce and backend acceptance", () => {
  const contest = contests.find(c => c.bite_mechanic === "rapid");
  const state = createMechanic(contest), driver = mountControl(state);
  accept(state, driver, 1000);
  state.h.setNow(state.origin + 1089);
  const before = plain(state.h.loop.getBurnoutDiagnostics(state.h.now()));
  driver.act(1089);
  assert.deepEqual(plain(state.h.loop.getBurnoutDiagnostics(state.h.now())), before);
  assert.equal(state.log.events().length, 1);
  accept(state, driver, 1090);
  assert.equal(runBackend(activeFor(contest), state.log.events()).accepted, true);
});

test("heavy hold completion measures delay and rejects invalid hold duration before gameplay", () => {
  const contest = contests.find(c => c.bite_mechanic === "hold_release");
  for (const duration of [300, 900, 901]) {
    const state = createMechanic(contest), driver = mountHeavyBite(state);
    state.h.setNow(state.origin + 2000);
    const before = plain(state.h.loop.getBurnoutDiagnostics(state.h.now()));
    driver.act(2000, { duration });
    const evidence = plain(driver.attemptedEvidence[0]);
    assert.equal(evidence.duration_ms, duration);
    const result = runBackend(activeFor(contest), [{ ...evidence, seq: 1, t_ms: 2000, type: "BITE" }]);
    assert.equal(result.accepted, duration <= 900);
    assert.equal(state.log.events().length, Number(result.accepted));
    if (!result.accepted) {
      assert.equal(result.reason, "invalid_hold_geometry");
      assert.deepEqual(plain(state.h.loop.getBurnoutDiagnostics(state.h.now())), before);
      assert.deepEqual(driver.handler.calls, []);
    }
  }
});
