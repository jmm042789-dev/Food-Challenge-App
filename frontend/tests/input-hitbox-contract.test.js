const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("food and arena are visual-only for every action mechanic", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/game/ui/FoodArena.tsx"), "utf8");
  assert.doesNotMatch(source, /tapFood|allowsDirectFoodTap|source: "FOOD"/);
  assert.doesNotMatch(source, /<Pressable|onPress=|onTouch|onStartShouldSetResponder/);
  assert.match(source, /pointerEvents="none"[\s\S]*style=\{styles\.foodSurface\}/);
});

test("tap and rapid actions are owned only by their dedicated control", () => {
  const zone = fs.readFileSync(path.join(__dirname, "../src/game/ui/GameplayActionZone.tsx"), "utf8");
  const tap = fs.readFileSync(path.join(__dirname, "../src/game/ui/TapActionControl.tsx"), "utf8");
  const rapid = fs.readFileSync(path.join(__dirname, "../src/game/ui/RapidActionControl.tsx"), "utf8");

  assert.match(zone, /<RapidActionControl \{\.\.\.sharedProps\}/);
  assert.match(zone, /<TapActionControl \{\.\.\.sharedProps\}/);
  assert.equal((tap.match(/onPress=\{triggerAction\}/g) ?? []).length, 1);
  assert.match(tap, /onAction\(\{ source: "CONTROL"/);
  assert.match(rapid, /<TapActionControl[\s\S]*onAction=\{tryRapidAction\}/);
});

test("the control's full 88px target, including space outside its visible pad, dispatches once", () => {
  const tap = fs.readFileSync(path.join(__dirname, "../src/game/ui/TapActionControl.tsx"), "utf8");

  assert.match(tap, /<Pressable[\s\S]*onPress=\{triggerAction\}[\s\S]*style=\{styles\.touchTarget\}/);
  assert.match(tap, /touchTarget: \{[^}]*height: 88/);
  assert.match(tap, /pad: \{[^}]*height: 66/);
  assert.equal((tap.match(/onAction\(\{ source: "CONTROL"/g) ?? []).length, 1);
});

test("controls pass raw normalized evidence into the one accepted-action callback", () => {
  const tap = fs.readFileSync(path.join(__dirname, "../src/game/ui/TapActionControl.tsx"), "utf8");
  const swipe = fs.readFileSync(path.join(__dirname, "../src/game/ui/SwipeActionControl.tsx"), "utf8");
  const hold = fs.readFileSync(path.join(__dirname, "../src/game/ui/HoldReleaseActionControl.tsx"), "utf8");
  assert.match(tap, /source: "CONTROL"[\s\S]*normalizedCoordinate/);
  assert.match(swipe, /start_x:[\s\S]*end_x:[\s\S]*duration_ms/);
  assert.doesNotMatch(swipe, /onAccessibilityTap|performAccessibilityAction/);
  assert.match(hold, /start_x:[\s\S]*end_x:[\s\S]*duration_ms/);
  assert.match(hold, /onPressIn=\{startHold\}/);
  assert.match(hold, /onPressOut=\{releaseHold\}/);
  assert.match(swipe, /onStartShouldSetPanResponder: \(\) => activeRef\.current/);
  assert.match(swipe, /\.\.\.panResponder\.panHandlers/);
});

test("play checks log capacity before gameplay mutation and records accepted evidence once", () => {
  const source = fs.readFileSync(path.join(__dirname, "../app/play/[contestId].tsx"), "utf8");
  const capacity = source.indexOf("if (!inputLog.canRecord()) return null");
  const mutation = source.indexOf("const acceptedActionSequence = tapLatest(actionNow)");
  const record = source.indexOf("inputLog.record(actionType, evidence, actionNow)");
  assert.ok(capacity > 0 && capacity < mutation && mutation < record);
  assert.equal((source.match(/inputLog\.record\(actionType, evidence, actionNow\)/g) ?? []).length, 1);
});

test("rejected controls and non-controls cannot append input evidence", () => {
  const play = fs.readFileSync(path.join(__dirname, "../app/play/[contestId].tsx"), "utf8");
  const food = fs.readFileSync(path.join(__dirname, "../src/game/ui/FoodArena.tsx"), "utf8");
  const rejected = play.indexOf("if (acceptedActionSequence === null) return null");
  const record = play.indexOf("inputLog.record(actionType, evidence, actionNow)");

  assert.ok(rejected > 0 && rejected < record);
  assert.doesNotMatch(food, /inputLog\.|source: "FOOD"/);
});

test("HUD polish enlarges the food while preserving a large action touch target", () => {
  const food = fs.readFileSync(path.join(__dirname, "../src/game/ui/FoodArena.tsx"), "utf8");
  const tap = fs.readFileSync(path.join(__dirname, "../src/game/ui/TapActionControl.tsx"), "utf8");
  const hud = fs.readFileSync(path.join(__dirname, "../src/game/ui/MatchHUD.tsx"), "utf8");
  const commentary = fs.readFileSync(path.join(__dirname, "../src/game/commentary/CommentaryOverlay.tsx"), "utf8");

  assert.match(food, /width \* 0\.72/);
  assert.match(food, /height \* 0\.37/);
  assert.match(tap, /touchTarget: \{[^}]*height: 88/);
  assert.match(tap, /pad: \{[^}]*height: 66/);
  assert.match(hud, /matchRow: \{[^}]*minHeight: 70/);
  assert.match(commentary, /paddingTop: "28%"/);
});
