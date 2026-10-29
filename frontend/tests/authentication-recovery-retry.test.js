const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const credentialsKey = 'firefeast_guest_credentials_v1';
const oldId = 'guest_' + 'a'.repeat(32);
const newId = 'guest_' + 'b'.repeat(32);
const token = 'synthetic-test-bearer';
const response = (data, status = 200) => ({
  ok: status >= 200 && status < 300, status, headers: { get: () => null },
  text: async () => JSON.stringify(data), json: async () => data,
});
const compiled = new Map();
const flush = async () => { for (let i = 0; i < 100; i++) await Promise.resolve(); };
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

// Execute the actual API module in a fresh VM. All storage, transport and timers
// are in memory. Private entry points are exposed only in this in-memory copy;
// production exports and source files are unchanged.
function harness() {
  const values = new Map([[credentialsKey, JSON.stringify({ version: 1, player_id: oldId, auth_token: token })]]);
  const originalCredentials = values.get(credentialsKey);
  const calls = [], timers = new Map(), modules = new Map();
  let timerId = 0, handler = () => { throw Error('Unexpected mocked request'); }, failPersistence = false, writeHook, removeHook;
  const credentialWrites = [];
  const storage = {
    getItem: async key => values.get(key) ?? null,
    setItem: async (key, value) => { values.set(key, value); },
    removeItem: async key => { values.delete(key); },
    multiGet: async keys => keys.map(key => [key, values.get(key) ?? null]),
    multiRemove: async keys => { if (removeHook) await removeHook(keys); keys.forEach(key => values.delete(key)); },
  };
  const context = vm.createContext({
    __DEV__: false, console: { log() {}, info() {}, warn() {}, error() {} },
    process: { env: { EXPO_PUBLIC_BACKEND_URL: 'https://recovery-test.invalid' } },
    URL, Error, TypeError, AbortController,
    setTimeout(fn, ms) { const id = ++timerId; timers.set(id, { fn, ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
    fetch: async (url, opts) => {
      assert.equal(new URL(url).origin, 'https://recovery-test.invalid');
      const route = new URL(url).pathname.replace(/^\/api/, '');
      calls.push({ route, opts });
      return handler(route, opts);
    },
  });
  function load(filename) {
    if (modules.has(filename)) return modules.get(filename).exports;
    const module = { exports: {} }; modules.set(filename, module);
    if (!compiled.has(filename)) compiled.set(filename, ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText);
    const localRequire = name => {
      if (name === '@react-native-async-storage/async-storage') return { default: storage };
      if (name === 'expo-constants') return { default: {} };
      if (name === 'expo-modules-core') return { uuid: { v4() { throw Error('Unexpected bootstrap'); } } };
      if (name === './utils/storage') return { storage: {
        secureRead: async key => ({ status: 'available', value: values.get(key) ?? null }),
        secureSet: async (key, value) => {
          if (failPersistence) return false;
          if (writeHook) await writeHook(key, value);
          credentialWrites.push([key, value]); values.set(key, value); return true;
        },
        secureRemove: async key => { values.delete(key); return true; },
      } };
      if (name === './playerBalance') return { applyPlayerBalanceResponse() {}, clearPlayerBalance() {} };
      if (!name.startsWith('.')) throw Error('Unexpected dependency: ' + name);
      const base = path.resolve(path.dirname(filename), name);
      assert.ok(base.startsWith(root + path.sep), 'Imports must stay inside this C: frontend');
      return load(fs.existsSync(base + '.ts') ? base + '.ts' : base + '.js');
    };
    const expose = filename === path.join(root, 'src/api.ts')
      ? '\nmodule.exports.testing = {req, rewriteRequestForRecoveredPlayer, alignRequestWithCredentials, clearLocalGuestAuthenticationForReset, clearLocalGuestData, storeCredentials, peekCredentials: () => credentialsCache};' : '';
    vm.runInContext(`(function(require,module,exports){${compiled.get(filename)}${expose}\n})`, context)(localRequire, module, module.exports);
    return module.exports;
  }
  const exports = load(path.join(root, 'src/api.ts'));
  return { ...exports, ...exports.testing, values, calls, timers, originalCredentials, credentialWrites,
    handle(fn) { handler = fn; }, failPersistence() { failPersistence = true; },
    beforeWrite(fn) { writeHook = fn; },
    beforeRemove(fn) { removeHook = fn; },
  };
}

test('recovery rewrites encoded player paths and matching top-level identity fields without mutating input', () => {
  const h = harness(), previous = 'guest old/?', recovered = 'guest new/#';
  const body = { device_id: previous, player_id: previous, other: previous, nested: { player_id: previous }, score: 12 };
  const opts = { method: 'PATCH', headers: { 'X-Test': 'keep' }, body: JSON.stringify(body) };
  const rewritten = h.rewriteRequestForRecoveredPlayer(`/player/${encodeURIComponent(previous)}`, opts, previous, recovered);
  assert.equal(rewritten.path, `/player/${encodeURIComponent(recovered)}`);
  assert.equal(rewritten.opts.method, 'PATCH');
  assert.equal(rewritten.opts.headers, opts.headers);
  assert.deepEqual(JSON.parse(rewritten.opts.body), { ...body, device_id: recovered, player_id: recovered });
  assert.deepEqual(JSON.parse(opts.body), body);
  const unchanged = h.rewriteRequestForRecoveredPlayer('/match/result', { body: JSON.stringify({ player_id: 'someone-else' }) }, previous, recovered);
  assert.deepEqual(JSON.parse(unchanged.opts.body), { player_id: 'someone-else' });
  assert.equal(h.calls.length, 0);
});

test('absent, non-string and malformed JSON bodies are preserved during recovery', () => {
  const h = harness();
  for (const body of [undefined, '', null, { opaque: true }, '{invalid-json', 'null']) {
    const opts = { method: 'DELETE', body };
    const rewritten = h.rewriteRequestForRecoveredPlayer(`/player/${oldId}`, opts, oldId, newId);
    assert.equal(rewritten.path, `/player/${newId}`);
    assert.equal(rewritten.opts, opts);
    assert.equal(rewritten.opts.body, body);
  }
});

for (const [route, method] of [[`/player/${oldId}`, 'GET'], [`/daily/status/${oldId}`, 'PATCH'], [`/matchmaking/status/${oldId}`, 'DELETE'], ['/match/result', 'POST']]) {
  test(`401 recovery retries ${method} ${route.split('/')[1]} once with rewritten identity and preserved options`, async () => {
    const h = harness(), expectedRoute = route.replace(oldId, newId);
    const opts = { method, headers: { 'X-Test': 'keep', Authorization: 'ignored-test-override' },
      body: JSON.stringify({ device_id: oldId, player_id: oldId, score: 42, nested: { player_id: oldId } }) };
    h.handle((path, request) => {
      assert.equal(request.headers.Authorization, `Bearer ${token}`);
      if (path === '/auth/session') { assert.equal(request.method, 'GET'); assert.equal(request.body, undefined); return response({ player_id: newId }); }
      assert.equal(request.method, method);
      assert.equal(request.headers['X-Test'], 'keep');
      const id = h.calls.length === 1 ? oldId : newId;
      assert.deepEqual(JSON.parse(request.body), { device_id: id, player_id: id, score: 42, nested: { player_id: oldId } });
      assert.equal(path, h.calls.length === 1 ? route : expectedRoute);
      return response({ success: true }, h.calls.length === 1 ? 401 : 200);
    });
    assert.equal((await h.req(route, opts)).success, true);
    assert.deepEqual(h.calls.map(c => c.route), [route, '/auth/session', expectedRoute]);
    assert.equal(JSON.parse(h.values.get(credentialsKey)).player_id, newId);
    assert.equal(JSON.parse(opts.body).player_id, oldId);
    assert.equal(h.timers.size, 0);
  });
}

test('credential alignment corrects stale route/body identities before the first request', async () => {
  const h = harness(), stale = 'guest_' + 'c'.repeat(32);
  h.handle((route, opts) => {
    assert.equal(route, `/player/${oldId}`);
    assert.deepEqual(JSON.parse(opts.body), { device_id: oldId, player_id: oldId, nested: { player_id: stale }, count: 3 });
    return response({ aligned: true });
  });
  assert.equal((await h.req(`/player/${stale}`, { method: 'POST', body: JSON.stringify({ device_id: stale, player_id: stale, nested: { player_id: stale }, count: 3 }) })).aligned, true);
  assert.equal(h.calls.length, 1);
});

test('a second 401 fails closed without recursive recovery or a third attempt', async () => {
  const h = harness();
  h.handle(route => route === '/auth/session' ? response({ player_id: newId }) : response({}, 401));
  await assert.rejects(h.req('/contests'), error => error.name === 'AuthenticationError' && error.code === 'AUTH_BEARER_REJECTED');
  assert.deepEqual(h.calls.map(c => c.route), ['/contests', '/auth/session', '/contests']);
  assert.equal(h.timers.size, 0);
});

test('unauthenticated and recovery-disabled requests never trigger session recovery', async () => {
  for (const authenticated of [false, true]) {
    const h = harness(); h.handle(() => response({}, 401));
    await assert.rejects(h.req('/auth/guest', { method: 'POST' }, authenticated, false), { name: 'AuthenticationError' });
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0].opts.headers.Authorization, authenticated ? `Bearer ${token}` : undefined);
    assert.equal(h.timers.size, 0);
  }
});

test('recovery cannot retry a match request under a different owner', async () => {
  const h = harness();
  h.handle(route => route === '/auth/session' ? response({ player_id: newId }) : response({}, 401));
  await assert.rejects(h.req('/match/result', { method: 'POST' }, true, true, 20000, undefined, oldId), /does not own this pending match/);
  assert.deepEqual(h.calls.map(c => c.route), ['/match/result', '/auth/session']);
  assert.equal(h.timers.size, 0);
});

for (const [status, data, code] of [[401, {}, 'AUTH_BEARER_REJECTED'], [503, {}, 'AUTH_NETWORK'], [403, {}, 'AUTH_UNKNOWN'], [200, { player_id: ' ' }, 'AUTH_INVALID_RESPONSE'], [200, { player_id: 42 }, 'AUTH_INVALID_RESPONSE']]) {
  test(`session recovery rejects HTTP ${status} / ${code} without replay or credential loss`, async () => {
    const h = harness();
    h.handle(route => route === '/auth/session' ? response(data, status) : response({}, 401));
    await assert.rejects(h.req('/contests'), error => error.name === 'AuthenticationError' && error.code === code);
    assert.deepEqual(h.calls.map(c => c.route), ['/contests', '/auth/session']);
    assert.equal(h.values.get(credentialsKey), h.originalCredentials);
    assert.equal(h.timers.size, 0);
  });
}

test('failed secure persistence prevents replay and retains original credentials', async () => {
  const h = harness(); h.failPersistence();
  h.handle(route => route === '/auth/session' ? response({ player_id: newId }) : response({}, 401));
  await assert.rejects(h.req('/contests'), error => error.code === 'AUTH_SECURESTORE_UNAVAILABLE');
  assert.equal(h.values.get(credentialsKey), h.originalCredentials);
  assert.equal(h.calls.length, 2);
  assert.equal(h.timers.size, 0);
});

for (const phase of ['transport', 'json']) {
  test(`recovery ${phase} failure propagates without replay and releases the recovery slot`, async () => {
    const h = harness(), failure = Error(`mock ${phase} failure`);
    h.handle(route => {
      if (route !== '/auth/session') return response({}, 401);
      if (phase === 'transport') throw failure;
      return { ...response({}), json: async () => { throw failure; } };
    });
    await assert.rejects(h.req('/contests'), error => error === failure);
    assert.equal(h.calls.length, 2);
    assert.equal(h.values.get(credentialsKey), h.originalCredentials);
    h.handle(route => route === '/auth/session' ? response({ player_id: newId }) : response({}, h.calls.length === 3 ? 401 : 200));
    await h.req('/contests');
    assert.deepEqual(h.calls.map(c => c.route), ['/contests', '/auth/session', '/contests', '/auth/session', '/contests']);
    assert.equal(h.timers.size, 0);
  });
}

test('recovery timeout maps to AUTH_NETWORK and clears both request timers', async () => {
  const h = harness();
  h.handle((route, opts) => {
    if (route !== '/auth/session') return response({}, 401);
    const aborted = new Promise((resolve, reject) => {
      opts.signal.addEventListener('abort', () => { const error = Error('mock abort'); error.name = 'AbortError'; reject(error); }, { once: true });
    });
    const timeout = [...h.timers.values()].find(t => t.ms === h.STARTUP_RECOVERY_TIMEOUT_MS);
    assert.ok(timeout); timeout.fn();
    return aborted;
  });
  await assert.rejects(h.req('/contests'), error => error.code === 'AUTH_NETWORK' && /timed out/.test(error.message));
  assert.equal(h.calls.length, 2);
  assert.equal(h.timers.size, 0);
});

test('concurrent unauthorized requests share one recovery and each retry once', async () => {
  const h = harness();
  let finishRecovery;
  const pendingSession = new Promise(resolve => { finishRecovery = resolve; });
  h.handle(route => {
    if (route === '/auth/session') return pendingSession;
    const attempts = h.calls.filter(c => c.route !== '/auth/session').length;
    return response({ success: true }, attempts <= 2 ? 401 : 200);
  });
  const pending = Promise.all([h.req('/contests'), h.req('/shop')]);
  for (let i = 0; i < 100; i++) await Promise.resolve();
  assert.equal(h.calls.filter(c => c.route === '/auth/session').length, 1);
  assert.equal(h.calls.filter(c => c.route !== '/auth/session').length, 2);
  finishRecovery(response({ player_id: newId }));
  assert.deepEqual((await pending).map(r => r.success), [true, true]);
  for (const route of ['/contests', '/shop']) assert.equal(h.calls.filter(c => c.route === route).length, 2);
  assert.equal(h.calls.length, 5);
  assert.equal(h.timers.size, 0);
});

test('retry HTTP errors propagate as API errors without another recovery', async () => {
  const h = harness();
  h.handle(route => route === '/auth/session' ? response({ player_id: newId })
    : response({ detail: { code: 'MOCK_SERVICE_UNAVAILABLE' } }, h.calls.length === 1 ? 401 : 503));
  await assert.rejects(h.req('/contests'), error => error.name === 'ApiRequestError' && error.status === 503 && error.code === 'MOCK_SERVICE_UNAVAILABLE');
  assert.deepEqual(h.calls.map(c => c.route), ['/contests', '/auth/session', '/contests']);
  assert.equal(h.timers.size, 0);
});

for (const operation of ['clearLocalGuestAuthenticationForReset', 'clearLocalGuestData']) {
  test(`${operation} fences a late session response before credentials can be written`, async () => {
    const h = harness(), late = deferred();
    h.handle(route => route === '/auth/session' ? late.promise : response({}, 401));
    const outcome = h.req('/contests').then(() => null, error => error);
    await flush();
    assert.equal(h.calls.length, 2);
    const clearing = h[operation]();
    await flush();
    late.resolve(response({ player_id: newId }));
    await clearing; const error = await outcome;
    assert.equal(h.values.has(credentialsKey), false);
    assert.equal(h.credentialWrites.length, 0);
    assert.equal(error?.name, 'AuthOperationSupersededError');
    assert.equal(h.calls.length, 2);
    assert.equal(h.timers.size, 0);
  });
}

test('reset drains an already-started secure write before verifying cleared storage', async () => {
  const h = harness(), write = deferred();
  h.beforeWrite(() => write.promise);
  h.handle(route => route === '/auth/session' ? response({ player_id: newId }) : response({}, 401));
  const rejected = assert.rejects(h.req('/contests'), { name: 'AuthOperationSupersededError' });
  await flush();
  let cleared = false;
  const reset = h.clearLocalGuestAuthenticationForReset().then(() => { cleared = true; });
  await flush(); assert.equal(cleared, false);
  write.resolve(); await reset; await rejected;
  assert.equal(h.values.has(credentialsKey), false);
  assert.equal(h.calls.length, 2);
  assert.equal(h.timers.size, 0);
});

test('a late pre-reset 401 cannot recover an old bearer in the new session', async () => {
  const h = harness(), late = deferred();
  h.handle(route => route === '/contests' ? late.promise : response({ player_id: oldId }));
  const outcome = h.req('/contests').then(() => null, error => error);
  await flush(); await h.clearLocalGuestAuthenticationForReset();
  await h.storeCredentials({ playerId: newId, authToken: 'synthetic-new-session' });
  const current = h.values.get(credentialsKey);
  late.resolve(response({}, 401)); const error = await outcome;
  assert.equal(h.values.get(credentialsKey), current);
  assert.equal(h.calls.length, 1);
  assert.equal(error?.name, 'AuthOperationSupersededError');
  assert.equal(h.timers.size, 0);
});

test('a newer persisted session cannot be overwritten by an older recovery response', async () => {
  const h = harness(), late = deferred();
  h.handle(route => route === '/auth/session' ? late.promise : response({}, 401));
  const outcome = h.req('/contests').then(() => null, error => error);
  await flush();
  await h.storeCredentials({ playerId: newId, authToken: 'synthetic-new-session' });
  const current = h.values.get(credentialsKey);
  late.resolve(response({ player_id: oldId })); const error = await outcome;
  assert.equal(h.values.get(credentialsKey), current);
  assert.equal(error?.name, 'AuthOperationSupersededError');
  assert.equal(h.calls.length, 2);
  assert.equal(h.timers.size, 0);
});

test('a cancelled caller never retries while an active caller can finish shared session repair', async () => {
  const h = harness(), late = deferred(), abort = new AbortController();
  h.handle(route => route === '/auth/session' ? late.promise : response({}, h.calls.filter(c => c.route === route).length === 1 ? 401 : 200));
  const rejected = assert.rejects(h.req('/contests', { signal: abort.signal }), { name: 'RequestTimeoutError' });
  const active = h.req('/shop');
  await flush(); abort.abort();
  late.resolve(response({ player_id: newId }));
  await rejected; await active;
  assert.equal(h.calls.filter(c => c.route === '/contests').length, 1);
  assert.equal(h.calls.filter(c => c.route === '/shop').length, 2);
  assert.equal(h.calls.filter(c => c.route === '/auth/session').length, 1);
  assert.equal(JSON.parse(h.values.get(credentialsKey)).player_id, newId);
  assert.equal(h.timers.size, 0);
});

test('reset during legacy-key cleanup cannot repopulate the credential cache', async () => {
  const h = harness(), cleanup = deferred();
  let entered = false;
  h.beforeRemove(keys => {
    if (keys.length === 2 && keys.includes('firefeast_player_id')) { entered = true; return cleanup.promise; }
  });
  h.handle(route => route === '/auth/session' ? response({ player_id: newId }) : response({}, 401));
  const outcome = h.req('/contests').then(() => null, error => error);
  await flush(); assert.equal(entered, true);
  const reset = h.clearLocalGuestAuthenticationForReset();
  cleanup.resolve(); await reset;
  assert.equal((await outcome)?.name, 'AuthOperationSupersededError');
  assert.equal(h.values.has(credentialsKey), false);
  assert.equal(h.peekCredentials(), null);
  assert.equal(h.timers.size, 0);
});

test('successful account deletion cannot be undone by an older session repair', async () => {
  const h = harness(), late = deferred();
  h.handle(route => route === '/auth/session' ? late.promise
    : route === '/player/account' ? response({ deleted: true }) : response({}, 401));
  const outcome = h.req('/contests').then(() => null, error => error);
  await flush();
  const deleted = h.api.deleteAccount();
  await flush(); late.resolve(response({ player_id: newId }));
  assert.equal((await deleted).deleted, true);
  assert.equal((await outcome)?.name, 'AuthOperationSupersededError');
  assert.equal(h.values.has(credentialsKey), false);
  assert.equal(h.peekCredentials(), null);
  assert.equal(h.timers.size, 0);
});

test('cancellation before a late 401 prevents recovery and credential writes', async () => {
  const h = harness(), late = deferred(), abort = new AbortController();
  h.handle(() => late.promise);
  const rejected = assert.rejects(h.req('/contests', { signal: abort.signal }), { name: 'RequestTimeoutError' });
  await flush(); abort.abort(); late.resolve(response({}, 401)); await rejected;
  assert.equal(h.calls.length, 1);
  assert.equal(h.credentialWrites.length, 0);
  assert.equal(h.timers.size, 0);
});
