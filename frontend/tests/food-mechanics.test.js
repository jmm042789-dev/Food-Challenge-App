const assert = require("node:assert/strict");
const test = require("node:test");

const { getFoodProfile } = require("../src/game/food/FoodProfiles.ts");
const {
  claimHeavyBiteCompletion,
  normalizeHeavyBiteDuration,
} = require("../src/game/ui/heavyBiteValidation.ts");
const { validateSwipe } = require("../src/game/ui/swipeValidation.ts");

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
