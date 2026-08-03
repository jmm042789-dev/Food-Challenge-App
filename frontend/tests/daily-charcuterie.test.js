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
    "decorations/salami-top-right.png",
    "decorations/olives-bottom-left.png",
    "decorations/cheese-bottom-right.png",
    "effects/winner-glow.png",
  ]) {
    const artwork = inspect(asset);
    assert.equal(artwork.alphaChannel, true, asset);
    assert.equal(artwork.hasRealTransparency, true, asset);
    assert.equal(artwork.validTransparentArtwork, true, asset);
  }
});

test("registry keeps all nine current artwork sources available", () => {
  const screen = fs.readFileSync(path.join(__dirname, "../app/daily-rewards.tsx"), "utf8");
  const artwork = fs.readFileSync(path.join(__dirname, "../src/assets/daily-rewards/artwork.ts"), "utf8");
  for (const source of [
    "background/restaurant-table.png", "wheel/charcuterie-wheel.png",
    "pointer/chef-knife-pointer.png", "hub/fire-feast-hub.png",
    "decorations/grapes-top-left.png", "decorations/salami-top-right.png",
    "decorations/olives-bottom-left.png", "decorations/cheese-bottom-right.png",
    "effects/winner-glow.png",
  ]) assert.match(artwork, new RegExp(`require\\(\\"\\./${source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\"\\)`), source);
  assert.match(artwork, /wheel: transparentArtworkIsUsable\(wheel\)/);
  assert.match(artwork, /pointer: transparentArtworkIsUsable\(pointer\)/);
  assert.match(artwork, /hub: transparentArtworkIsUsable\(hub\)/);
  assert.match(artwork, /decorations: true/);
  assert.match(artwork, /winnerGlow: true/);
  assert.doesNotMatch(artwork, /hasBakedBackground: true|decorations: \[\]|winnerGlow: null/);
  assert.match(screen, /DAILY_REWARD_ARTWORK_VALIDITY\.wheel \?/);
  assert.match(screen, /DAILY_REWARD_ARTWORK_VALIDITY\.pointer \?/);
  assert.match(screen, /DAILY_REWARD_ARTWORK_VALIDITY\.hub \?/);
  assert.match(screen, /DAILY_REWARD_ARTWORK_VALIDITY\.decorations \?/);
  assert.doesNotMatch(screen, /winnerGlow|winner-glow/);
});

test("measured wheel content is uniformly centered without arbitrary offsets", () => {
  const layout = centerImageContentInSquare({
    canvasWidth: 1254,
    canvasHeight: 1254,
    bounds: { x: 63, y: 64, width: 1129, height: 1127 },
  }, 300);
  assert.equal(layout.scale, 300 / 1129);
  assert.ok(Math.abs(layout.left + (63 + 1129 / 2) * layout.scale - 150) < 1e-9);
  assert.ok(Math.abs(layout.top + (64 + 1127 / 2) * layout.scale - 150) < 1e-9);
  assert.equal(layout.width, layout.height);
  const screen = fs.readFileSync(path.join(__dirname, "../app/daily-rewards.tsx"), "utf8");
  assert.doesNotMatch(screen, /-wheelSize|wheelSize \* 1\.5|translate[XY]/);
});

test("stationary decorations sit outside the rotating square wheel assembly", () => {
  const screen = fs.readFileSync(path.join(__dirname, "../app/daily-rewards.tsx"), "utf8");
  assert.match(screen, /wheelStage, \{ height: stageSize, width: stageSize \}/);
  const assemblyStart = screen.indexOf('testID="rotating-wheel-assembly"');
  const assemblyEnd = screen.indexOf("</Animated.View>", assemblyStart);
  for (const id of ["grapes-top-left", "salami-top-right", "olives-bottom-left", "cheese-bottom-right"]) {
    const position = screen.indexOf(`testID="${id}"`);
    assert.ok(position >= 0 && position < assemblyStart, id);
    assert.ok(position < assemblyStart || position > assemblyEnd, id);
  }
  assert.match(screen, /decoration: \{ opacity: 1, position: "absolute" \}/);
});

test("render order keeps the opaque table below the board artwork", () => {
  const screen = fs.readFileSync(path.join(__dirname, "../app/daily-rewards.tsx"), "utf8");
  const orderedMarkers = [
    'source={DAILY_REWARD_ARTWORK.background}', 'testID="food-decorations"',
    'testID="wheel-stage"', 'testID="wheel-artwork"', "status.reward_slices.map",
    'testID="center-hub"', 'testID="knife-pointer"', 'style={styles.resultSlot}',
  ];
  let previous = -1;
  for (const marker of orderedMarkers) {
    const position = screen.indexOf(marker);
    assert.ok(position > previous, marker);
    previous = position;
  }
  assert.match(screen, /backgroundArtwork: \{ \.\.\.StyleSheet\.absoluteFillObject, zIndex: 0 \}/);
});

test("wheel labels rotate together while hub and pointer remain stationary", () => {
  const screen = fs.readFileSync(path.join(__dirname, "../app/daily-rewards.tsx"), "utf8");
  const assemblyStart = screen.indexOf('testID="rotating-wheel-assembly"');
  const assemblyEnd = screen.indexOf("</Animated.View>", assemblyStart);
  assert.ok(screen.indexOf('testID="wheel-artwork"') > assemblyStart);
  assert.ok(screen.indexOf("status.reward_slices.map") < assemblyEnd);
  for (const id of ["center-hub", "knife-pointer"]) assert.ok(screen.indexOf(`testID="${id}"`) > assemblyEnd, id);
  assert.match(screen, /wheelArtwork: \{ opacity: 1/);
  assert.match(screen, /hubArtwork: \{ opacity: 1/);
  assert.match(screen, /pointerArtwork: \{ opacity: 1/);
  assert.match(screen, /if \(finished\) \{[\s\S]*?setClaim\(result\)/);
  const claimFailureStart = screen.lastIndexOf("} catch {");
  const claimFailureEnd = screen.indexOf("}, [preferences.reducedMotion", claimFailureStart);
  const claimFailure = screen.slice(claimFailureStart, claimFailureEnd);
  assert.doesNotMatch(claimFailure, /setClaim\(|setStatus\([^)]*eligible: false/);
});

test("the complete square stage reserves pointer clearance below the flow-laid-out header", () => {
  const screen = fs.readFileSync(path.join(__dirname, "../app/daily-rewards.tsx"), "utf8");
  assert.match(screen, /const HEADER_TO_POINTER_GAP = 16/);
  assert.match(screen, /const pointerTopClearance = Math\.max\(0, -pointerLayout\.top\)/);
  assert.match(screen, /height: stageSize, marginTop: pointerTopClearance \+ HEADER_TO_POINTER_GAP, width: stageSize/);
  assert.match(screen, /boardScene: \{ alignSelf: "center", position: "relative" \}/);
  assert.match(screen, /wheelStage: \{ \.\.\.StyleSheet\.absoluteFillObject, overflow: "visible"/);
  assert.doesNotMatch(screen, /marginTop: -|marginBottom: -|translateY/);

  const stageSize = 420;
  const wheelSize = stageSize * 0.88;
  const wheelInset = (stageSize - wheelSize) / 2;
  const pointerHeight = wheelSize * 0.32;
  const pointerScale = pointerHeight / 467;
  const pointerTop = wheelInset - (16 + 467) * pointerScale;
  const pointerTopInPanel = Math.max(0, -pointerTop) + 16 + pointerTop;
  assert.ok(Math.abs(pointerTopInPanel - 16) < 1e-9);
});

test("winner glow presentation and animation are absent", () => {
  const screen = fs.readFileSync(path.join(__dirname, "../app/daily-rewards.tsx"), "utf8");
  assert.doesNotMatch(screen, /winnerGlow|winner-glow|glowOpacity/);
  assert.doesNotMatch(screen, /Animated\.sequence|toValue: 0\.82|toValue: 0\.7/);
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
