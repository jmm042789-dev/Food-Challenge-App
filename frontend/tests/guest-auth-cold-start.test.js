/* global __dirname */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const ts = require("typescript");

const CREDENTIALS = "firefeast_guest_credentials_v1";
const NONCE = "firefeast_bootstrap_recovery_nonce_v1";
const TOKEN = "firefeast_bootstrap_recovery_token_v1";
const INSTALLATION = "firefeast_installation_id";
const flush = async () => { for (let i = 0; i < 100; i++) await Promise.resolve(); };
function deferred() {
  let resolve, reject;
  const promise = new Promise((r, j) => { resolve = r; reject = j; });
  return { promise, resolve, reject };
}
function clock() {
  let now = 0, sequence = 0;
  const timers = new Map();
  return {
    timers,
    setTimeout(fn, ms) { const id = ++sequence; timers.set(id, { at: now + ms, ms, fn }); return id; },
    clearTimeout(id) { timers.delete(id); },
    async tick(ms) {
      const end = now + ms;
      await flush();
      while (true) {
        const next = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        now = next[1].at; timers.delete(next[0]); next[1].fn(); await flush();
      }
      now = end; await flush();
    },
  };
}
const response = (data, status = 200) => ({
  ok: status < 400, status, headers: { get: () => null },
  text: async () => JSON.stringify(data), json: async () => data,
});
const guest = (id = "guest_first") => ({ player_id: id, auth_token: `token_${id}`, player: { player_id: id, tutorial_done: false, coins: 500 } });
function harness(initial = {}) {
  const time = clock(), values = new Map(Object.entries(initial)), calls = [], balances = [];
  const writes = [];
  let handler = () => response({});
  const asyncStorage = {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => { values.set(key, value); },
    removeItem: async (key) => { values.delete(key); },
    multiGet: async (keys) => keys.map((key) => [key, values.get(key) ?? null]),
    multiRemove: async (keys) => { keys.forEach((key) => values.delete(key)); },
  };
  const storage = {
    secureRead: async (key) => ({ status: "available", value: values.get(key) ?? null }),
    secureSet: async (key, value) => { writes.push([key, value]); values.set(key, value); return true; },
    secureRemove: async (key) => { values.delete(key); return true; },
  };
  const modules = new Map();
  const context = vm.createContext({
    console: { info() {}, warn() {}, error() {}, log() {} }, __DEV__: false,
    process: { env: { EXPO_PUBLIC_BACKEND_URL: "https://local.invalid" } },
    Error, TypeError, URL, AbortController,
    setTimeout: time.setTimeout, clearTimeout: time.clearTimeout,
    fetch: async (url, opts) => {
      const route = new URL(url).pathname.replace(/^\/api/, "");
      calls.push({ route, opts, deadlines: [...time.timers.values()].map((t) => t.ms) });
      return handler(route, opts);
    },
  });
  function load(filename) {
    if (modules.has(filename)) return modules.get(filename).exports;
    const module = { exports: {} }; modules.set(filename, module);
    const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const localRequire = (name) => {
      if (name === "@react-native-async-storage/async-storage") return { default: asyncStorage };
      if (name === "expo-constants") return { default: {} };
      if (name === "expo-modules-core") return { uuid: { v4: () => require("node:crypto").randomUUID() } };
      if (name === "./utils/storage") return { storage };
      if (name === "./playerBalance") return { applyPlayerBalanceResponse: (data) => balances.push(data), clearPlayerBalance() {} };
      if (!name.startsWith(".")) throw new Error(`Unexpected import: ${name}`);
      const base = path.resolve(path.dirname(filename), name);
      return load(fs.existsSync(`${base}.ts`) ? `${base}.ts` : `${base}.js`);
    };
    vm.runInContext(`(function(require,module,exports){${code}\n})`, context)(localRequire, module, module.exports);
    return module.exports;
  }
  const api = load(path.join(__dirname, "../src/api.ts"));
  const retry = load(path.join(__dirname, "../src/startupReliability.ts")).withTransientStartupRetry;
  return { ...api, time, values, writes, calls, balances, retry, handle(fn) { handler = fn; } };
}
function finishRoutes(h, route, opts, id = "guest_first") {
  if (route === "/auth/session") {
    const saved = h.values.get(CREDENTIALS);
    return saved ? response({ player_id: JSON.parse(saved).player_id }) : response({}, 401);
  }
  if (route.startsWith("/player/")) return response(guest(id).player);
  return response({});
}

for (const delay of [25000, 60000, 85000]) {
  test(`fresh bootstrap succeeds at ${delay / 1000}s with one request and concurrent callers`, async () => {
    const h = harness(), pending = deferred();
    h.handle((route, opts) => route === "/auth/guest" ? pending.promise : finishRoutes(h, route, opts));
    let done = false;
    const result = h.retry(() => h.api.getPlayer(), { operationName: "cold-start" }).then((v) => { done = true; return v; });
    const concurrent = h.getDeviceId();
    await h.time.tick(delay);
    assert.equal(done, false);
    assert.equal(h.calls.filter((c) => c.route === "/auth/guest").length, 1);
    assert.ok(h.calls[0].deadlines.includes(90000));
    pending.resolve(response(guest()));
    assert.equal((await result).player_id, "guest_first");
    assert.equal(await concurrent, "guest_first");
    assert.equal(h.time.timers.size, 0);
    assert.equal(h.writes.filter(([key]) => key === CREDENTIALS).length, 1);
  });
}

for (const latePhase of ["transport", "body"]) {
  test(`90s expiry blocks late ${latePhase}, persistence, and overwrite after recovery`, async () => {
    const h = harness(), late = deferred();
    let bootstraps = 0;
    h.handle((route, opts) => {
      if (route === "/auth/guest") {
        if (++bootstraps === 1) return latePhase === "transport" ? late.promise : { ...response({}), text: () => late.promise };
        return response({ detail: { code: "GUEST_BOOTSTRAP_EXISTS" } }, 409);
      }
      if (route === "/auth/guest/recover") return response({ player_id: "guest_recovered", player: guest("guest_recovered").player });
      return finishRoutes(h, route, opts);
    });
    const first = h.getDeviceId();
    const rejected = assert.rejects(first, (e) => e.name === "RequestTimeoutError" && e.timeoutMs === 90000);
    await h.time.tick(89999);
    assert.equal(h.values.has(CREDENTIALS), false);
    await h.time.tick(1); await rejected;
    assert.equal(h.values.has(CREDENTIALS), false);
    assert.equal(h.balances.length, 0);
    const originalBody = h.calls[0].opts.body;
    assert.equal(h.calls[0].opts.signal.aborted, true);
    assert.equal(await h.getDeviceId(), "guest_recovered");
    assert.equal(h.calls.filter((c) => c.route === "/auth/guest")[1].opts.body, originalBody);
    const saved = h.values.get(CREDENTIALS), balanceCount = h.balances.length;
    late.resolve(latePhase === "transport" ? response(guest("guest_late")) : JSON.stringify(guest("guest_late")));
    await flush();
    assert.equal(h.values.get(CREDENTIALS), saved);
    assert.equal(await h.getDeviceId(), "guest_recovered");
    assert.equal(h.balances.length, balanceCount);
    assert.equal(h.writes.filter(([key]) => key === CREDENTIALS).length, 1);
    assert.equal(h.time.timers.size, 0);
  });
}

for (const material of [{ [NONCE]: "nonce" }, { [TOKEN]: JSON.stringify({ version: 1, auth_token: "pending" }) }, { [TOKEN]: "malformed" }, { firefeast_bootstrap_completion_pending_v1: "true" }]) {
  test(`persisted recovery material retains 20s: ${Object.keys(material)[0]} ${Object.values(material)[0]}`, async () => {
    const h = harness({ [INSTALLATION]: "same_installation", ...material });
    h.handle(() => new Promise(() => {}));
    const rejected = assert.rejects(h.getDeviceId(), (e) => e.name === "RequestTimeoutError" && e.timeoutMs === 20000);
    await h.time.tick(20000); await rejected;
    assert.equal(h.values.get(INSTALLATION), "same_installation");
    assert.ok(h.calls[0].deadlines.includes(20000));
  });
}

test("recovery, completion, session, player, and ordinary API deadlines stay unchanged", async () => {
  const h = harness();
  h.handle((route, opts) => {
    if (route === "/auth/guest") return response({ detail: { code: "GUEST_BOOTSTRAP_EXISTS" } }, 409);
    if (route === "/auth/guest/recover") return response({ player_id: "guest_first", player: guest().player });
    return finishRoutes(h, route, opts);
  });
  await h.api.getPlayer(); await h.api.listContests();
  for (const [route, deadline] of [["/auth/guest/recover", 20000], ["/auth/guest/complete", 12000], ["/auth/session", 12000], ["/player/guest_first", 18000], ["/contests", 8000]]) {
    assert.deepEqual(h.calls.find((c) => c.route === route).deadlines, [deadline]);
  }
});

test("complete persisted recovery probes the session then bootstraps with 20s", async () => {
  const h = harness({ [INSTALLATION]: "existing", [NONCE]: "nonce", [TOKEN]: JSON.stringify({ version: 1, auth_token: "pending" }) });
  h.handle((route, opts) => route === "/auth/guest" ? response(guest()) : finishRoutes(h, route, opts));
  assert.equal(await h.getDeviceId(), "guest_first");
  assert.equal(h.calls[0].route, "/auth/session");
  assert.deepEqual(h.calls.find((c) => c.route === "/auth/guest").deadlines, [20000, 20000]);
});

test("guest recovery aborts at 20s and preserves recovery material", async () => {
  const h = harness();
  h.handle((route, opts) => {
    if (route === "/auth/guest") return response({ detail: { code: "GUEST_BOOTSTRAP_EXISTS" } }, 409);
    return new Promise((_resolve, reject) => opts.signal.addEventListener("abort", () => {
      const error = new Error("aborted"); error.name = "AbortError"; reject(error);
    }));
  });
  const rejected = assert.rejects(h.getDeviceId());
  await h.time.tick(19999);
  const recovery = h.calls.find((c) => c.route === "/auth/guest/recover");
  assert.equal(recovery.opts.signal.aborted, false);
  await h.time.tick(1); await rejected;
  assert.equal(recovery.opts.signal.aborted, true);
  assert.equal(h.values.has(CREDENTIALS), false);
  assert.equal(h.values.has(NONCE), true);
  assert.equal(h.values.has(TOKEN), true);
});

test("bounded retries preserve installation and nonce, and only the first gets 90s", async () => {
  const h = harness();
  h.handle((route) => route === "/auth/session" ? response({}, 401) : response({}, 503));
  await assert.rejects(h.retry(() => h.getDeviceId(), { operationName: "test", sleep: async () => {} }));
  const requests = h.calls.filter((c) => c.route === "/auth/guest");
  assert.equal(requests.length, 3);
  assert.equal(new Set(requests.map((c) => c.opts.body)).size, 1);
  assert.deepEqual(requests.map((c) => c.deadlines[0]), [90000, 20000, 20000]);
});

test("permanent bootstrap rejection never retries or persists credentials", async () => {
  const h = harness(); h.handle(() => response({}, 401));
  await assert.rejects(h.retry(() => h.getDeviceId(), { operationName: "test", sleep: async () => {} }));
  assert.equal(h.calls.length, 1);
  assert.equal(h.values.has(CREDENTIALS), false);
});

test("reset generation fences an old bootstrap while serializing fresh identity creation", async () => {
  const h = harness(), late = deferred();
  let count = 0;
  h.handle((route, opts) => route === "/auth/guest"
    ? (++count === 1 ? late.promise : response(guest("guest_new")))
    : finishRoutes(h, route, opts, "guest_new"));
  const old = h.getDeviceId();
  const rejected = assert.rejects(old, (e) => e.name === "AuthOperationSupersededError");
  await flush();
  const reset = h.api.startNewGuestAccount();
  await flush();
  late.resolve(response(guest("guest_old")));
  await rejected; await reset;
  assert.equal(await h.getDeviceId(), "guest_new");
  assert.ok(h.writes.filter(([key]) => key === CREDENTIALS).every(([, value]) => JSON.parse(value).player_id === "guest_new"));
  assert.equal(count, 2);
});

// Execute the screen's actual hooks/effects with a minimal deterministic host.
// Native rendering is stubbed; timer ownership and async lifecycle are real.
function screenHarness(autoRetry = false) {
  const time = clock(), slots = [], effects = [], requests = [], routes = [];
  let cursor = 0, tree, alertButtons;
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => v === b[i]);
  const react = {
    useState(initial) {
      const i = cursor++; slots[i] ??= { value: initial };
      return [slots[i].value, (next) => { slots[i].value = typeof next === "function" ? next(slots[i].value) : next; }];
    },
    useRef(value) { const i = cursor++; slots[i] ??= { current: value }; return slots[i]; },
    useCallback(fn, deps) {
      const i = cursor++;
      if (!same(slots[i]?.deps, deps)) slots[i] = { deps, fn };
      return slots[i].fn;
    },
    useEffect(fn, deps) {
      const i = cursor++;
      if (!same(slots[i]?.deps, deps)) effects.push(() => {
        slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: fn() };
      });
    },
  };
  const request = () => { const d = deferred(); requests.push(d); return d.promise; };
  const router = { replace: (route) => routes.push(route) };
  const jsx = (type, props) => ({ type, props });
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, "../app/index.tsx"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mocks = {
    react,
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "expo-router": { useRouter: () => router },
    "expo-constants": { default: {} },
    "react-native": { View: "View", Text: "Text", StyleSheet: { create: (v) => v }, Alert: { alert: (_title, _message, buttons) => { alertButtons = buttons; } } },
    "../src/api": {
      api: { pendingResult: async () => null, getPlayer: request, startNewGuestAccount: request, startupActiveMatch: async () => ({ status: "absent" }), startupActivePvpMatch: async () => ({ status: "absent" }) },
      publicAuthRuntimeDiagnostics: () => ({}), cacheBootstrapPlayer() {}, describeAuthenticationFailure: () => ({ canStartNewGuest: true }),
    },
    "../src/startupReliability": {
      withTransientStartupRetry: (operation, options) => autoRetry
        ? require("../src/startupReliability.ts").withTransientStartupRetry(operation, { ...options, sleep: (ms) => new Promise((resolve) => time.setTimeout(resolve, ms)) })
        : operation(),
      validateBootstrapPlayer: (p) => { if (!p) throw new Error("invalid"); return p; },
      classifyStartupFailure: () => ({ kind: "AUTH", message: "failed" }), startupDiagnosticCode: () => "test",
    },
  };
  const context = vm.createContext({ __DEV__: false, setTimeout: time.setTimeout, clearTimeout: time.clearTimeout });
  vm.runInContext(`(function(require,module,exports){${code}\n})`, context)((name) => mocks[name] ?? { default: name.split("/").pop() }, module, module.exports);
  const render = () => { cursor = 0; tree = module.exports.default(); effects.splice(0).forEach((fn) => fn()); };
  function find(type, node = tree) {
    if (!node || typeof node !== "object") return null;
    if (node.type === type) return node.props;
    const children = node.props?.children;
    for (const child of Array.isArray(children) ? children : [children]) { if (!child) continue; const found = find(type, child); if (found) return found; }
    return null;
  }
  render();
  return { time, requests, routes, render, find, reset: () => alertButtons.find((b) => b.style === "destructive").onPress(), unmount: () => slots.forEach((s) => s?.cleanup?.()) };
}

test("loading subtitle changes at 15s and success/unmount clear timers", async () => {
  const h = screenHarness();
  assert.equal(h.find("FireLoading").subtitle, "Preparing your player profile.");
  await h.time.tick(14999); h.render();
  assert.equal(h.find("FireLoading").subtitle, "Preparing your player profile.");
  await h.time.tick(1); h.render();
  assert.equal(h.find("FireLoading").subtitle, "Connecting to the Arena. This may take a little longer.");
  h.requests[0].resolve({ tutorial_done: false }); await flush();
  assert.equal(h.time.timers.size, 0);
  assert.deepEqual(h.routes, ["/tutorial"]);
  const early = screenHarness();
  early.requests[0].resolve({ tutorial_done: false }); await flush();
  assert.equal(early.time.timers.size, 0);
  const unmounted = screenHarness(); unmounted.unmount();
  assert.equal(unmounted.time.timers.size, 0);
  unmounted.requests[0].resolve({ tutorial_done: false }); await flush();
  assert.deepEqual(unmounted.routes, []);
});

test("failure, manual retry, and confirmed reset clear/restart loading timers", async () => {
  const h = screenHarness();
  await h.time.tick(16000); h.render();
  h.requests[0].resolve(null); await flush(); h.render();
  assert.equal(h.time.timers.size, 0);
  h.find("FireEmptyState").onPress(); h.render(); h.render();
  assert.equal(h.find("FireLoading").subtitle, "Preparing your player profile.");
  assert.equal(h.time.timers.size, 1);
  h.requests[1].resolve(null); await flush(); h.render();
  assert.equal(h.time.timers.size, 0);
  h.find("FireButton").onPress(); h.reset(); h.render();
  assert.equal(h.find("FireLoading").subtitle, "Preparing your player profile.");
  assert.equal(h.time.timers.size, 1);
  h.requests[2].resolve({ tutorial_done: false }); await flush();
  assert.equal(h.time.timers.size, 0);
});

test("confirmed reset failure and unmount clean the loading timer", async () => {
  for (const unmount of [false, true]) {
    const h = screenHarness();
    h.requests[0].reject(new Error("failed")); await flush(); h.render();
    h.find("FireButton").onPress(); h.reset(); h.render();
    assert.equal(h.time.timers.size, 1);
    if (unmount) h.unmount();
    else { h.requests[1].reject(new Error("reset failed")); await flush(); }
    assert.equal(h.time.timers.size, 0);
  }
});

test("automatic retry restarts the 15s subtitle clock after bounded backoff", async () => {
  const h = screenHarness(true);
  await h.time.tick(16000); h.render();
  assert.equal(h.find("FireLoading").subtitle, "Connecting to the Arena. This may take a little longer.");
  h.requests[0].reject(new TypeError("Network request failed")); await flush(); h.render();
  assert.equal(h.find("FireLoading").subtitle, "Preparing your player profile.");
  const [backoff] = h.time.timers.values();
  assert.ok(backoff.ms >= 650 && backoff.ms <= 800);
  await h.time.tick(801); h.render();
  assert.equal(h.requests.length, 2);
  assert.equal(h.find("FireLoading").subtitle, "Preparing your player profile.");
  assert.equal(h.time.timers.size, 1);
  h.requests[1].resolve({ tutorial_done: false }); await flush();
  assert.equal(h.time.timers.size, 0);
});
