const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { execFileSync } = require('node:child_process');
const test = require('node:test');
const ts = require('typescript');
const { createInputLogBuffer } = require('../src/game/inputLog');
const { createActiveMatchInputLogPersistence, ACTIVE_MATCH_INPUT_LOG_KEY } = require('../src/game/activeMatchInputLog');
const { createResultSubmissionCoordinator } = require('../src/game/resultSubmission');
const { harness: gameplay } = require('./helpers/gameplay-harness');
const plain = value => JSON.parse(JSON.stringify(value));
const backendRoot = path.resolve(__dirname, '../../backend');

// Pure production replay and fingerprint functions only; no server/database is
// imported. Replay skips site packages; fingerprints use the real request model.
// Both have a sanitized environment, disabled bytecode and a socket guard.
function backend(request) {
  const allowed = new Set(['systemroot', 'windir', 'comspec', 'temp', 'tmp', 'programfiles']);
  const env = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => allowed.has(key.toLowerCase()))),
    PYTHONDONTWRITEBYTECODE: '1', PYTHON_DOTENV_DISABLED: '1', FIRE_FEAST_ENV: 'test' };
  const script = `
import ast, hashlib, json, sys
from pathlib import Path
def deny(event, args):
    if event.startswith('socket.'):
        raise RuntimeError('Gameplay fixtures forbid network access')
sys.addaudithook(deny)
root = Path(sys.argv[1])
sys.path.insert(0, str(root))
from services.match_validation import replay_input_log, InputReplayError, trusted_heat_per_tap
from data.contests import CONTESTS
request = json.load(sys.stdin)
if request['mode'] == 'contests':
    answer = [{**c, 'heat_per_tap': trusted_heat_per_tap(c)} for c in CONTESTS]
elif request['mode'] == 'fingerprints':
    if sys.argv[2]:
        sys.path.append(sys.argv[2])
    from models import MatchResult
    source = ast.parse((root / 'services/match_service.py').read_text(encoding='utf-8-sig'))
    functions = [n for n in source.body if isinstance(n, ast.FunctionDef) and n.name in {'_result_payload', '_fingerprint'}]
    assert len(functions) == 2
    namespace = {'json': json, 'hashlib': hashlib}
    exec(compile(ast.Module(body=functions, type_ignores=[]), '<production-fingerprint>', 'exec'), namespace)
    answer = []
    for payload in request['payloads']:
        result = MatchResult(**payload)
        answer.append(namespace['_fingerprint'](result))
else:
    assert request['mode'] == 'replay'
    answer = []
    for case in request['cases']:
        try:
            answer.append({'accepted': True, 'result': replay_input_log(case['active'], case['events'], 3)})
        except InputReplayError as error:
            answer.append({'accepted': False, 'reason': error.reason, 'details': error.details})
print(json.dumps(answer))
`;
  const python = process.platform === 'win32' ? 'C:\\Program Files\\Python314\\python.exe' : 'python3';
  const userSite = process.platform === 'win32'
    ? path.join(process.env.APPDATA || '', 'Python', 'Python314', 'site-packages') : '';
  if (userSite && !/^C:\\/i.test(userSite)) throw Error('Fingerprint dependencies must remain on C:');
  return JSON.parse(execFileSync(python, ['-I', ...(process.platform === 'win32' || request.mode !== 'fingerprints' ? ['-S'] : []), '-B', '-c', script, backendRoot, userSite], {
    input: JSON.stringify(request), encoding: 'utf8', env, timeout: 15000, maxBuffer: 2 * 1024 * 1024, windowsHide: true,
  }));
}
const contests = backend({ mode: 'contests' });
assert.equal(contests.length, 6);
const activeFor = contest => ({
  allowed_duration_sec: contest.duration_sec, challenge_config: { ...contest, contest_id: contest.id },
  perk_modifiers: { tap_power: 1, combo_window_ms: 700, score_multiplier: 1, heat_generation_multiplier: 1 }, starting_antacid: 3,
});
const evidenceFor = contest => ['slice', 'swipe', 'hold_release'].includes(contest.bite_mechanic)
  ? { source: 'CONTROL', start_x: 0.1, start_y: 0.5, end_x: 0.9, end_y: 0.5, duration_ms: contest.bite_mechanic === 'hold_release' ? 400 : 200 }
  : { source: 'CONTROL', x: 0.5, y: 0.5 };
const typeFor = contest => ['slice', 'swipe'].includes(contest.bite_mechanic) ? 'SLICE' : 'BITE';
const start = '2026-10-25T12:00:00.000Z';
const authority = (contest, elapsed = 0) => ({ matchId: 'synthetic-match', contestId: contest.id, serverStartedAt: start,
  serverTime: new Date(Date.parse(start) + elapsed).toISOString(), durationMs: contest.duration_sec * 1000 });
function memory() {
  const values = new Map();
  return { values, getItem: async key => values.get(key) ?? null,
    setItem: async (key, value) => { values.set(key, value); }, removeItem: async key => { values.delete(key); } };
}
function session(contest, origin, clock) {
  const h = gameplay(true, undefined, true, { mechanic: contest.bite_mechanic, loop: { foodId: contest.id, duration: contest.duration_sec } });
  h.setNow(origin);
  const log = createInputLogBuffer(() => clock.now); log.start(contest.duration_sec * 1000, origin);
  return { h, log, origin };
}
function tap(state, contest, time, clock) {
  clock.now = state.origin + time; state.h.setNow(clock.now);
  return state.h.handler(state.log, state.origin).tap(evidenceFor(contest));
}

for (const contest of contests) test(`two persisted restarts preserve match-relative timing and replay: ${contest.id}`, async t => {
  const clock = { now: 10000 }; t.mock.method(Date, 'now', () => clock.now);
  const storage = memory();
  let state = session(contest, clock.now, clock);
  let persistence = createActiveMatchInputLogPersistence(storage);
  assert.equal((await persistence.bind(authority(contest), state.log)).status, 'new');
  for (const time of [100, 200, 300]) assert.notEqual(tap(state, contest, time, clock), null);
  for (const [elapsed, localOrigin] of [[2500, 50000], [4500, 90000]]) {
    const prefix = plain(state.log.events());
    const saved = plain(state.h.loop.captureRecoveryState(state.log.elapsed()));
    assert.equal(saved.recoverable, true);
    assert.equal(await persistence.flush(state.log, saved), true);
    const bytes = storage.values.get(ACTIVE_MATCH_INPUT_LOG_KEY);
    assert.equal(JSON.parse(bytes).match_id, 'synthetic-match');
    clock.now = localOrigin;
    const next = session(contest, localOrigin, clock);
    next.log = createInputLogBuffer(() => clock.now);
    persistence = createActiveMatchInputLogPersistence(storage);
    const restored = await persistence.bind(authority(contest, elapsed), next.log);
    assert.equal(restored.status, 'restored');
    assert.equal(restored.authoritativeElapsedMs, elapsed);
    assert.equal(restored.localOrigin, localOrigin);
    next.origin = restored.localOrigin - restored.authoritativeElapsedMs;
    assert.equal(next.h.loop.resumeGame(restored.gameplayState, elapsed), true);
    assert.equal(next.log.elapsed(), elapsed);
    assert.deepEqual(next.log.events(), prefix);
    assert.equal(storage.values.get(ACTIVE_MATCH_INPUT_LOG_KEY), bytes, 'binding is read-only for a matching saved record');
    state = next;
    for (const time of [elapsed, elapsed + 200]) assert.notEqual(tap(state, contest, time, clock), null);
  }
  const events = state.log.events();
  assert.deepEqual(events.map(e => e.t_ms), [100, 200, 300, 2500, 2700, 4500, 4700]);
  assert.deepEqual(events.map(e => e.seq), [1, 2, 3, 4, 5, 6, 7]);
  assert.ok(events.every(e => e.type === typeFor(contest)));
  const [replayed] = backend({ mode: 'replay', cases: [{ active: activeFor(contest), events }] });
  assert.equal(replayed.accepted, true, JSON.stringify(replayed));
  assert.equal(replayed.result.accepted_taps, 7);
  assert.equal(replayed.result.replayed_score, Math.floor(state.h.loop.captureRecoveryState(4700).scoreRaw));
  assert.equal(replayed.result.maximum_combo, 2);
});

test('persisted resumed histories agree with backend immediately before, at and after both burnout boundaries', async t => {
  const contest = contests.find(c => c.id === 'nathans-hotdogs');
  const clock = { now: 10000 }; t.mock.method(Date, 'now', () => clock.now);
  const storage = memory(), state = session(contest, clock.now, clock);
  const persistence = createActiveMatchInputLogPersistence(storage);
  await persistence.bind(authority(contest), state.log);
  for (const time of [100, 200, 300]) assert.notEqual(tap(state, contest, time, clock), null);
  await persistence.flush(state.log, plain(state.h.loop.captureRecoveryState(300)));
  const cases = [];
  for (const offset of [-1, 0, 1]) for (const boundary of ['start', 'end']) {
    clock.now = 50000;
    const resumed = session(contest, clock.now, clock); resumed.log = createInputLogBuffer(() => clock.now);
    const recovered = await createActiveMatchInputLogPersistence(storage).bind(authority(contest, 2000), resumed.log);
    resumed.origin = recovered.localOrigin - recovered.authoritativeElapsedMs;
    assert.equal(resumed.h.loop.resumeGame(recovered.gameplayState, 2000), true);
    let warning;
    for (let time = 2000; time < 12000; time += 100) {
      assert.notEqual(tap(resumed, contest, time, clock), null);
      warning = resumed.h.loop.getReplayBurnoutGate(resumed.log.events(), time).warningUntil;
      if (warning) break;
    }
    assert.ok(warning);
    const prefix = plain(resumed.log.events());
    const endpoint = warning + 1500;
    const candidate = (boundary === 'start' ? warning : endpoint) + offset;
    const expected = boundary === 'start' ? offset < 0 : offset >= 0;
    const event = { seq: prefix.length + 1, t_ms: candidate, type: 'BITE', ...evidenceFor(contest) };
    const before = plain(resumed.h.loop.captureRecoveryState(resumed.log.elapsed()));
    assert.equal(tap(resumed, contest, candidate, clock) !== null, expected);
    assert.deepEqual(resumed.log.events(), expected ? [...prefix, event] : prefix);
    if (!expected) assert.equal(resumed.h.loop.captureRecoveryState(candidate).acceptedTapCount, before.acceptedTapCount);
    cases.push({ active: activeFor(contest), events: [...prefix, event], expected, candidate, warning, endpoint });
  }
  const results = backend({ mode: 'replay', cases });
  results.forEach((result, index) => {
    const c = cases[index];
    assert.equal(result.accepted, c.expected, JSON.stringify({ case: c.candidate, result }));
    if (!c.expected) {
      assert.equal(result.reason, 'action_during_burnout');
      assert.equal(result.details.burnout_start_ms, c.warning);
      assert.equal(result.details.burnout_end_ms, c.endpoint);
    }
  });
});

test('backwards local observations preserve ordering and duration-cutoff behavior matches backend', () => {
  const contest = contests[0], evidence = evidenceFor(contest), duration = contest.duration_sec * 1000;
  const log = createInputLogBuffer(() => 10000); log.start(duration, 10000);
  assert.equal(log.recordAtElapsed(typeFor(contest), evidence, 1000), true);
  assert.equal(log.eventTimeFor(10999), 1000);
  assert.equal(log.recordAtElapsed(typeFor(contest), evidence, 999), false);
  assert.equal(log.recordAtElapsed(typeFor(contest), evidence, log.eventTimeFor(10999)), true);
  assert.deepEqual(log.events().map(e => e.t_ms), [1000, 1000]);
  const cases = [duration - 1, duration, duration + 1].map(time => ({
    active: activeFor(contest), events: [{ seq: 1, t_ms: time, type: typeFor(contest), ...evidence }],
  }));
  const results = backend({ mode: 'replay', cases });
  assert.deepEqual(results.map(r => r.accepted), [true, true, false]);
  assert.equal(results[2].reason, 'action_after_match_end');
  cases.forEach((c, index) => {
    const clock = { now: 10000 }, state = session(contest, clock.now, clock);
    assert.equal(tap(state, contest, c.events[0].t_ms, clock) !== null, results[index].accepted);
  });
  const [ordered] = backend({ mode: 'replay', cases: [{ active: activeFor(contest), events: log.events() }] });
  assert.equal(ordered.accepted, true);
});

for (const stage of ['warning', 'penalty']) test(`legacy snapshots during ${stage} without phase deadlines remain refused`, async t => {
  const contest = contests.find(c => c.id === 'nathans-hotdogs'), clock = { now: 10000 };
  t.mock.method(Date, 'now', () => clock.now);
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
  if (stage === 'penalty') {
    clock.now = state.origin + warning + 1; state.h.setNow(clock.now);
    assert.equal(state.h.loop.tap(clock.now), null);
  }
  const captured = plain(state.h.loop.captureRecoveryState(state.log.elapsed()));
  const saved = { ...captured, version: 1, recoverable: false };
  for (const field of ['warningUntilMs', 'penaltyUntilMs', 'coolingAtMs', 'finished']) delete saved[field];
  assert.equal(await persistence.flush(state.log, saved), true);
  const bytes = storage.values.get(ACTIVE_MATCH_INPUT_LOG_KEY);
  clock.now = 90000;
  const resumed = session(contest, clock.now, clock); resumed.log = createInputLogBuffer(() => clock.now);
  const restored = await createActiveMatchInputLogPersistence(storage).bind(authority(contest, warning + 100), resumed.log);
  assert.equal(restored.status, 'restored');
  assert.equal(resumed.h.loop.resumeGame(restored.gameplayState, restored.authoritativeElapsedMs), false);
  assert.equal(storage.values.get(ACTIVE_MATCH_INPUT_LOG_KEY), bytes);
  assert.deepEqual(resumed.log.events(), state.log.events());
});

// Reuse only declarations from the existing real-API VM harness, not its tests.
const fixture = path.join(__dirname, 'match-recovery.test.js');
const fixtureSource = fs.readFileSync(fixture, 'utf8');
const ast = ts.createSourceFile(fixture, fixtureSource, ts.ScriptTarget.Latest, true);
const declarations = ast.statements.filter(n => ts.isVariableStatement(n) || ts.isFunctionDeclaration(n)).map(n => n.getText(ast)).join('\n');
const { harness: apiHarness, payload, reply, official, KEY } = new Function('require', '__dirname', declarations + ';return {harness,payload,reply,official,KEY};')(createRequire(fixture), __dirname);

test('lost response and process restart retry identical logs, IDs and backend idempotency fingerprint', async () => {
  const h = apiHarness(), contest = contests[0];
  const original = { ...payload(contest.id), accepted_taps: 2, input_events: [100, 4700].map((time, index) => ({ seq: index + 1, t_ms: time, type: typeFor(contest), ...evidenceFor(contest) })) };
  let initialBody;
  h.handle((route, opts) => { if (route === '/match/result') { initialBody = opts.body; throw Error('synthetic lost response'); } });
  await assert.rejects(h.api.submitDurableResult(original, 'guest_a'), /synthetic lost response/);
  const durableBytes = h.values.get(KEY);
  original.match_id = 'mutated-match'; original.input_events[0].t_ms = 999; original.input_events[1].x = 0;
  const restarted = apiHarness(h.values);
  const identity = { schema_version: 1, player_id: 'guest_a', match_id: 'match-a', contest_id: contest.id };
  let receiptCount = 0, replayBody;
  restarted.handle((route, opts) => {
    if (route === '/match/receipt') {
      assert.deepEqual(JSON.parse(opts.body), { match_id: 'match-a', contest_id: contest.id });
      assert.equal(h.values.get(KEY), durableBytes);
      return reply(++receiptCount === 1 ? { ...identity, status: 'UNRESOLVED' } : {
        ...identity, status: 'SETTLED', receipt: { ...identity, outcome: 'settled', rewards_granted: true, settlement_final: true },
        result: { ...official, verified: true, match_id: 'match-a' },
      });
    }
    if (route === '/match/result') { replayBody = opts.body; return reply(official); }
  });
  const recovered = await restarted.api.recoverPendingResult(undefined, true);
  assert.equal(replayBody, initialBody);
  assert.equal(recovered.status, 'SETTLED');
  assert.ok(Object.isFrozen(recovered.receipt));
  assert.equal(h.values.has(KEY), false);
  assert.deepEqual(restarted.calls.map(c => c.route), ['/match/receipt', '/match/result', '/match/receipt']);
  const first = JSON.parse(initialBody), second = JSON.parse(replayBody);
  const changed = { ...second, input_events: second.input_events.map((e, i) => ({ ...e, t_ms: e.t_ms + (i ? 1 : 0) })) };
  const fingerprints = backend({ mode: 'fingerprints', payloads: [first, second, changed] });
  assert.deepEqual(fingerprints[0], fingerprints[1]);
  assert.equal(fingerprints[0].version, 1);
  assert.notEqual(fingerprints[0].sha256, fingerprints[2].sha256);
});

for (const field of ['player_id', 'match_id', 'contest_id']) test(`wrong receipt ${field} preserves the exact pending evidence without resubmission`, async () => {
  const h = apiHarness();
  const store = h.load('src/game/pendingResult.js').createPendingResultStore(h.storage);
  await store.save('guest_a', payload());
  const bytes = h.values.get(KEY);
  const identity = { schema_version: 1, player_id: 'guest_a', match_id: 'match-a', contest_id: payload().contest_id };
  h.handle(route => route === '/match/receipt' ? reply({ ...identity, [field]: 'wrong', status: 'UNRESOLVED' }) : undefined);
  await assert.rejects(h.api.recoverPendingResult(undefined, true), error => error.code === 'INVALID_RECEIPT');
  assert.equal(h.values.get(KEY), bytes);
  assert.deepEqual(h.calls.map(c => c.route), ['/match/receipt']);
});

test('concurrent result attempts share immutable data and later retries ignore caller mutations', async () => {
  const calls = []; let rejectFirst;
  const coordinator = createResultSubmissionCoordinator(async value => {
    calls.push(value);
    if (calls.length === 1) await new Promise((resolve, reject) => { rejectFirst = reject; });
    return { accepted: true };
  });
  const input = { match_id: 'synthetic-match', contest_id: contests[0].id, input_events: [{ seq: 1, t_ms: 100, type: 'BITE', source: 'CONTROL', x: 0.5, y: 0.5 }] };
  const frozen = coordinator.preserve(input), bytes = JSON.stringify(frozen);
  const first = coordinator.submit(), same = coordinator.submit(); assert.equal(first, same);
  const rejected = assert.rejects(first, /synthetic timeout/);
  await Promise.resolve(); input.input_events[0].t_ms = 900; input.match_id = 'wrong';
  rejectFirst(Error('synthetic timeout')); await rejected;
  await coordinator.submit();
  assert.equal(calls.length, 2); assert.equal(calls[0], calls[1]);
  assert.equal(JSON.stringify(calls[1]), bytes);
  assert.ok(Object.isFrozen(frozen.input_events[0]));
});
