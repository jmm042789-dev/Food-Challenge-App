const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const test = require('node:test');
const ts = require('typescript');
const { createInputLogBuffer } = require('../src/game/inputLog');
const { createActiveMatchInputLogPersistence, ACTIVE_MATCH_INPUT_LOG_KEY } = require('../src/game/activeMatchInputLog');
const fixture = path.join(__dirname, 'warning-burnout-recovery.test.js');
const source = fs.readFileSync(fixture, 'utf8');
const helpers = source.slice(0, source.indexOf('for (const boundary'));
const { warningFixture, restore, backend, contest, activeFor, evidenceFor, authority, memory, session, tap, plain } =
  new Function('require', '__dirname', helpers + ';return {warningFixture,restore,backend,contest,activeFor,evidenceFor,authority,memory,session,tap,plain};')(createRequire(fixture), __dirname);
const flush = async () => { for (let i = 0; i < 100; i++) await Promise.resolve(); };
const play = ts.createSourceFile('play.tsx', fs.readFileSync(path.join(__dirname, '../app/play/[contestId].tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let effect;
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(play) === 'useEffect' &&
    node.arguments[0]?.getText(play).includes('AppState.addEventListener') && node.arguments[0].getText(play).includes('api.activeMatch')) effect = node.arguments[0];
  ts.forEachChild(node, visit);
}
visit(play); assert.ok(effect);

// Execute the actual AppState effect. Native events, network, storage and clocks
// are mocked; no Activity, emulator, Metro or live endpoint is started.
function lifecycle(state, persistence, options = {}) {
  const listeners = new Set(), errors = [], requests = [];
  const cleanup = state.h.evaluate(`(${effect.getText(play)})();`, {
    AppState: { addEventListener(name, callback) { assert.equal(name, 'change'); listeners.add(callback); return { remove() { listeners.delete(callback); } }; } },
    state: { status: options.status ?? 'PLAYING' }, inputLog: state.log,
    inputLogPersistence: persistence, captureRecoveryState: state.h.loop.captureRecoveryState,
    synchronizeMatchClock: () => state.h.loop.synchronizeMatchClock?.(),
    api: { activeMatch: async () => { requests.push('activeMatch'); return options.activeMatch ? options.activeMatch() : { status: 'resumable', match_id: 'synthetic-match' }; } },
    serverMatchId: { current: 'synthetic-match' }, setMatchStartError(value) { errors.push(value); },
  });
  return { errors, requests, cleanup, emit(next) { for (const listener of listeners) listener(next); } };
}

test('a coalesced fresh-game interval cannot add background time to the round', () => {
  const clock = { now: 10000 }, state = session(contest, clock.now, clock);
  const tick = [...state.h.timers.values()].find(timer => timer.ms === 1000);
  assert.ok(tick);
  clock.now += contest.duration_sec * 1000 + 100; state.h.setNow(clock.now);
  tick.fn();
  assert.equal(state.h.loop.getBurnoutDiagnostics(clock.now).status, 'FINISHED');
  assert.equal(state.h.loop.tap(clock.now), null);
});

test('foreground reconciles the deadline even before suspended timer callbacks are delivered', async () => {
  const clock = { now: 10000 }, state = session(contest, clock.now, clock), storage = memory();
  const persistence = createActiveMatchInputLogPersistence(storage);
  await persistence.bind(authority(contest), state.log);
  const events = lifecycle(state, persistence);
  events.emit('background'); await flush();
  clock.now += contest.duration_sec * 1000 + 100; state.h.setNow(clock.now);
  events.emit('active'); await flush();
  assert.equal(state.h.loop.getBurnoutDiagnostics(clock.now).status, 'FINISHED');
  assert.equal(state.h.loop.tap(clock.now), null);
  events.cleanup();
});

test('a late foreground response cannot update an unmounted screen', async () => {
  const clock = { now: 10000 }, state = session(contest, clock.now, clock);
  let resolve;
  const pending = new Promise(done => { resolve = done; });
  const events = lifecycle(state, { flush: async () => true }, { activeMatch: () => pending });
  events.emit('active'); events.cleanup();
  resolve({ status: 'expired' }); await flush();
  assert.deepEqual(events.errors, []);
  events.emit('active'); assert.equal(events.requests.length, 1);
});

test('an older foreground check cannot invalidate a newer foreground cycle', async () => {
  const clock = { now: 10000 }, state = session(contest, clock.now, clock);
  let resolve, calls = 0;
  const pending = new Promise(done => { resolve = done; });
  const events = lifecycle(state, { flush: async () => true }, { activeMatch: () => ++calls === 1
    ? pending : Promise.resolve({ status: 'resumable', match_id: 'synthetic-match' }) });
  events.emit('active'); events.emit('background'); events.emit('active'); await flush();
  resolve({ status: 'expired' }); await flush();
  assert.deepEqual(events.errors, []);
  assert.equal(events.requests.length, 2);
  events.cleanup();
});

for (const phase of ['warning', 'penalty']) test(`background persistence and process restart preserve ${phase} eligibility and replay`, async t => {
  const f = await warningFixture(t, phase), persistence = createActiveMatchInputLogPersistence(f.storage);
  const shadow = createInputLogBuffer(() => f.clock.now);
  await persistence.bind(authority(contest, f.state.log.elapsed()), shadow);
  const events = lifecycle(f.state, persistence);
  events.emit('inactive'); events.emit('background'); await flush();
  const bytes = f.storage.values.get(ACTIVE_MATCH_INPUT_LOG_KEY), saved = JSON.parse(bytes);
  assert.equal(saved.gameplay_state.version, 2);
  assert.deepEqual(saved.input_events, f.state.log.events());
  assert.equal(events.requests.length, 0);
  events.cleanup();
  const elapsed = phase === 'warning' ? f.warning - 1 : f.end - 1;
  const resumed = await restore(f, elapsed);
  assert.equal(f.storage.values.get(ACTIVE_MATCH_INPUT_LOG_KEY), bytes);
  const expected = phase === 'warning';
  assert.equal(resumed.h.loop.getBurnoutDiagnostics(f.clock.now).canAccept, expected);
  if (phase === 'penalty') assert.equal(resumed.h.loop.applyAntacid(f.clock.now), false);
  const candidate = { seq: resumed.log.events().length + 1, t_ms: elapsed, type: 'BITE', ...evidenceFor(contest) };
  const [replayed] = backend({ mode: 'replay', cases: [{ active: activeFor(contest), events: [...resumed.log.events(), candidate] }] });
  assert.equal(replayed.accepted, expected);
  assert.equal(tap(resumed, contest, elapsed, f.clock) !== null, expected);
  if (expected) assert.equal(Math.floor(resumed.h.loop.captureRecoveryState(elapsed).scoreRaw), replayed.result.replayed_score);
});

test('foreground after suspended warning advances the original burnout interval without scoring', async t => {
  const f = await warningFixture(t), persistence = createActiveMatchInputLogPersistence(f.storage);
  await persistence.bind(authority(contest, f.state.log.elapsed()), createInputLogBuffer(() => f.clock.now));
  const events = lifecycle(f.state, persistence), prefix = plain(f.state.log.events());
  const score = f.saved.scoreRaw;
  events.emit('background'); await flush();
  f.clock.now = f.state.origin + f.warning + 100; f.state.h.setNow(f.clock.now);
  events.emit('active'); await flush();
  const state = f.state.h.loop.getBurnoutDiagnostics(f.clock.now);
  assert.equal(state.canAccept, false);
  assert.equal(state.warningEndsAt, 0);
  assert.equal(state.penaltyEndsAt, f.state.origin + f.end);
  assert.equal(state.score, score);
  assert.deepEqual(f.state.log.events(), prefix);
  events.cleanup();
});

test('foreground after burnout expiry resumes input without resetting phase deadlines', async t => {
  const f = await warningFixture(t, 'penalty'), persistence = createActiveMatchInputLogPersistence(f.storage);
  await persistence.bind(authority(contest, f.state.log.elapsed()), createInputLogBuffer(() => f.clock.now));
  const events = lifecycle(f.state, persistence);
  events.emit('background'); await flush();
  f.clock.now = f.state.origin + f.end + 1; f.state.h.setNow(f.clock.now);
  events.emit('active'); await flush();
  const before = f.state.h.loop.getBurnoutDiagnostics(f.clock.now);
  assert.equal(before.canAccept, true);
  assert.equal(before.penaltyEndsAt, 0);
  assert.equal(before.score, f.saved.scoreRaw);
  assert.notEqual(tap(f.state, contest, f.end + 1, f.clock), null);
  const [result] = backend({ mode: 'replay', cases: [{ active: activeFor(contest), events: f.state.log.events() }] });
  assert.equal(result.accepted, true);
  assert.equal(Math.floor(f.state.h.loop.captureRecoveryState(f.end + 1).scoreRaw), result.result.replayed_score);
  events.cleanup();
});

test('finished lifecycle events cannot persist a new active snapshot or restart a match', async () => {
  const clock = { now: 10000 }, state = session(contest, clock.now, clock), storage = memory();
  const persistence = createActiveMatchInputLogPersistence(storage);
  await persistence.bind(authority(contest), state.log);
  const saved = plain(state.h.loop.captureRecoveryState(0));
  assert.equal(state.h.loop.resumeGame({ ...saved, finished: true }, 100), true);
  const events = lifecycle(state, persistence, { status: 'FINISHED' });
  events.emit('background'); events.emit('active'); await flush();
  assert.equal(storage.values.has(ACTIVE_MATCH_INPUT_LOG_KEY), false);
  assert.equal(events.requests.length, 0);
  assert.equal(state.h.loop.getBurnoutDiagnostics(clock.now).status, 'FINISHED');
  events.cleanup();
});

test('transient foreground failure preserves the persisted evidence and current match', async () => {
  const clock = { now: 10000 }, state = session(contest, clock.now, clock), storage = memory();
  const persistence = createActiveMatchInputLogPersistence(storage);
  await persistence.bind(authority(contest), state.log);
  const events = lifecycle(state, persistence, { activeMatch: async () => { throw Error('synthetic offline'); } });
  events.emit('background'); await flush();
  const before = storage.values.get(ACTIVE_MATCH_INPUT_LOG_KEY);
  events.emit('active'); await flush();
  assert.deepEqual(events.errors, []);
  assert.equal(storage.values.get(ACTIVE_MATCH_INPUT_LOG_KEY), before);
  assert.equal(state.h.loop.getBurnoutDiagnostics(clock.now).status, 'PLAYING');
  events.cleanup();
});

for (const phase of ['normal', 'expired-burnout']) test(`completed background writes survive process replacement in ${phase}`, async t => {
  let f;
  if (phase === 'normal') {
    const clock = { now: 10000 }; t.mock.method(Date, 'now', () => clock.now);
    const state = session(contest, clock.now, clock), storage = memory();
    for (const time of [100, 200, 300]) assert.notEqual(tap(state, contest, time, clock), null);
    f = { clock, state, storage, resumeAt: 2000 };
  } else {
    f = await warningFixture(t, 'penalty');
    f.clock.now = f.state.origin + f.end + 1; f.state.h.setNow(f.clock.now);
    f.state.h.loop.synchronizeMatchClock(); f.resumeAt = f.end + 100;
  }
  const persistence = createActiveMatchInputLogPersistence(f.storage);
  await persistence.bind(authority(contest, f.state.log.elapsed()), createInputLogBuffer(() => f.clock.now));
  const events = lifecycle(f.state, persistence);
  events.emit('background'); await flush(); events.cleanup();
  const bytes = f.storage.values.get(ACTIVE_MATCH_INPUT_LOG_KEY);
  assert.ok(bytes);
  const copied = memory(); copied.values.set(ACTIVE_MATCH_INPUT_LOG_KEY, bytes);
  const replacement = await restore({ ...f, storage: copied }, f.resumeAt);
  assert.deepEqual(replacement.log.events(), f.state.log.events());
  assert.equal(replacement.log.elapsed(), f.resumeAt);
  assert.equal(replacement.h.loop.getBurnoutDiagnostics(f.clock.now).canAccept, true);
  const count = replacement.log.events().length;
  assert.notEqual(tap(replacement, contest, f.resumeAt, f.clock), null);
  assert.equal(replacement.log.events().at(-1).seq, count + 1);
  assert.equal(replacement.log.events().at(-1).t_ms, f.resumeAt);
  const [result] = backend({ mode: 'replay', cases: [{ active: activeFor(contest), events: replacement.log.events() }] });
  assert.equal(result.accepted, true);
  assert.equal(Math.floor(replacement.h.loop.captureRecoveryState(f.resumeAt).scoreRaw), result.result.replayed_score);
});

test('process replacement and concurrent receipt recovery do not submit an accepted result again', async () => {
  const apiFixture = path.join(__dirname, 'match-recovery.test.js');
  const parsed = ts.createSourceFile(apiFixture, fs.readFileSync(apiFixture, 'utf8'), ts.ScriptTarget.Latest, true);
  const declarations = parsed.statements.filter(n => ts.isVariableStatement(n) || ts.isFunctionDeclaration(n)).map(n => n.getText(parsed)).join('\n');
  const { harness, payload, reply, official, KEY } = new Function('require', '__dirname', declarations + ';return {harness,payload,reply,official,KEY};')(createRequire(apiFixture), __dirname);
  const original = harness(), data = payload();
  data.input_events = [{ seq: 1, t_ms: 100, type: 'BITE', source: 'CONTROL', x: 0.5, y: 0.5 }];
  data.accepted_taps = 1;
  let sent;
  original.handle((route, opts) => { if (route === '/match/result') { sent = opts.body; throw Error('synthetic process lost after acceptance'); } });
  await assert.rejects(original.api.submitDurableResult(data, 'guest_a'), /synthetic process lost/);
  const bytes = original.values.get(KEY);
  data.match_id = 'caller-mutated'; data.input_events[0].t_ms = 999;
  const replacement = harness(new Map(original.values));
  const identity = { schema_version: 1, player_id: 'guest_a', match_id: 'match-a', contest_id: payload().contest_id };
  replacement.handle(route => {
    assert.equal(route, '/match/receipt', 'restart recovery must not blindly resubmit');
    return reply({ ...identity, status: 'SETTLED',
      receipt: { ...identity, outcome: 'settled', rewards_granted: true, settlement_final: true },
      result: { ...official, verified: true, match_id: 'match-a' } });
  });
  const pending = await replacement.api.pendingResult();
  assert.equal(JSON.stringify(pending.payload), JSON.stringify(JSON.parse(bytes).payload));
  assert.equal(JSON.parse(sent).match_id, pending.match_id);
  assert.equal(pending.payload.input_events[0].t_ms, 100);
  const results = await Promise.all([replacement.api.recoverPendingResult(), replacement.api.recoverPendingResult()]);
  assert.ok(results.every(value => value.status === 'SETTLED'));
  assert.equal(replacement.values.has(KEY), false);
  assert.equal(original.calls.filter(c => c.route === '/match/result').length, 1);
  assert.equal(replacement.calls.filter(c => c.route === '/match/result').length, 0);
});
