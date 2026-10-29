const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { localEnvironment, runStage, plan } = require('../scripts/validate-local-release');
const { frontendContracts, compare } = require('../scripts/validation/api-contracts');
test('local environment excludes credentials and relative search paths', () => {
  const env = localEnvironment({ Path: ['C:\\Windows', 'D:\\Tools', 'relative', 'C:\\Python'].join(path.delimiter), MONGO_URL: 'secret', EXPO_PUBLIC_BACKEND_URL: 'secret', FIRE_FEAST_INTEGRATION_AUTH_TOKEN: 'secret', HTTP_PROXY: 'secret' });
  assert.equal(env.Path, ['C:\\Windows', 'D:\\Tools', 'C:\\Python'].join(path.delimiter));
  for (const key of ['MONGO_URL', 'EXPO_PUBLIC_BACKEND_URL', 'FIRE_FEAST_INTEGRATION_AUTH_TOKEN', 'HTTP_PROXY']) assert.equal(env[key], undefined);
  assert.equal(env.PYTHON_DOTENV_DISABLED, '1'); assert.equal(env.PYTEST_DISABLE_PLUGIN_AUTOLOAD, '1');
});
test('evidence records actual command, output, exit code and missing executable', () => {
  for (const [result, status] of [[{ status: 0, stdout: 'ok' }, 'PASS'], [{ status: 7, stderr: 'bad' }, 'FAIL'], [{ status: null, error: { code: 'ENOENT' } }, 'NOT RUN'], [{ status: null, error: { code: 'ETIMEDOUT' } }, 'FAIL']]) {
    const stage = runStage('probe', 'tool', ['arg'], 'C:\\probe', () => result);
    assert.equal(stage.status, status); assert.equal(stage.exitCode, result.status); assert.deepEqual(stage.command, ['tool', 'arg']);
    assert.equal(stage.output, (result.stdout || '') + (result.stderr || ''));
  }
});
test('plan runs full suite once without live integration, installs or builds', () => {
  const stages = plan(); assert.equal(stages.filter(s => s[0] === 'Frontend unit/regression suite').length, 1);
  assert.doesNotMatch(JSON.stringify(stages), /npm (?:ci|install)|pip install|eas build|validate-integration/);
  assert.ok(stages.some(s => s[0] === 'Backend deterministic tests'));
  assert.ok(stages.some(s => s[0] === 'API source contracts'));
  for (const s of stages) assert.ok(path.isAbsolute(s[3]));
});
test('Python adapter blocks network and retains all deterministic gate tests', () => {
  const source = fs.readFileSync(path.join(__dirname, '../scripts/validation/backend-local.py'), 'utf8');
  assert.match(source, /sys.addaudithook\(deny_network\)/); assert.match(source, /socket.connect/);
  assert.match(source, /"not integration"/); assert.match(source, /"no:cacheprovider"/);
  assert.doesNotMatch(source, /--ignore|deselect|MongoClient\(/);
  const check = runStage('asyncio/network guard', 'python', ['-B', path.join(__dirname, '../scripts/validation/backend-local.py'), 'guard-check'], path.join(__dirname, '..'));
  assert.equal(check.status, 'PASS', check.output);
});
test('parser extracts methods, dynamic paths and typed spread fields', () => {
  const source = 'const send = (payload: { match_id: string; score: number }) => req("/match/result", {method: "POST", body: JSON.stringify({device_id: "test", ...payload})}); const get = (id: string) => req(`/player/${id}`);';
  const contracts = frontendContracts(source);
  assert.equal(contracts[0].method, 'POST'); assert.deepEqual(contracts[0].fields, ['device_id', 'match_id', 'score']);
  assert.equal(contracts[1].path, '/player/{}'); assert.equal(contracts[1].method, 'GET');
});
test('contract mismatches fail; forwarded options remain explicitly partial', () => {
  const backend = [{ path: '/api/match/start', method: 'POST', model: 'MatchStart', required: ['contest_id'], fields: ['contest_id'] }];
  assert.equal(compare([], backend, ['/match/start']).errors.length, 1);
  assert.equal(compare([{ path: '/match/start', method: 'GET' }], backend, ['/match/start']).errors.length, 1);
  assert.equal(compare([{ path: '/match/start', method: 'POST', fields: ['wrong'] }], backend, ['/match/start']).errors.length, 2);
  assert.equal(compare([{ path: '/match/start', method: 'UNRESOLVED', fields: null }], backend, ['/match/start']).coverage[0].status, 'PARTIAL');
});

const { validate, mutations, redact, sanitize, writeEvidence } = require('../scripts/validate-local-release');
const trustedManifest = 'c204a48505bd3acc9325c75aa0dcf2115a0c3ac82b9d711954af8657a432e584';
const initial = () => ({ files: { 'provenance/FRONTEND-PRESERVATION-MANIFEST.txt': trustedManifest, 'tracked.ts': 'a', 'untracked.txt': 'b' }, head: 'head', index: 'index', status: 'status' });
function harness(overrides = {}) {
  const saved = [];
  let reads = 0, runs = 0;
  const options = {
    stages: [['probe', 'tool', [], 'C:\\probe']],
    observe: () => { reads++; return initial(); },
    execute: () => { runs++; return { name: 'probe', status: 'PASS', exitCode: 0 }; },
    persist: report => saved.push(JSON.parse(JSON.stringify(report))),
    ...overrides,
  };
  return { ...validate(options), saved, reads, runs };
}
test('dynamic, shorthand, and forwarded methods never default to GET', () => {
  for (const options of ['{method: verb}', '{method}', 'options', '{[key]: value}']) assert.equal(frontendContracts('req("/x", ' + options + ')')[0].method, 'UNRESOLVED');
  assert.equal(frontendContracts('req("/x")')[0].method, 'GET');
});
test('method spreads obey JavaScript precedence, including literal nested spreads', () => {
  const parse = text => frontendContracts('req("/x", ' + text + ')')[0];
  assert.equal(parse('{method: "POST", ...options}').method, 'UNRESOLVED');
  assert.equal(parse('{...options, "method": "POST"}').method, 'POST');
  assert.equal(parse('{method: "POST", ...{method: "DELETE"}}').method, 'DELETE');
  assert.equal(parse('{method: "POST", ...{headers: {}}}').method, 'POST');
  assert.equal(parse('{method: "POST", body: JSON.stringify({id: 1}), ...options}').fields, null);
});
test('optional fields, undefined unions, and optional spread overrides cannot satisfy required fields', () => {
  const backend = [{ path: '/api/x', method: 'POST', model: 'Body', fields: ['id'], required: ['id'] }];
  for (const shape of ['id?: string', 'id: string | undefined', 'id: any']) {
    const parsed = frontendContracts('const send = (payload: {' + shape + '}) => req("/x", {method: "POST", body: JSON.stringify({...payload})});');
    assert.deepEqual(parsed[0].fields, ['id']);
    assert.deepEqual(parsed[0].requiredFields, []);
    const result = compare(parsed, backend, ['/x']);
    assert.equal(result.status, 'FAIL'); assert.match(result.errors[0], /optional/);
  }
  const parsed = frontendContracts('const send = (payload: {id?: string}) => req("/x", {method: "POST", body: JSON.stringify({id: "set", ...payload})});');
  assert.deepEqual(parsed[0].requiredFields, []);
});
test('dynamic routes and unknown required-field guarantees remain partial', () => {
  assert.equal(compare(frontendContracts('req(route)'), [], []).status, 'PARTIAL');
  const result = compare([{path: '/x', method: 'POST', fields: ['id']}], [{path: '/api/x', method: 'POST', model: 'Body', required: ['id'], fields: ['id']}], ['/x']);
  assert.equal(result.status, 'PARTIAL');
});
test('successful complete validation has terminal evidence and zero exit', () => {
  const result = harness();
  assert.equal(result.exitCode, 0); assert.equal(result.report.localResult, 'PASS');
  assert.equal(result.saved[0].localResult, 'RUNNING'); assert.equal(result.saved[0].terminal, false);
  assert.equal(result.saved.at(-1).terminal, true); assert.equal(result.reads, 2);
});
test('preflight exceptions produce terminal failure without source observation', () => {
  const result = harness({ preflight() { throw Error('preflight failed'); } });
  assert.equal(result.exitCode, 1); assert.equal(result.reads, 0); assert.equal(result.runs, 0);
  assert.equal(result.saved.at(-1).localResult, 'FAIL'); assert.equal(result.saved.at(-1).terminal, true);
});
test('source read exceptions stop without retries or executing checks', () => {
  let reads = 0;
  const result = harness({ observe() { reads++; throw Object.assign(Error('read failed'), {code: 'EIO'}); } });
  assert.equal(reads, 1); assert.equal(result.runs, 0); assert.equal(result.exitCode, 1);
});
test('report-write failures always return failure and never retry a failed writer', () => {
  for (const failAt of [1, 2, 3]) {
    let writes = 0;
    const result = harness({ persist() { if (++writes === failAt) throw Error('disk full'); } });
    assert.equal(writes, failAt); assert.equal(result.exitCode, 1);
    assert.equal(result.report.localResult, 'FAIL'); assert.match(result.report.evidenceStatus, /FAIL/);
  }
});
test('atomic evidence publication does not expose an incomplete PASS on write failure', () => {
  let renamed = false;
  assert.throws(() => writeEvidence('C:\\reports\\report.json', {localResult: 'PASS'}, {
    mkdirSync() {}, writeFileSync() { throw Error('disk full'); }, renameSync() { renamed = true; },
  }), /disk full/);
  assert.equal(renamed, false);
  let writes = 0;
  assert.throws(() => writeEvidence('C:\\reports\\report.json', {}, {
    mkdirSync() {}, writeFileSync() { writes++; }, renameSync() { throw Error('rename failed'); },
  }), /rename failed/);
  assert.equal(writes, 1);
});
test('tracked modification, untracked addition/deletion, index and manifest mutations fail', () => {
  for (const change of [s => { s.files['tracked.ts'] = 'changed'; }, s => { s.files['new.txt'] = 'new'; }, s => { delete s.files['untracked.txt']; }, s => { s.files['provenance/FRONTEND-PRESERVATION-MANIFEST.txt'] = 'changed'; }, s => { s.index = 'changed'; }]) {
    let count = 0;
    const result = harness({observe() { const state = initial(); if (++count === 2) change(state); return state; }});
    assert.equal(result.exitCode, 1); assert.equal(result.report.mutations.length, 1);
  }
  assert.deepEqual(mutations(initial(), initial()), []);
});
test('incorrect initial manifest prevents all validation commands', () => {
  const result = harness({observe() { const state = initial(); state.files['provenance/FRONTEND-PRESERVATION-MANIFEST.txt'] = 'wrong'; return state; }});
  assert.equal(result.exitCode, 1); assert.equal(result.runs, 0);
});
test('integrity failure stops remaining stages and prevents follow-up filesystem reads', () => {
  const result = harness({stages: [['one', 'tool', [], 'C:\\probe'], ['two', 'tool', [], 'C:\\probe']], execute: () => ({status: 'FAIL', exitCode: 1, integrityFailure: true})});
  assert.equal(result.exitCode, 1); assert.equal(result.reads, 1);
  assert.equal(result.report.stages[1].status, 'NOT RUN');
  assert.match(result.report.failure, /no final filesystem/);
});
test('missing, failed, partial or empty checks cannot produce false PASS', () => {
  for (const status of ['NOT RUN', 'FAIL', 'PARTIAL']) assert.equal(harness({execute: () => ({status, exitCode: 2})}).exitCode, 1);
  assert.equal(harness({stages: []}).exitCode, 1);
});
test('thrown process errors preserve failure exit and integrity signals', () => {
  const result = runStage('probe', 'tool', [], 'C:\\probe', () => { throw Object.assign(Error('I/O'), {code: 'EIO'}); });
  assert.equal(result.status, 'FAIL'); assert.equal(result.exitCode, null); assert.equal(result.integrityFailure, true);
});
test('redaction covers known credentials and common output forms without claiming completeness', () => {
  const output = redact('secretValue Bearer abc123 mongodb://user:pass@host/db password="hello" api_key=abc&x=1', {APP_TOKEN: 'secretValue'});
  for (const secret of ['secretValue', 'abc123', 'user:pass', 'hello', 'api_key=abc']) assert.ok(!output.includes(secret));
  assert.deepEqual(sanitize({token: 'hidden', children: ['Bearer private']}), {token: '[REDACTED]', children: ['Bearer [REDACTED]']});
  const stage = runStage('probe', 'tool', [], 'C:\\probe', () => ({status: 1, stderr: 'Authorization: Bearer private'}));
  assert.doesNotMatch(stage.output, /private/);
});
test('network boundary and redaction limitations are explicit in documentation', () => {
  const doc = fs.readFileSync(path.join(__dirname, '../RELEASE-VALIDATION.md'), 'utf8');
  assert.match(doc, /child processes do not inherit/i);
  assert.match(doc, /not an OS.*sandbox/i);
  assert.match(doc, /cannot guarantee.*secret/i);
  assert.match(doc, /Build 19/);
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname, '../eslint.config.js'), 'utf8'), /rules-of-hooks.*off/);
});

test('published structured credentials and multi-cookie headers are redacted', () => {
  let output;
  writeEvidence('C:\\reports\\probe.json', { nested: { client_secret: 'secret-one', access_token: 'secret-two' }, output: 'Cookie: first=private-one; second=private-two\nSet-Cookie: sid=private-three; Secure' }, {
    mkdirSync() {}, writeFileSync(p, data) { output = data; }, renameSync() {},
  });
  for (const secret of ['secret-one', 'secret-two', 'private-one', 'private-two', 'private-three']) assert.ok(!output.includes(secret));
});
