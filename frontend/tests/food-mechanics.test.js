const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { getFoodProfile } = require("../src/game/food/FoodProfiles.ts");
const {
  claimHeavyBiteCompletion,
  normalizeHeavyBiteDuration,
} = require("../src/game/ui/heavyBiteValidation.ts");
const { validateSwipe } = require("../src/game/ui/swipeValidation.ts");

const readSource = (relativePath) => fs.readFileSync(path.join(".", relativePath), "utf8");

const swipe = (dx, duration, requiredDirection = null) => ({
  active: true,
  cancelled: false,
  dx,
  dy: 0,
  duration,
  requiredDirection,
});

test("pizza accepts a deliberate slice and rejects a short wing flick", () => {
  const config = getFoodProfile("pizza").swipeGesture;
  assert.equal(validateSwipe(swipe(96, 140), config).valid, true);
  assert.equal(validateSwipe(swipe(52, 140), config).reason, "TOO_SHORT");
  assert.equal(validateSwipe(swipe(96, 100), config).reason, "TOO_FAST");
});

test("wings accept short alternating flicks and reject repeated direction", () => {
  const config = getFoodProfile("wings").swipeGesture;
  assert.equal(validateSwipe(swipe(52, 70), config).valid, true);
  assert.equal(validateSwipe(swipe(-52, 70, "LEFT"), config).valid, true);
  assert.equal(validateSwipe(swipe(52, 70, "LEFT"), config).reason, "WRONG_DIRECTION");
  assert.equal(validateSwipe(swipe(52, 400), config).reason, "TOO_SLOW");
});

test("burger and pastrami share the responsive heavy-bite timing", () => {
  const burger = getFoodProfile("burger");
  const pastrami = getFoodProfile("Pastrami Sandwich");
  assert.equal(burger.id, "burger");
  assert.equal(pastrami.id, "burger");
  assert.equal(burger.specialMechanic.holdDurationMs, 300);
  assert.equal(pastrami.specialMechanic.holdDurationMs, 300);
  assert.equal(normalizeHeavyBiteDuration(300), 300);
});

test("heavy bite cancellation and completion produce at most one bite", () => {
  const cancelled = { completed: false };
  assert.equal(claimHeavyBiteCompletion(cancelled, 300, 300, true), false);
  assert.equal(cancelled.completed, false);

  const completion = { completed: false };
  assert.equal(claimHeavyBiteCompletion(completion, 299, 300), false);
  assert.equal(claimHeavyBiteCompletion(completion, 300, 300), true);
  assert.equal(claimHeavyBiteCompletion(completion, 600, 300), false);
});

test("heavy bite responder is the centered 150px glow target, not the full arena", () => {
  const source = readSource("src/game/ui/BurgerHeavyBiteOverlay.tsx");
  const overlayStyle = source.match(/overlay:\s*{[\s\S]*?},\n\s*target:/)?.[0] ?? "";
  const targetStyle = source.match(/target:\s*{[\s\S]*?},\n\s*pressureGlow:/)?.[0] ?? "";

  assert.match(source, /<View pointerEvents="box-none" style={styles\.overlay}>/);
  assert.match(source, /<Pressable[\s\S]*style={styles\.target}/);
  assert.match(overlayStyle, /\.\.\.StyleSheet\.absoluteFillObject/);
  assert.match(overlayStyle, /alignItems:\s*"center"/);
  assert.match(overlayStyle, /justifyContent:\s*"center"/);
  assert.doesNotMatch(targetStyle, /StyleSheet\.absoluteFillObject/);
  assert.match(targetStyle, /height:\s*150/);
  assert.match(targetStyle, /left:\s*"50%"/);
  assert.match(targetStyle, /marginLeft:\s*-75/);
  assert.match(targetStyle, /marginTop:\s*-75/);
  assert.match(targetStyle, /width:\s*150/);
  assert.match(targetStyle, /position:\s*"absolute"/);
  assert.match(targetStyle, /top:\s*"50%"/);
});

test("heavy bite holds outside the visible target cannot begin or complete", () => {
  const source = readSource("src/game/ui/BurgerHeavyBiteOverlay.tsx");
  const pressableStart = source.indexOf("<Pressable");
  const pressableEnd = source.indexOf("/>", pressableStart);
  const pressableBlock = source.slice(pressableStart, pressableEnd);

  assert.ok(pressableBlock.includes("onPressIn={startHold}"));
  assert.ok(pressableBlock.includes("onPressOut={cancelHold}"));
  assert.ok(pressableBlock.includes("style={styles.target}"));
  assert.ok(!pressableBlock.includes("style={styles.overlay}"));
});

test("heavy bite arena corners remain visual-only and cannot complete the hold", () => {
  const source = readSource("src/game/ui/BurgerHeavyBiteOverlay.tsx");
  const targetStyle = source.match(/target:\s*{[\s\S]*?},\n\s*pressureGlow:/)?.[0] ?? "";

  assert.match(source, /<View pointerEvents="box-none" style={styles\.overlay}>/);
  assert.doesNotMatch(targetStyle, /left:\s*0/);
  assert.doesNotMatch(targetStyle, /right:\s*0/);
  assert.doesNotMatch(targetStyle, /top:\s*0/);
  assert.doesNotMatch(targetStyle, /bottom:\s*0/);
});

test("valid heavy bite target hold still completes exactly one BITE", () => {
  const completion = { completed: false };
  let acceptedActions = 0;
  const complete = () => {
    if (claimHeavyBiteCompletion(completion, 300, 300)) acceptedActions += 1;
  };

  complete();
  complete();

  assert.equal(acceptedActions, 1);
  assert.equal(completion.completed, true);
});

test("valid heavy bite released early does not complete", () => {
  const completion = { completed: false };

  assert.equal(claimHeavyBiteCompletion(completion, 299, 300), false);
  assert.equal(completion.completed, false);
});

test("heavy bite completion forwards measured CONTROL evidence without replacing it", () => {
  const source = readSource("src/game/ui/FoodArena.tsx");
  const overlay = readSource("src/game/ui/BurgerHeavyBiteOverlay.tsx");
  assert.match(source, /completeHeavyBite = useCallback\(\(evidence: GameplayInputEvidence\)/);
  assert.match(source, /performBiteRef\.current\(evidence\)/);
  assert.match(overlay, /x: normalizedCoordinate\(event\.nativeEvent\.locationX/);
  assert.match(overlay, /y: normalizedCoordinate\(event\.nativeEvent\.locationY/);
  assert.match(overlay, /onComplete\(\{ source: "CONTROL", x, y/);
  assert.match(overlay, /duration_ms: Math\.round\(Date\.now\(\) - startedAt\.current\)/);
});

test("normal tap cannot bypass the heavy bite hold mechanic", () => {
  const source = readSource("src/game/ui/BurgerHeavyBiteOverlay.tsx");
  const pressableStart = source.indexOf("<Pressable");
  const pressableEnd = source.indexOf("/>", pressableStart);
  const pressableBlock = source.slice(pressableStart, pressableEnd);

  assert.ok(pressableBlock.includes("onPressIn={startHold}"));
  assert.ok(pressableBlock.includes("onPressOut={cancelHold}"));
  assert.ok(!pressableBlock.includes("onPress={"));
  assert.ok(!pressableBlock.includes("onLongPress={"));
});
