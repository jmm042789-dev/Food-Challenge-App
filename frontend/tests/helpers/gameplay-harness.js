/* global __dirname */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const playSource = fs.readFileSync(path.join(__dirname, "../../app/play/[contestId].tsx"), "utf8");
const handlerSource = playSource.slice(playSource.indexOf("const handleTap = useCallback"), playSource.indexOf("const handleUseAntacid"));
const compiledSources = new Map();
function compile(source) {
  if (!compiledSources.has(source)) {
    compiledSources.set(source, ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText);
  }
  return compiledSources.get(source);
}

function harness(dev = true, diagnosticFlag, fresh = false, options = {}) {
  let now = 10000, clockReads = 0, updates = 0, nextTimer = 0;
  const timers = new Map(), records = [], hookStates = [];
  class Clock extends Date { static now() { clockReads++; return now; } }
  const react = {
    memo: fn => fn,
    createElement: (type, props, ...children) => typeof type === "function" ? type({ ...props, children }) : ({ type, props: { ...props, children } }),
    useCallback: (fn) => fn,
    useMemo: (fn) => fn(),
    useRef: (value) => ({ current: value }),
    useEffect() {},
    useState: (initial) => {
      const index = hookStates.length;
      hookStates.push(typeof initial === "function" ? initial() : initial);
      return [hookStates[index], (next) => { updates++; hookStates[index] = typeof next === "function" ? next(hookStates[index]) : next; }];
    },
  };
  react.default = react;
  class AnimatedValue {
    setValue() {}
    stopAnimation() {}
    interpolate() { return 0; }
  }
  const animation = () => ({ start() {}, stop() {} });
  const native = {
    View: "View", Text: "Text", Pressable: "Pressable", Image: "Image",
    StyleSheet: { create: value => value, absoluteFillObject: {} },
    Animated: { Value: AnimatedValue, View: "Animated.View", timing: animation, spring: animation },
    Easing: { out: value => value, cubic: 0, linear: 0 },
    PanResponder: { create: callbacks => ({ panHandlers: callbacks }) },
  };
  const setTimer = (fn, ms) => { const id = ++nextTimer; timers.set(id, { fn, ms }); return id; };
  const clearTimer = (id) => timers.delete(id);
  const context = vm.createContext({
    __DEV__: dev, Date: Clock,
    process: { env: diagnosticFlag === undefined ? {} : { EXPO_PUBLIC_BURNOUT_TIMELINE_DIAGNOSTICS: diagnosticFlag } },
    console: { log() {}, info: (...args) => records.push(args), warn() {}, error() {} },
    setTimeout: setTimer, clearTimeout: clearTimer, setInterval: setTimer, clearInterval: clearTimer,
    requestAnimationFrame: setTimer, cancelAnimationFrame: clearTimer,
  });
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} }; cache.set(filename, module);
    const localRequire = (name) => {
      if (name === "react") return react;
      if (name === "react-native") return native;
      if (name.endsWith(".png")) return 0;
      if (name === "./ai/OpponentDatabase") return { getRandomOpponent: () => ({}) };
      if (name === "./ai/OpponentAI") return { createOpponentState: () => ({}), updateOpponent: () => ({}) };
      if (!name.startsWith(".")) throw new Error(`Unexpected dependency: ${name}`);
      const base = path.resolve(path.dirname(filename), name);
      const target = [base, `${base}.js`, `${base}.ts`, `${base}.tsx`].find((p) => fs.existsSync(p) && fs.statSync(p).isFile());
      if (!target) throw new Error(`Missing module: ${name}`);
      return load(target);
    };
    vm.runInContext(`(function(require,module,exports){${compile(fs.readFileSync(filename, "utf8"))}\n})`, context)(localRequire, module, module.exports);
    return module.exports;
  }
  const gameModule = load(path.join(__dirname, "../../src/game/useGameLoop.ts"));
  context.burnoutTimelineDiagnosticsEnabled = gameModule.burnoutTimelineDiagnosticsEnabled;
  const loop = gameModule.useGameLoop({ foodId: "nathans", ...options.loop });
  const saved = { version: 1, recoverable: true, capturedElapsedMs: 0, scoreRaw: 17, combo: 3, maximumCombo: 3, acceptedTapCount: 4, completedProgress: 4, heartburn: 99, antacidCount: 3, lastTapMs: null, heatProtectionUntilMs: 0, freshStomachUntilMs: 0, lastOverheatAtMs: null, criticalCycleActive: false, perfectCooldownEligible: false };
  if (fresh) {
    loop.startGame();
    const countdown = [...timers.values()][0];
    for (let tick = 0; tick < 3; tick++) countdown.fn();
  } else {
    assert.equal(loop.resumeGame(saved, 0), true);
  }
  return {
    loop, records, timers, context, load, react,
    latestState: () => hookStates[0],
    latestOpponentScore: () => hookStates[2],
    evaluate(source, bindings) {
      Object.assign(context, bindings);
      return vm.runInContext(compile(source), context);
    },
    now: () => now,
    setNow: (value) => { now = value; },
    metrics: () => ({ clockReads, updates, timers: timers.size }),
    handler(log, matchOrigin, status = "PLAYING") {
      const calls = [];
      Object.assign(context, {
        useCallback: react.useCallback,
        arenaCallbacksRef: { current: { status, combo: 3, commentate() {}, playAudioEvent() {}, tap: (timestamp) => { calls.push(["tap", timestamp]); return loop.tap(timestamp); } } },
        getBurnoutDiagnostics: loop.getBurnoutDiagnostics,
        getReplayBurnoutGate: loop.getReplayBurnoutGate,
        matchStartedAt: { current: matchOrigin }, matchDurationSeconds: options.loop?.duration ?? 60,
        inputLog: {
          start: (...args) => log.start(...args), canRecord: () => log.canRecord(),
          getDiagnostics: (timestamp) => log.getDiagnostics(timestamp),
          eventTimeFor: (timestamp) => log.eventTimeFor(timestamp),
          events: () => log.events(),
          recordAtElapsed: (...args) => { calls.push(["record", args[2]]); return log.recordAtElapsed(...args); },
          record: (...args) => { calls.push(["record", args[2]]); return log.record(...args); },
        },
        inputLogPersistence: { schedule() {} }, captureRecoveryState: loop.captureRecoveryState,
        hasValidInputEvidence: require("../../src/game/inputLog.js").hasValidInputEvidence,
        contest: { bite_mechanic: options.mechanic ?? "tap" }, selectedContestId: options.loop?.foodId ?? "nathans-hotdogs", cameraRef: { current: null }, firstBiteCommented: { current: true },
        scoreFeedbackTimer: { current: null }, setFeedbackText() {}, setComboLabel() {}, setShowScore() {},
      });
      const module = { exports: {} };
      vm.runInContext(`(function(module){${compile(handlerSource + "\nmodule.exports = handleTap;")}\n})`, context)(module);
      return { tap: module.exports, calls };
    },
  };
}

module.exports = { harness };
