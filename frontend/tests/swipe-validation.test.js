const assert = require("node:assert/strict");
const test = require("node:test");

const {
  SWIPE_CONFIG,
  claimSwipeSubmission,
  validateSwipe,
} = require("../src/game/ui/swipeValidation.ts");
const { resolveActionControlKind } = require("../src/game/ui/actionControlSelection.ts");

const base = { active: true, cancelled: false, dx: SWIPE_CONFIG.minDistancePx, dy: 0, duration: 200 };

test("accepts valid left and right swipes at the distance boundary", () => {
  assert.deepEqual(validateSwipe({ ...base, dx: -SWIPE_CONFIG.minDistancePx }), {
    valid: true, reason: "VALID", direction: "LEFT", distance: SWIPE_CONFIG.minDistancePx, duration: 200,
  });
  assert.equal(validateSwipe(base).direction, "RIGHT");
  assert.equal(validateSwipe(base).valid, true);
});

test("rejects cancelled and inactive swipes", () => {
  assert.equal(validateSwipe({ ...base, cancelled: true }).reason, "CANCELLED");
  assert.equal(validateSwipe({ ...base, active: false }).reason, "INACTIVE");
});

test("enforces duration boundaries", () => {
  assert.equal(validateSwipe({ ...base, duration: SWIPE_CONFIG.minDurationMs - 1 }).reason, "TOO_FAST");
  assert.equal(validateSwipe({ ...base, duration: SWIPE_CONFIG.minDurationMs }).valid, true);
  assert.equal(validateSwipe({ ...base, duration: SWIPE_CONFIG.maxDurationMs }).valid, true);
  assert.equal(validateSwipe({ ...base, duration: SWIPE_CONFIG.maxDurationMs + 1 }).reason, "TOO_SLOW");
});

test("rejects short and off-axis swipes", () => {
  assert.equal(validateSwipe({ ...base, dx: SWIPE_CONFIG.minDistancePx - 1 }).reason, "TOO_SHORT");
  assert.equal(validateSwipe({ ...base, dy: SWIPE_CONFIG.minDistancePx * SWIPE_CONFIG.maxOffAxisRatio }).valid, true);
  assert.equal(validateSwipe({ ...base, dy: SWIPE_CONFIG.minDistancePx * SWIPE_CONFIG.maxOffAxisRatio + 1 }).reason, "OFF_AXIS");
});

test("submission gate permits exactly one claim", () => {
  const state = { submitted: false };
  assert.equal(claimSwipeSubmission(state), true);
  assert.equal(claimSwipeSubmission(state), false);
});

test("central action control selection covers every mechanic and fallback", () => {
  assert.equal(resolveActionControlKind("tap"), "tap");
  assert.equal(resolveActionControlKind("rapid"), "rapid");
  assert.equal(resolveActionControlKind("hold_release"), "hold_release");
  assert.equal(resolveActionControlKind("swipe"), "swipe");
  assert.equal(resolveActionControlKind("unknown"), "tap");
  assert.equal(resolveActionControlKind(undefined), "tap");
});
