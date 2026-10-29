const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const test = require('node:test');
const ts = require('typescript');
const { createInputLogBuffer } = require('../src/game/inputLog');
const { createActiveMatchInputLogPersistence, ACTIVE_MATCH_INPUT_LOG_KEY } = require('../src/game/activeMatchInputLog');
const { createResultSubmissionCoordinator } = require('../src/game/resultSubmission');
// Reuse deterministic helpers, without registering the other file's tests.
const fixture = path.join(__dirname, 'gameplay-recovery-replay.test.js');
const text = fs.readFileSync(fixture, 'utf8');
const helpers = text.slice(0, text.indexOf('for (const contest of contests) test'));
const { backend, contests, activeFor, evidenceFor, authority, memory, session, tap, plain } =
  new Function('require', '__dirname', helpers + ';return {backend,contests,activeFor,evidenceFor,authority,memory,session,tap,plain};')(createRequire(fixture), __dirname);
const contest = contests.find(c => c.id === 'nathans-hotdogs');

async function warningFixture(t, phase = 'warning') {
  const clock = { now: 10000 }; t.mock.method(Date, 'now', () => clock.now);
  const storage = memory(), state = session(contest, clock.now, clock);
  const persistence = createActiveMatchInputLogPersistence(storage);
  await persistence.bind(authority(contest), state.log);
  let warning;
  for (let time = 100; time < 12000; time += 100) {
    assert.notEqual(tap(state, contest, time, clock), null);
    warning = state.h.loop.getReplayBurnoutGate(state.log.events(), time).warningUntil;
    if (warning) break;
  }
  assert.ok(warning);
  if (phase === 'penalty') {
    clock.now = state.origin + warning + 100; state.h.setNow(clock.now);
    assert.equal(state.h.loop.tap(clock.now), null);
  }
  const saved = plain(state.h.loop.captureRecoveryState(state.log.elapsed()));
  await persistence.flush(state.log, saved);
  return { clock, storage, state, saved, warning, end: warning + 1500 };
}
async function restore(fixture, elapsed) {
  const { clock, storage } = fixture;
  clock.now = 90000;
  const state = session(contest, clock.now, clock);
  state.log = createInputLogBuffer(() => clock.now);
  const recovered = await createActiveMatchInputLogPersistence(storage).bind(authority(contest, elapsed), state.log);
  assert.equal(recovered.status, 'restored');
  state.origin = recovered.localOrigin - recovered.authoritativeElapsedMs;
  assert.equal(state.h.loop.resumeGame(recovered.gameplayState, elapsed), true);
  return state;
}

for (const boundary of ['start', 'end']) for (const offset of [-1, 0, 1]) {
  test(`warning snapshot recovery agrees with backend at burnout ${boundary} ${offset}ms`, async t => {
    const f = await warningFixture(t), elapsed = (boundary === 'start' ? f.warning : f.end) + offset;
    const before = f.storage.values.get(ACTIVE_MATCH_INPUT_LOG_KEY);
    const resumed = await restore(f, elapsed);
    assert.equal(f.saved.version, 2);
    assert.equal(f.saved.recoverable, true);
    assert.equal(f.saved.warningUntilMs, f.warning);
    const history = plain(f.state.log.events());
    assert.deepEqual(resumed.log.events(), history);
    assert.equal(f.storage.values.get(ACTIVE_MATCH_INPUT_LOG_KEY), before);
    const diagnostics = resumed.h.loop.getBurnoutDiagnostics(f.clock.now);
    const accepted = boundary === 'start' ? offset < 0 : offset >= 0;
    assert.equal(diagnostics.canAccept, accepted);
    assert.equal(diagnostics.acceptedTapCount, f.saved.acceptedTapCount);
    assert.equal(diagnostics.score, f.saved.scoreRaw, 'phase advancement cannot add scoring inputs or bonuses');
    if (elapsed < f.warning) assert.equal(diagnostics.warningEndsAt, resumed.origin + f.warning);
    else if (elapsed < f.end) assert.equal(diagnostics.penaltyEndsAt, resumed.origin + f.end);
    const event = { seq: history.length + 1, t_ms: elapsed, type: 'BITE', ...evidenceFor(contest) };
    const [result] = backend({ mode: 'replay', cases: [{ active: activeFor(contest), events: [...history, event] }] });
    assert.equal(result.accepted, accepted);
    assert.equal(tap(resumed, contest, elapsed, f.clock) !== null, accepted);
    assert.deepEqual(resumed.log.events(), accepted ? [...history, event] : history);
    if (accepted) assert.equal(Math.floor(resumed.h.loop.captureRecoveryState(elapsed).scoreRaw), result.result.replayed_score);
  });
}

for (const offset of [-1, 0, 1]) test(`active burnout snapshot resumes with the original end deadline ${offset}ms`, async t => {
  const f = await warningFixture(t, 'penalty'), elapsed = f.end + offset;
  const resumed = await restore(f, elapsed);
  assert.equal(f.saved.penaltyUntilMs, f.end);
  assert.equal(f.saved.warningUntilMs, 0);
  const before = resumed.h.loop.captureRecoveryState(elapsed);
  assert.equal(before.scoreRaw, f.saved.scoreRaw);
  assert.equal(before.combo, 0);
  const event = { seq: resumed.log.events().length + 1, t_ms: elapsed, type: 'BITE', ...evidenceFor(contest) };
  const [result] = backend({ mode: 'replay', cases: [{ active: activeFor(contest), events: [...resumed.log.events(), event] }] });
  assert.equal(tap(resumed, contest, elapsed, f.clock) !== null, result.accepted);
  assert.equal(result.accepted, offset >= 0);
  if (result.accepted) assert.equal(Math.floor(resumed.h.loop.captureRecoveryState(elapsed).scoreRaw), result.result.replayed_score);
});

test('restored warning permits one antacid save before its original deadline', async t => {
  const f = await warningFixture(t), elapsed = f.warning - 1;
  const resumed = await restore(f, elapsed);
  assert.equal(resumed.h.loop.applyAntacid(f.clock.now), true);
  assert.equal(resumed.h.loop.applyAntacid(f.clock.now), false);
  assert.equal(resumed.log.recordAtElapsed('ANTACID', undefined, elapsed), true);
  assert.equal(resumed.h.loop.getBurnoutDiagnostics(f.clock.now).warningEndsAt, 0);
  const after = f.warning + 1;
  assert.notEqual(tap(resumed, contest, after, f.clock), null);
  const [result] = backend({ mode: 'replay', cases: [{ active: activeFor(contest), events: resumed.log.events() }] });
  assert.equal(result.accepted, true);
  assert.equal(result.result.antacids_used, 1);
  assert.equal(Math.floor(resumed.h.loop.captureRecoveryState(after).scoreRaw), result.result.replayed_score);
});

test('resumed fractional remaining time expires at the server deadline, not one tick later', () => {
  const clock = { now: 90000 }, resumed = session(contest, clock.now, clock);
  const saved = plain(resumed.h.loop.captureRecoveryState(0));
  const elapsed = contest.duration_sec * 1000 - 250;
  assert.equal(resumed.h.loop.resumeGame(saved, elapsed), true);
  const deadline = [...resumed.h.timers.values()].find(timer => timer.ms === 250);
  assert.ok(deadline, 'the terminal timer must have exactly 250ms remaining');
  clock.now += 250; resumed.h.setNow(clock.now); deadline.fn();
  assert.equal(resumed.h.loop.getBurnoutDiagnostics(clock.now).status, 'FINISHED');
  assert.equal(resumed.h.loop.tap(clock.now), null);
  assert.equal(resumed.h.timers.size, 0);
});

for (const elapsed of [60000, 60001]) test(`elapsed match ${elapsed}ms stays finished without timers or inputs`, async t => {
  const f = await warningFixture(t), resumed = await restore(f, elapsed);
  assert.equal(resumed.h.loop.getBurnoutDiagnostics(f.clock.now).status, 'FINISHED');
  assert.equal(resumed.h.timers.size, 0);
  assert.equal(resumed.h.loop.tap(f.clock.now), null);
  assert.equal(resumed.h.loop.applyAntacid(f.clock.now), false);
});

test('a completed snapshot cannot return to PLAYING even before the duration deadline', () => {
  const clock = { now: 10000 }, state = session(contest, clock.now, clock);
  const saved = { ...plain(state.h.loop.captureRecoveryState(1000)), version: 2,
    warningUntilMs: 0, penaltyUntilMs: 0, coolingAtMs: 0, finished: true, recoverable: true };
  assert.equal(state.h.loop.resumeGame(saved, 1000), true);
  assert.equal(state.h.loop.getBurnoutDiagnostics(clock.now).status, 'FINISHED');
  assert.equal(state.h.timers.size, 0);
  assert.equal(state.h.loop.tap(clock.now), null);
  assert.equal(state.h.loop.resumeGame({ ...saved, finished: false }, 1001), false, 'a stale active snapshot cannot revive the finished hook');
});

test('repeated restoration cannot compound scores or modify an immutable result retry', async t => {
  const f = await warningFixture(t), resumed = await restore(f, f.end + 1);
  const payload = { match_id: 'synthetic-match', contest_id: contest.id, score: f.saved.scoreRaw, input_events: plain(f.state.log.events()) };
  const sent = [], coordinator = createResultSubmissionCoordinator(async value => { sent.push(value); });
  const frozen = coordinator.preserve(payload), bytes = JSON.stringify(frozen);
  const expectedScore = resumed.h.loop.captureRecoveryState(f.end + 1).scoreRaw;
  for (let i = 0; i < 3; i++) {
    assert.equal(resumed.h.loop.resumeGame(f.saved, f.end + 1), true);
    assert.equal(resumed.h.loop.captureRecoveryState(f.end + 1).scoreRaw, expectedScore);
  }
  await coordinator.submit(); await coordinator.submit();
  assert.equal(sent[0], sent[1]); assert.equal(JSON.stringify(sent[1]), bytes);
});

test('legacy unsafe snapshots and malformed phase clocks remain refused without changing live state', async t => {
  const f = await warningFixture(t), clock = { now: 10000 }, state = session(contest, clock.now, clock);
  const before = plain(state.h.loop.getBurnoutDiagnostics(clock.now));
  for (const saved of [
    { ...f.saved, version: 1, recoverable: false },
    { ...f.saved, warningUntilMs: NaN },
    { ...f.saved, penaltyUntilMs: f.end, warningUntilMs: f.warning },
  ]) assert.equal(state.h.loop.resumeGame(saved, f.end + 1), false);
  assert.equal(state.h.loop.resumeGame(f.saved, NaN), false);
  assert.deepEqual(plain(state.h.loop.getBurnoutDiagnostics(clock.now)), before);
});

test('delayed screen hydration advances recovery from the bound origin instead of extending the phase and match', async t => {
  const f = await warningFixture(t), elapsed = f.warning - 100, boundAt = 90000;
  const resumed = session(contest, boundAt, f.clock);
  resumed.h.setNow(boundAt + 200);
  const playPath = path.join(__dirname, '../app/play/[contestId].tsx');
  const play = ts.createSourceFile(playPath, fs.readFileSync(playPath, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let effect;
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(play) === 'useEffect' &&
      node.arguments[0]?.getText(play).includes('resumeGame(pending.state')) effect = node.arguments[0];
    ts.forEachChild(node, visit);
  }
  visit(play); assert.ok(effect);
  let received;
  resumed.h.evaluate(`(${effect.getText(play)})();`, {
    contestLoaded: true, identityHydrated: true, started: { current: false },
    pendingGameplayRecovery: { current: { state: f.saved, elapsedMs: elapsed } },
    matchStartedAt: { current: boundAt - elapsed },
    resumeGame(saved, time) { received = time; return resumed.h.loop.resumeGame(saved, time); },
    setMatchStartFailureMessage() { assert.fail('Unexpected recovery failure'); },
    setMatchStartError() { assert.fail('Unexpected recovery failure'); },
    startMatchIntro() { assert.fail('Recovery must not start another match'); },
  });
  assert.equal(received, elapsed + 200);
  const diagnostics = resumed.h.loop.getBurnoutDiagnostics(boundAt + 200);
  assert.equal(diagnostics.canAccept, false);
  assert.equal(diagnostics.penaltyEndsAt, boundAt - elapsed + f.end);
});
