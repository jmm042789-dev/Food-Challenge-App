/* global __dirname */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  centerImageContentInSquare,
  formatCountdown,
  landingRotation,
  rewardPosition,
  serverCountdownMs,
  wheelStageSize,
} = require("../src/retention/DailyRewards.ts");
const { inspect } = require("../scripts/audit-daily-reward-artwork.js");

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

test("screen uses backend eligibility, claim, animation completion, and balances", () => {
  const screen = fs.readFileSync(path.join(__dirname, "../app/daily-rewards.tsx"), "utf8");
  const home = fs.readFileSync(path.join(__dirname, "../app/(tabs)/home.tsx"), "utf8");
  assert.match(home, /DAILY CHARCUTERIE BOARD/);
  assert.match(home, /SPIN NOW/);
  assert.match(home, /MAYBE LATER/);
  assert.match(home, /api\.dailyStatus\(\)/);
  assert.match(screen, /api\.dailyClaim\(\)/);
  assert.match(screen, /Animated\.timing/);
  assert.match(screen, /setClaim\(result\)/);
  assert.match(screen, /claim\.player\.coins/);
  assert.doesNotMatch(screen, /claimDailyReward|AsyncStorage|Math\.random\(\).*reward/);
});

test("responsive wheel stage stays square and labels use one wedge-center helper", () => {
  assert.equal(wheelStageSize(320), 292);
  assert.equal(wheelStageSize(900), 420);
  const first = rewardPosition(0, 10, 300);
  assert.ok(first.top < 70);
  assert.ok(first.left > 150);
  assert.equal(first.angle, 18);
});

test("production foreground artwork has real alpha without baked backdrops", () => {
  for (const asset of [
    "wheel/charcuterie-wheel.png",
    "pointer/chef-knife-pointer.png",
    "hub/fire-feast-hub.png",
    "decorations/grapes-top-left.png",
    "decorations/cheese-bottom-right.png",
    "effects/winner-glow.png",
  ]) {
    const artwork = inspect(asset);
    assert.equal(artwork.alphaChannel, true, asset);
    assert.equal(artwork.hasRealTransparency, true, asset);
    assert.equal(artwork.validTransparentArtwork, true, asset);
  }
});

test("invalid decorations, hub, pointer, wheel, and glow are gated from rendering", () => {
  const screen = fs.readFileSync(path.join(__dirname, "../app/daily-rewards.tsx"), "utf8");
  const artwork = fs.readFileSync(path.join(__dirname, "../src/assets/daily-rewards/artwork.ts"), "utf8");
  assert.match(artwork, /wheel: transparentArtworkIsUsable\(wheel\)/);
  assert.match(artwork, /pointer: transparentArtworkIsUsable\(pointer\)/);
  assert.match(artwork, /hub: transparentArtworkIsUsable\(hub\)/);
  assert.match(artwork, /decorations: false/);
  assert.match(artwork, /winnerGlow: false/);
  assert.doesNotMatch(screen, /grapesTopLeft|salamiTopRight|olivesBottomLeft|cheeseBottomRight|winner-glow/);
  assert.match(screen, /DAILY_REWARD_ARTWORK_VALIDITY\.wheel \?/);
  assert.match(screen, /DAILY_REWARD_ARTWORK_VALIDITY\.pointer \?/);
  assert.match(screen, /DAILY_REWARD_ARTWORK_VALIDITY\.hub \?/);
});

test("measured wheel content is uniformly centered without arbitrary offsets", () => {
  const layout = centerImageContentInSquare({
    canvasWidth: 1536,
    canvasHeight: 1024,
    bounds: { x: 337, y: 75, width: 869, height: 846 },
  }, 300);
  assert.equal(layout.scale, 300 / 869);
  assert.ok(Math.abs(layout.left + (337 + 869 / 2) * layout.scale - 150) < 1e-9);
  assert.ok(Math.abs(layout.top + (75 + 846 / 2) * layout.scale - 150) < 1e-9);
  assert.ok(Math.abs(layout.width / layout.height - 1.5) < 1e-9);
  const screen = fs.readFileSync(path.join(__dirname, "../app/daily-rewards.tsx"), "utf8");
  assert.doesNotMatch(screen, /-wheelSize|wheelSize \* 1\.5|translate[XY]/);
});

test("decorations do not participate in the square wheel-stage layout", () => {
  const screen = fs.readFileSync(path.join(__dirname, "../app/daily-rewards.tsx"), "utf8");
  assert.match(screen, /wheelStage, \{ height: stageSize, width: stageSize \}/);
  assert.doesNotMatch(screen, /decorationSize|styles\.decoration/);
});

test("only the fixed square wheel assembly rotates and result state does not move it", () => {
  const screen = fs.readFileSync(path.join(__dirname, "../app/daily-rewards.tsx"), "utf8");
  assert.match(screen, /testID="rotating-wheel-assembly"[\s\S]*?transform: \[\{ rotate \}\]/);
  assert.match(screen, /testID="knife-pointer"/);
  assert.match(screen, /testID="center-hub"/);
  assert.match(screen, /height: wheelSize, left: wheelInset, top: wheelInset, width: wheelSize/);
  assert.match(screen, /mappedIndex !== result\.reward_index/);
  assert.match(screen, /preferences\.reducedMotion \? 0 : 5/);
  assert.match(screen, /resultSlot: \{ minHeight: 82 \}/);
  assert.doesNotMatch(screen, /claim \?.*wheelStage|claim \?.*wheelInset/);
  assert.doesNotMatch(screen, /spring|bounce|perspective|skew/);
});

test("reward mapping and landing angle remain backend authoritative", () => {
  const screen = fs.readFileSync(path.join(__dirname, "../app/daily-rewards.tsx"), "utf8");
  assert.match(screen, /findIndex\(\(slice\) => slice\.id === result\.reward\?\.id\)/);
  assert.match(screen, /mappedIndex !== result\.reward_index/);
  assert.equal(landingRotation(3, 10, 5), 2034);
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
