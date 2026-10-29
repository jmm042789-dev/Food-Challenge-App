/* global __dirname */
const path = require("node:path");
const fs = require("node:fs");
const { createInputLogBuffer } = require("../../src/game/inputLog");
const { harness } = require("./gameplay-harness");

// Real control components, actual route handler, and actual gameplay hook.
// Only React/native presentation, wall clock, and timer scheduling are stubbed.
function createMechanic(contest) {
  const h = harness(true, undefined, true, {
    mechanic: contest.bite_mechanic,
    loop: { foodId: contest.id, foodName: contest.food, difficulty: contest.difficulty, duration: contest.duration_sec },
  });
  const log = createInputLogBuffer();
  log.start(contest.duration_sec * 1000, 10000);
  const state = { h, log, origin: 10000, contest };
  return state;
}

function mountControl(state) {
  if (state.contest.heavy) return mountHeavyBite(state);
  const handler = state.h.handler(state.log, state.origin);
  const attemptedEvidence = [];
  const zone = state.h.load(path.join(__dirname, "../../src/game/ui/GameplayActionZone.tsx")).default;
  const profile = state.h.load(path.join(__dirname, "../../src/game/food/FoodProfiles.ts")).getFoodProfile(state.contest.id, state.contest.food);
  const tree = zone({
    mechanic: state.contest.bite_mechanic, active: true, combo: 0, heatTier: "COOL",
    overheatWarningActive: false, reducedMotion: true, resetKey: "test", swipeGesture: profile.swipeGesture,
    onAction: evidence => {
      const submitted = { ...evidence, ...state.evidenceOverrides };
      attemptedEvidence.push(submitted);
      return handler.tap(submitted);
    },
  });
  function find(node) {
    if (!node || !node.props) return null;
    if (node.props.onLayout) return node.props;
    return node.props.children.map(find).find(Boolean);
  }
  const control = find(tree);
  const width = 300, height = 82;
  control.onLayout({ nativeEvent: { layout: { width, height } } });
  let direction = 1;
  const nativeEvent = (x, y) => ({ nativeEvent: { locationX: x, locationY: y } });
  return {
    handler, control, attemptedEvidence,
    act(time, { dx, dy = 0, duration, moveDy = dy, releaseOnly = false, duplicate = false } = {}) {
      const kind = state.contest.bite_mechanic;
      if (kind === "swipe") {
        duration ??= profile.swipeGesture.gestureKind === "flick" ? 70 : 150;
        dx ??= direction * 120;
        const startX = dx > 0 ? 60 : 240, startY = 25;
        state.h.setNow(state.origin + time - duration);
        control.onPanResponderGrant(nativeEvent(startX, startY));
        state.h.setNow(state.origin + time);
        if (!releaseOnly) control.onPanResponderMove(nativeEvent(startX + dx, startY + moveDy), { dx, dy: moveDy });
        control.onPanResponderRelease(nativeEvent(startX + dx, startY + dy), { dx, dy });
        if (duplicate) control.onPanResponderRelease(nativeEvent(startX + dx, startY + dy), { dx, dy });
        direction *= -1;
      } else if (kind === "hold_release") {
        duration ??= 300;
        state.h.setNow(state.origin + time - duration);
        control.onPressIn(nativeEvent(150, 41));
        state.h.setNow(state.origin + time);
        control.onPressOut(nativeEvent(150, 41));
        if (duplicate) control.onPressOut(nativeEvent(150, 41));
      } else {
        state.h.setNow(state.origin + time);
        control.onPress(nativeEvent(150, 41));
      }
    },
  };
}

function mountHeavyBite(state) {
  const handler = state.h.handler(state.log, state.origin);
  const attemptedEvidence = [];
  const arena = fs.readFileSync(path.join(__dirname, "../../src/game/ui/FoodArena.tsx"), "utf8");
  const callback = arena.slice(arena.indexOf("const completeHeavyBite ="), arena.indexOf("const completeTacoChallenge ="));
  const onComplete = state.h.evaluate(`(() => { ${callback}\nreturn completeHeavyBite; })()`, {
    useCallback: fn => fn,
    heavyBiteActiveRef: { current: true }, setHeavyBiteActive() {},
    performBiteRef: { current: evidence => {
      const submitted = { ...evidence, ...state.evidenceOverrides };
      attemptedEvidence.push(submitted);
      return handler.tap(submitted);
    } }, onMechanicCompleted() {},
    foodProfile: { specialMechanic: { holdDurationMs: 300 } },
  });
  const overlay = state.h.load(path.join(__dirname, "../../src/game/ui/BurgerHeavyBiteOverlay.tsx")).default;
  const tree = overlay({ holdDurationMs: 300, reducedMotion: true, onComplete });
  const press = tree.props.children.find(child => child?.type === "Pressable").props;
  return { handler, attemptedEvidence, act(time, { duration = 300 } = {}) {
    state.h.setNow(state.origin + time - duration);
    press.onLayout?.({ nativeEvent: { layout: { width: 150, height: 150 } } });
    const prior = new Set(state.h.timers.keys());
    press.onPressIn({ nativeEvent: { locationX: 60, locationY: 90 } });
    state.h.setNow(state.origin + time);
    const completion = [...state.h.timers].find(([id]) => !prior.has(id));
    completion[1].fn();
    press.onPressOut();
  } };
}

module.exports = { createMechanic, mountControl, mountHeavyBite };
