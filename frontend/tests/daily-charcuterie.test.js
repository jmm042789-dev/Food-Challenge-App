const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  formatCountdown,
  landingRotationForReward,
  normalizeClockwiseDegrees,
  responsiveWheelSize,
  serverCountdownMs,
} = require("../src/retention/DailyRewards.ts");

const slices = Array.from({ length: 10 }, (_, index) => ({ id: `reward-${index}` }));

test("countdown advances from server time instead of device wall time", () => {
  const server = "2026-07-31T12:00:00+00:00";
  const next = "2026-08-01T12:00:00+00:00";
  assert.equal(serverCountdownMs(server, next, 0), 86_400_000);
  assert.equal(serverCountdownMs(server, next, 1000), 86_399_000);
  assert.equal(formatCountdown(86_399_000), "23:59:59");
});

test("responsive wheel sizing is square-safe and clamped", () => {
  assert.equal(responsiveWheelSize(390, 800), 350);
  assert.equal(responsiveWheelSize(1200, 1000), 360);
  assert.equal(responsiveWheelSize(200, 300), 160);
});

test("backend reward IDs land their slice centers at the twelve-o'clock pointer", () => {
  for (let index = 0; index < slices.length; index += 1) {
    const rotation = landingRotationForReward(slices[index].id, slices, 4);
    assert.notEqual(rotation, null);
    assert.ok(rotation >= 4 * 360);
    const renderedCenter = normalizeClockwiseDegrees(index * 36 + rotation);
    assert.equal(renderedCenter, 0, `slice ${index} must land under the pointer`);
  }
  assert.equal(landingRotationForReward("missing", slices, 4), null);
  assert.equal(normalizeClockwiseDegrees(-36), 324);
});

test("screen uses backend eligibility, claim, animation completion, and balances", () => {
  const screen = fs.readFileSync(path.join(__dirname, "../app/daily-rewards.tsx"), "utf8");
  const home = fs.readFileSync(path.join(__dirname, "../app/(tabs)/home.tsx"), "utf8");
  assert.match(home, /DAILY CHARCUTERIE BOARD/);
  assert.match(home, /SPIN NOW/);
  assert.match(home, /MAYBE LATER/);
  assert.match(home, /api\.dailyStatus\(\)/);
  assert.match(screen, /api\.dailyClaim\(\)/);
  assert.match(screen, /Animated\.timing/);
  assert.match(screen, /SpinPhase = "idle" \| "claiming" \| "spinning" \| "finalizing"/);
  assert.match(screen, /disabled=\{!status\.eligible \|\| busy\}/);
  assert.match(screen, /preferences\.reducedMotion \? 420/);
  assert.match(screen, /setClaim\(result\)/);
  assert.match(screen, /claim\.player\.coins/);
  assert.match(screen, /result\.reward\.id/);
  assert.match(screen, /MAYBE LATER/);
  assert.doesNotMatch(screen, /claimDailyReward|AsyncStorage|Math\.random\(\).*reward/);
});

test("wheel stage is frozen and result state cannot reflow its center", () => {
  const screen = fs.readFileSync(path.join(__dirname, "../app/daily-rewards.tsx"), "utf8");
  assert.match(screen, /const \[wheelSize\] = useState/);
  assert.match(screen, /testID="fixed-square-wheel-stage"/);
  assert.match(screen, /RESULT_REGION_HEIGHT = 174/);
  assert.match(screen, /testID="reserved-result-region"/);
  assert.match(screen, /height: RESULT_REGION_HEIGHT/);
  assert.doesNotMatch(screen, /justifyContent: "center", maxWidth: 520/);
});

test("board animation is rotation-only and stationary decor and pointer are siblings", () => {
  const screen = fs.readFileSync(path.join(__dirname, "../app/daily-rewards.tsx"), "utf8");
  assert.match(screen, /testID="stationary-charcuterie-decorations"/);
  assert.match(screen, /testID="fixed-twelve-oclock-pointer"/);
  assert.match(screen, /testID="rotation-only-reward-wheel"[\s\S]*transform: \[\{ rotate \}\]/);
  assert.doesNotMatch(screen, /Animated\.spring|Easing\.(bounce|elastic|back)/);
  assert.doesNotMatch(screen, /translateX|translateY|perspective|skewX|skewY/);
  const decorPosition = screen.indexOf("<TableDecorations");
  const wheelPosition = screen.indexOf("<Animated.View accessibilityLabel=\"Premium Charcuterie reward wheel\"");
  assert.ok(decorPosition >= 0 && wheelPosition > decorPosition, "decor must remain outside the animated wheel");
});
