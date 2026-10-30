const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { execFileSync } = require('node:child_process');
const test = require('node:test');
const ts = require('typescript');
const { harness } = require('./helpers/gameplay-harness');
const { createInputLogBuffer } = require('../src/game/inputLog');
const { createActiveMatchInputLogPersistence, ACTIVE_MATCH_INPUT_LOG_KEY } = require('../src/game/activeMatchInputLog');
const { createResultSubmissionCoordinator } = require('../src/game/resultSubmission');
const fixture = path.join(__dirname, 'gameplay-recovery-replay.test.js');
const declarations = fs.readFileSync(fixture, 'utf8').split('for (const contest of contests) test')[0];
const { contests, authority, memory, evidenceFor } = new Function('require', '__dirname',
  declarations + ';return {contests,authority,memory,evidenceFor};')(createRequire(fixture), __dirname);
const contest = contests.find(c => c.id === 'nathans-hotdogs');
const duration = contest.duration_sec * 1000;
const config = { seed: 1, finalScore: 214, pacePerSec: 214 / contest.duration_sec, durationSec: contest.duration_sec };
const plain = x => JSON.parse(JSON.stringify(x));
const play = fs.readFileSync(path.join(__dirname, '../app/play/[contestId].tsx'), 'utf8');
const playAst = ts.createSourceFile('play.tsx', play, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let recoveryEffect;
function visit(n) {
  if (ts.isCallExpression(n) && n.expression.getText(playAst) === 'useEffect' && n.arguments[0]?.getText(playAst).includes('if (!resumeGame(pending.state, recoveryElapsedMs))')) recoveryEffect = n.arguments[0];
  ts.forEachChild(n, visit);
}
visit(playAst); assert.ok(recoveryEffect);
const payloadSource = play.slice(play.indexOf('const completedPayload = resultSubmission.preserve('), play.indexOf('if (__DEV__) console.info("Completed result payload ready"'));
function session(clock) {
  const h = harness(false, undefined, true, { mechanic: contest.bite_mechanic,
    loop: { foodId: contest.id, duration: contest.duration_sec, opponentConfig: config } });
  h.setNow(clock.now);
  const log = createInputLogBuffer(() => clock.now); log.start(duration, clock.now);
  return { h, log, origin: clock.now };
}
function tap(s, clock, elapsed) {
  clock.now = s.origin + elapsed; s.h.setNow(clock.now);
  assert.notEqual(s.h.handler(s.log, s.origin).tap(evidenceFor(contest)), null);
}
function payload(s) {
  return s.h.evaluate('(() => {' + payloadSource + '\nreturn completedPayload; })()', {
    resultSubmission: createResultSubmissionCoordinator(async () => {}),
    matchId: 'synthetic-match', selectedContestId: contest.id, state: s.h.latestState(),
    opponentScore: s.h.latestOpponentScore(), duration: contest.duration_sec, highestCombo: -999,
    opponentId: 'fixture-opponent', playerAntacidCount: 3, antacidCount: s.h.latestState().antacidCount,
    tournamentOccurrenceId: null, finalizedInputEvents: s.log.finish(),
  });
}
const validateScript = "import ast,json,sys,logging,math,time\nfrom datetime import datetime,timedelta,timezone\nfrom pathlib import Path\ndef deny(event,args):\n if event.startswith('socket.'):raise RuntimeError('Network forbidden')\nsys.addaudithook(deny)\nroot=Path(sys.argv[1]);sys.path.insert(0,str(root));sys.path.append(sys.argv[2])\nfrom services.match_validation import *\nfrom models import MatchResult\nnames={'_parse_server_timestamp','_result_payload','_validation_telemetry','_plausibility_bounds','_validate_result'}\nsource=ast.parse((root/'services/match_service.py').read_text(encoding='utf-8-sig'))\nfunctions=[n for n in source.body if isinstance(n,ast.FunctionDef) and n.name in names]\nassert len(functions)==len(names)\nMATCH_SCHEMA_VERSION=4\nMATCH_SUBMISSION_GRACE_SECONDS=120\nMATCH_START_CLOCK_TOLERANCE_SECONDS=8\nMATCH_DURATION_TOLERANCE_SECONDS=8\nlogger=logging.getLogger('offline-result')\ndef _reject_match(device_id,active,reason,*args,**kwargs):raise ValueError(reason)\nexec(compile(ast.Module(body=functions,type_ignores=[]),'<existing-backend-validation>','exec'),globals())\np=json.load(sys.stdin);result=MatchResult(device_id='synthetic-player',**p)\nfrom data.contests import CONTESTS\nc=next(c for c in CONTESTS if c['id']==result.contest_id)\nstart=datetime(2026,10,30,tzinfo=timezone.utc)\nactive={'schema_version':4,'validation_version':3,'match_seed':'a'*64,'device_id':'synthetic-player','status':'active',\n 'contest_id':c['id'],'opponent_id':'fixture-opponent','started_at':start.isoformat(),\n 'expires_at':(start+timedelta(seconds=c['duration_sec']+120)).isoformat(),'allowed_duration_sec':c['duration_sec'],\n 'starting_antacid':3,'perk_modifiers':BASE_PERK_MODIFIERS,\n 'challenge_config':dict(c,contest_id=c['id'],heat_per_tap=trusted_heat_per_tap(c)),'opponent_config':{'final_score':214}}\nanswer,status=_validate_result(active,result,start+timedelta(seconds=c['duration_sec']+4))\nprint(json.dumps({'status':status,'replay':answer['replay']}))\n";
function validate(p) {
  const allowed = new Set(['systemroot','windir','comspec','temp','tmp','programfiles']);
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => allowed.has(k.toLowerCase())));
  const python = process.platform === 'win32' ? 'C:\\Program Files\\Python314\\python.exe' : 'python3';
  const userSite = process.platform === 'win32' ? path.join(process.env.APPDATA || '', 'Python', 'Python314', 'site-packages') : '';
  return JSON.parse(execFileSync(python, ['-I','-B','-c',validateScript,path.resolve(__dirname,'../../backend'),userSite],
    { input: JSON.stringify(p), encoding: 'utf8', env, windowsHide: true, timeout: 15000 }));
}
for (const interruptions of [[], [5000], [5000, 10000], [duration]]) {
  test('complete payload passes backend validation after interruptions ' + JSON.stringify(interruptions), async t => {
    const clock = { now: 10000 }; t.mock.method(Date, 'now', () => clock.now);
    const storage = memory(); let s = session(clock);
    let persistence = createActiveMatchInputLogPersistence(storage);
    await persistence.bind(authority(contest), s.log);
    for (let elapsed = 100; elapsed <= 1200; elapsed += 100) tap(s, clock, elapsed);
    tap(s, clock, 3000);
    assert.equal(s.h.latestState().maximumCombo, 11);
    assert.equal(s.h.latestState().combo, 0);
    for (const elapsed of interruptions) {
      await persistence.flush(s.log, plain(s.h.loop.captureRecoveryState(s.log.elapsed())));
      const bytes = storage.values.get(ACTIVE_MATCH_INPUT_LOG_KEY);
      clock.now += 50000;
      const next = session(clock); next.log = createInputLogBuffer(() => clock.now);
      persistence = createActiveMatchInputLogPersistence(storage);
      const recovered = await persistence.bind(authority(contest, elapsed), next.log);
      next.origin = recovered.localOrigin - elapsed;
      assert.equal(next.h.loop.resumeGame(recovered.gameplayState, elapsed), true);
      assert.equal(storage.values.get(ACTIVE_MATCH_INPUT_LOG_KEY), bytes);
      assert.equal(next.h.latestState().maximumCombo, 11);
      if (elapsed < duration) assert.ok(next.h.latestOpponentScore() > 0);
      s = next;
    }
    clock.now = s.origin + duration; s.h.setNow(clock.now); s.h.loop.synchronizeMatchClock();
    assert.equal(s.h.latestState().status, 'FINISHED');
    assert.equal(s.h.latestOpponentScore(), config.finalScore);
    const p = plain(payload(s)); assert.equal(p.maximum_combo, 11); assert.equal(p.opponent_score, 214);
    const checked = validate(p);
    assert.equal(checked.replay.maximum_combo, p.maximum_combo);
    assert.equal(checked.replay.accepted_taps, p.accepted_taps);
    const timers = s.h.timers.size; s.h.loop.synchronizeMatchClock();
    assert.equal(s.h.timers.size, timers); assert.deepEqual(plain(payload(s)), p);
  });
}
test('nonempty legacy checkpoint missing maximum preserves evidence and fails closed', async t => {
  const clock = { now: 10000 }; t.mock.method(Date, 'now', () => clock.now);
  const s = session(clock), storage = memory(), persistence = createActiveMatchInputLogPersistence(storage);
  await persistence.bind(authority(contest), s.log); tap(s, clock, 100);
  const saved = plain(s.h.loop.captureRecoveryState(100)); delete saved.maximumCombo;
  await persistence.flush(s.log, saved);
  const bytes = storage.values.get(ACTIVE_MATCH_INPUT_LOG_KEY);
  const next = session(clock); next.log = createInputLogBuffer(() => clock.now);
  const restoredPersistence = createActiveMatchInputLogPersistence(storage);
  const restored = await restoredPersistence.bind(authority(contest, 5000), next.log);
  const errors = [];
  next.h.evaluate('(' + recoveryEffect.getText(playAst) + ')();', {
    contestLoaded: true, identityHydrated: true, started: { current: false },
    pendingGameplayRecovery: { current: { state: restored.gameplayState, elapsedMs: 5000 } },
    matchStartedAt: { current: clock.now - 5000 }, resumeGame: next.h.loop.resumeGame,
    inputLogPersistence: restoredPersistence, setMatchStartFailureMessage() {},
    setMatchStartError: value => errors.push(value),
    startMatchIntro() { assert.fail('Refused recovery must not start a replacement'); },
  });
  assert.deepEqual(errors, [true]);
  assert.equal(await restoredPersistence.flush(next.log, next.h.loop.captureRecoveryState(5000)), false);
  assert.equal(storage.values.get(ACTIVE_MATCH_INPUT_LOG_KEY), bytes);
  assert.equal(next.h.latestState().acceptedTapCount, 0);
});
test('empty legacy checkpoint proves zero; malformed maximum is rejected before mutation', () => {
  const s = session({ now: 10000 }), saved = plain(s.h.loop.captureRecoveryState(0)); delete saved.maximumCombo;
  assert.equal(s.h.loop.resumeGame(saved, 1000), true);
  assert.equal(s.h.latestState().maximumCombo, 0);
  for (const maximumCombo of [-1, 0.5, NaN, 1]) assert.equal(s.h.loop.resumeGame({ ...saved, maximumCombo }, 1000), false);
});
test('complete recovered payload retains identical serialized retries', async () => {
  const clock = { now: 10000 }, s = session(clock);
  tap(s, clock, 100); clock.now = s.origin + duration; s.h.setNow(clock.now); s.h.loop.synchronizeMatchClock();
  const requests = [], coordinator = createResultSubmissionCoordinator(async body => { requests.push(JSON.stringify(body)); return {}; });
  coordinator.preserve(plain(payload(s))); await coordinator.submit(); await coordinator.submit();
  assert.equal(requests.length, 2); assert.equal(requests[0], requests[1]); validate(JSON.parse(requests[0]));
});

