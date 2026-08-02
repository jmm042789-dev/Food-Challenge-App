/* global __dirname */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  formatCountdown,
  landingRotation,
  rewardPosition,
  serverCountdownMs,
  wheelStageSize,
} = require("../src/retention/DailyRewards.ts");

const screen = () => fs.readFileSync(path.join(__dirname, "../app/daily-rewards.tsx"), "utf8");

test("countdown advances from server time instead of device wall time", () => {
  const server = "2026-07-31T12:00:00+00:00";
  const next = "2026-08-01T12:00:00+00:00";
  assert.equal(serverCountdownMs(server, next, 0), 86_400_000);
  assert.equal(serverCountdownMs(server, next, 1000), 86_399_000);
  assert.equal(formatCountdown(86_399_000), "23:59:59");
});

test("presentation rotation lands on the backend-selected slice", () => {
  assert.equal(landingRotation(0, 10, 5), 2142);
  assert.equal(landingRotation(9, 10, 5), 1818);
  assert.equal(landingRotation(10, 10, 5), 0);
});

test("screen preserves backend eligibility, selection, and balances", () => {
  const source = screen();
  assert.match(source, /api\.dailyStatus\(\)/);
  assert.match(source, /api\.dailyClaim\(\)/);
  assert.match(source, /findIndex\(\(slice\) => slice\.id === result\.reward\?\.id\)/);
  assert.match(source, /mappedIndex !== result\.reward_index/);
  assert.match(source, /setClaim\(result\)/);
  assert.match(source, /claim\.player\.coins/);
  assert.doesNotMatch(source, /claimDailyReward|AsyncStorage|Math\.random\(\).*reward/);
});

test("responsive wheel stage stays square and labels use wedge centers", () => {
  assert.equal(wheelStageSize(320), 292);
  assert.equal(wheelStageSize(900), 420);
  const first = rewardPosition(0, 10, 300);
  assert.ok(first.top < 70);
  assert.ok(first.left > 150);
  assert.equal(first.angle, 18);
});

test("all nine production assets are integrated with static requires", () => {
  const artwork = fs.readFileSync(path.join(__dirname, "../src/assets/daily-rewards/artwork.ts"), "utf8");
  for (const asset of [
    "background/restaurant-table.png",
    "wheel/charcuterie-wheel.png",
    "pointer/chef-knife-pointer.png",
    "hub/fire-feast-hub.png",
    "decorations/grapes-top-left.png",
    "decorations/salami-top-right.png",
    "decorations/olives-bottom-left.png",
    "decorations/cheese-bottom-right.png",
    "effects/winner-glow.png",
  ]) assert.match(artwork, new RegExp(asset.replace(/[.]/g, "\\.")));
});

test("decorations occupy four stationary corners outside the rotating assembly", () => {
  const source = screen();
  assert.match(source, /testID="decoration-grapes"[\s\S]*?styles\.topLeft/);
  assert.match(source, /testID="decoration-salami"[\s\S]*?styles\.topRight/);
  assert.match(source, /testID="decoration-olives"[\s\S]*?styles\.bottomLeft/);
  assert.match(source, /testID="decoration-cheese"[\s\S]*?styles\.bottomRight/);
  assert.match(source, /decorationSize = wheelSize \* 0\.16/);
  assert.doesNotMatch(source, /decoration[^\n]*transform/);
});

test("wheel has a fixed square layout and rotation is its only transform", () => {
  const source = screen();
  assert.match(source, /wheelStage, \{ height: stageSize, width: stageSize \}/);
  assert.match(source, /height: wheelSize, left: wheelInset, top: wheelInset, width: wheelSize, transform: \[\{ rotate \}\]/);
  assert.match(source, /DAILY_REWARD_ARTWORK\.wheel[\s\S]*?height: wheelSize, width: wheelSize/);
  assert.doesNotMatch(source, /translate[XY]|scale[XY]?|skew[XY]?|perspective/);
  assert.doesNotMatch(source, /marginLeft: -|marginRight: -|marginTop: -|marginBottom: -/);
});

test("hub and pointer remain stationary while glow only fades behind the hub", () => {
  const source = screen();
  assert.match(source, /hubSize = wheelSize \* 0\.22/);
  assert.match(source, /pointerHeight = wheelSize \* 0\.32/);
  assert.match(source, /testID="winner-glow"[\s\S]*?opacity: glowOpacity/);
  assert.match(source, /winnerGlow: \{ position: "absolute", zIndex: 3 \}/);
  assert.match(source, /hubArtwork: \{ position: "absolute", zIndex: 4 \}/);
  assert.match(source, /pointerArtwork: \{ position: "absolute", zIndex: 5 \}/);
  assert.doesNotMatch(source, /testID="(?:center-hub|knife-pointer)"[^\n]*transform/);
});

test("spin uses rotation-only timing without spring, bounce, or overshoot", () => {
  const source = screen();
  assert.match(source, /Animated\.timing\(rotation/);
  assert.match(source, /easing: Easing\.out\(Easing\.cubic\)/);
  assert.match(source, /useNativeDriver: true/);
  assert.doesNotMatch(source, /spring|bounce|overshoot/);
});

test("result and countdown content cannot resize the wheel stage", () => {
  const source = screen();
  assert.match(source, /resultSlot: \{ minHeight: 82 \}/);
  assert.match(source, /<View testID="wheel-stage"[\s\S]*?<View style=\{styles\.resultSlot\}>/);
  assert.match(source, /const stageSize = wheelStageSize\(Math\.min\(width, 480\) - 28\);/);
});

test("every required production asset exists", () => {
  for (const asset of [
    "background/restaurant-table.png", "wheel/charcuterie-wheel.png",
    "pointer/chef-knife-pointer.png", "hub/fire-feast-hub.png",
    "decorations/grapes-top-left.png", "decorations/salami-top-right.png",
    "decorations/olives-bottom-left.png", "decorations/cheese-bottom-right.png",
    "effects/winner-glow.png",
  ]) assert.equal(fs.existsSync(path.join(__dirname, "../src/assets/daily-rewards", asset)), true, asset);
});
