/* global __dirname */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  centerImageContentInSquare,
  formatCountdown,
  landingRotation,
  normalizeRewardOrientation,
  rewardAnchors,
  REWARD_LABEL_HEIGHT_RATIO,
  REWARD_LABEL_RADIUS_RATIO,
  REWARD_LABEL_WIDTH_RATIO,
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
  assert.equal(wheelStageSize(320), 320);
  assert.equal(wheelStageSize(900), 468);
  const [first] = rewardAnchors(10, 300);
  assert.equal(first.sliceCenter, -72);
  assert.equal(first.rotation, 18);
  assert.ok(first.centerY < 70);
  assert.ok(first.centerX > 150);
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

test("registry excludes screen-specific decorations while retaining core artwork", () => {
  const screen = fs.readFileSync(path.join(__dirname, "../app/daily-rewards.tsx"), "utf8");
  const artwork = fs.readFileSync(path.join(__dirname, "../src/assets/daily-rewards/artwork.ts"), "utf8");
  for (const source of [
    "background/restaurant-table.png", "wheel/charcuterie-wheel.png",
    "pointer/chef-knife-pointer.png", "hub/fire-feast-hub.png",
    "effects/winner-glow.png",
  ]) assert.match(artwork, new RegExp(`require\\(\\"\\./${source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\"\\)`), source);
  assert.match(artwork, /wheel: transparentArtworkIsUsable\(wheel\)/);
  assert.match(artwork, /pointer: transparentArtworkIsUsable\(pointer\)/);
  assert.match(artwork, /hub: transparentArtworkIsUsable\(hub\)/);
  assert.match(artwork, /winnerGlow: true/);
  assert.doesNotMatch(artwork, /hasBakedBackground: true|decorations|grapesTopLeft|salamiTopRight|olivesBottomLeft|cheeseBottomRight|winnerGlow: null/);
  assert.match(screen, /DAILY_REWARD_ARTWORK_VALIDITY\.wheel \?/);
  assert.match(screen, /DAILY_REWARD_ARTWORK_VALIDITY\.pointer \?/);
  assert.match(screen, /DAILY_REWARD_ARTWORK_VALIDITY\.hub \?/);
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

test("food decorations are absent and do not participate in stage geometry", () => {
  const screen = fs.readFileSync(path.join(__dirname, "../app/daily-rewards.tsx"), "utf8");
  assert.match(screen, /wheelStage, \{ height: stageSize, width: stageSize \}/);
  assert.doesNotMatch(screen, /food-decorations|grapes-top-left|salami-top-right|olives-bottom-left|cheese-bottom-right/);
  assert.doesNotMatch(screen, /decorationsLayer|decorationSize|decorationInset|DECORATION_|\.decorations/);
});

test("render order keeps the opaque table below the board artwork", () => {
  const screen = fs.readFileSync(path.join(__dirname, "../app/daily-rewards.tsx"), "utf8");
  const orderedMarkers = [
    'source={DAILY_REWARD_ARTWORK.background}', 'testID="wheel-stage"',
    'testID="wheel-artwork"', "status.reward_slices.map",
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

test("full-width header centers title independently from the Back button", () => {
  const screen = fs.readFileSync(path.join(__dirname, "../app/daily-rewards.tsx"), "utf8");
  assert.match(screen, /const HEADER_SIDE_GUTTER = 84/);
  assert.match(screen, /<View style=\{styles\.header\}>[\s\S]*?<View style=\{styles\.backButton\}>[\s\S]*?<View pointerEvents="none" style=\{\[styles\.headerTitleGroup, \{ paddingHorizontal: HEADER_SIDE_GUTTER \}\]\}>/);
  assert.match(screen, /header: \{ justifyContent: "center", minHeight: 70, position: "relative", width: "100%"/);
  assert.match(screen, /backButton: \{ left: 14, position: "absolute"/);
  assert.match(screen, /headerTitleGroup: \{ \.\.\.StyleSheet\.absoluteFillObject, alignItems: "center", justifyContent: "center" \}/);
  assert.match(screen, /title: \{[^}]*textAlign: "center"/);
  assert.match(screen, /subtitle: \{[^}]*textAlign: "center"/);
  assert.doesNotMatch(screen, /header: \{[^}]*flexDirection: "row"/);
});

test("small-screen header preserves wording with symmetric scaling space", () => {
  const screen = fs.readFileSync(path.join(__dirname, "../app/daily-rewards.tsx"), "utf8");
  assert.match(screen, /adjustsFontSizeToFit minimumFontScale=\{0\.72\} numberOfLines=\{2\}[^>]*>DAILY CHARCUTERIE BOARD/);
  assert.match(screen, /adjustsFontSizeToFit minimumFontScale=\{0\.8\} numberOfLines=\{2\}[^>]*>ONE FREE SPIN EVERY 24 HOURS/);
  assert.doesNotMatch(screen, /ellipsizeMode/);
});

test("heading, wheel, hub, and pointer share the stage center axis", () => {
  const screen = fs.readFileSync(path.join(__dirname, "../app/daily-rewards.tsx"), "utf8");
  assert.match(screen, /headerTitleGroup: \{ \.\.\.StyleSheet\.absoluteFillObject, alignItems: "center"/);
  assert.match(screen, /boardScene: \{ alignSelf: "center"/);
  assert.match(screen, /left: stageSize \/ 2 - \(DAILY_REWARD_ARTWORK\.pointer\.contentBounds\.x/);
  assert.match(screen, /marginLeft: \(stageSize - hubSize\) \/ 2/);
  assert.match(screen, /height: wheelSize, left: wheelInset, top: wheelInset, width: wheelSize/);
});

test("wheel labels rotate together while hub and pointer remain stationary", () => {
  const screen = fs.readFileSync(path.join(__dirname, "../app/daily-rewards.tsx"), "utf8");
  const assemblyStart = screen.indexOf('testID="rotating-wheel-assembly"');
  const assemblyEnd = screen.indexOf("</Animated.View>", assemblyStart);
  assert.ok(screen.indexOf('testID="wheel-artwork"') > assemblyStart);
  assert.ok(screen.indexOf("status.reward_slices.map") < assemblyEnd);
  assert.ok(screen.indexOf("const anchor = anchors[index]") < assemblyEnd);
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
  assert.match(screen, /const HEADER_TO_POINTER_GAP = 52/);
  assert.match(screen, /const STAGE_HORIZONTAL_INSET = 12/);
  assert.match(screen, /const WHEEL_DIAMETER_RATIO = 0\.92/);
  assert.match(screen, /wheelStageSize\(Math\.min\(width, 480\) - STAGE_HORIZONTAL_INSET\)/);
  assert.match(screen, /const pointerTopClearance = Math\.max\(0, -pointerRimTop\)/);
  assert.match(screen, /height: stageSize, marginTop: pointerTopClearance \+ HEADER_TO_POINTER_GAP, width: stageSize/);
  assert.match(screen, /boardScene: \{ alignSelf: "center", position: "relative" \}/);
  assert.match(screen, /wheelStage: \{ \.\.\.StyleSheet\.absoluteFillObject, overflow: "visible"/);
  assert.doesNotMatch(screen, /marginTop: -|marginBottom: -|translateY/);

  const stageSize = 420;
  const wheelSize = stageSize * 0.92;
  const wheelInset = (stageSize - wheelSize) / 2;
  const pointerHeight = wheelSize * 0.32;
  const pointerScale = pointerHeight / 467;
  const pointerTop = wheelInset - (16 + 467) * pointerScale;
  const pointerTopInPanel = Math.max(0, -pointerTop) + 52 + pointerTop;
  assert.ok(Math.abs(pointerTopInPanel - 52) < 1e-9);
});

test("pointer lowers the complete audited image ten percent into the wheel without moving the stage", () => {
  const screen = fs.readFileSync(path.join(__dirname, "../app/daily-rewards.tsx"), "utf8");
  assert.match(screen, /const POINTER_WEDGE_DEPTH_RATIO = 0\.1/);
  assert.match(screen, /const pointerWedgeDepth = wheelSize \* POINTER_WEDGE_DEPTH_RATIO/);
  assert.match(screen, /top: pointerRimTop \+ pointerWedgeDepth/);
  assert.match(screen, /left: stageSize \/ 2 - \(DAILY_REWARD_ARTWORK\.pointer\.contentBounds\.x/);
  assert.match(screen, /marginTop: pointerTopClearance \+ HEADER_TO_POINTER_GAP/);
  assert.doesNotMatch(screen, /marginTop: pointerTopClearance -|pointer.*translateY|pointer.*Animated/);

  const wheelDiameter = 360;
  const rimTop = 14;
  const pointerTip = rimTop + wheelDiameter * 0.1;
  assert.equal(pointerTip - rimTop, 36);
});

test("ten equal wedges use one centered polar anchor geometry", () => {
  const anchors = rewardAnchors(10, 360);
  assert.equal(anchors.length, 10);
  assert.deepEqual(anchors.map(({ sliceCenter }) => sliceCenter), [-72, -36, 0, 36, 72, 108, 144, 180, 216, 252]);
  assert.ok(anchors.every(({ radius }) => radius === 360 * REWARD_LABEL_RADIUS_RATIO));
  assert.ok(anchors.every(({ width }) => width === 360 * REWARD_LABEL_WIDTH_RATIO));
  assert.ok(anchors.every(({ height }) => height === 360 * REWARD_LABEL_HEIGHT_RATIO));
  for (const anchor of anchors) {
    assert.ok(Math.abs(anchor.left + anchor.width / 2 - anchor.centerX) < 1e-9);
    assert.ok(Math.abs(anchor.top + anchor.height / 2 - anchor.centerY) < 1e-9);
  }
});

test("uniform reward boxes clear the hub, rim, and divider centerlines", () => {
  const hubRadiusRatio = (0.22 / 0.92) / 2;
  const innerEdge = REWARD_LABEL_RADIUS_RATIO - REWARD_LABEL_HEIGHT_RATIO / 2;
  const outerEdge = REWARD_LABEL_RADIUS_RATIO + REWARD_LABEL_HEIGHT_RATIO / 2;
  const dividerHalfWidthAtRadius = REWARD_LABEL_RADIUS_RATIO * Math.sin(Math.PI / 10);
  assert.ok(innerEdge > hubRadiusRatio);
  assert.ok(outerEdge < 0.5);
  assert.ok(REWARD_LABEL_WIDTH_RATIO / 2 < dividerHalfWidthAtRadius);
});

test("reward orientation is normalized consistently and has no per-slice nudges", () => {
  const anchors = rewardAnchors(10, 360);
  assert.ok(anchors.every(({ rotation }) => rotation >= -90 && rotation <= 90));
  assert.deepEqual(anchors.map(({ sliceCenter }) => normalizeRewardOrientation(sliceCenter + 90)), anchors.map(({ rotation }) => rotation));
  const screen = fs.readFileSync(path.join(__dirname, "../app/daily-rewards.tsx"), "utf8");
  assert.match(screen, /const anchors = rewardAnchors\(status\.reward_slices\.length, wheelSize\)/);
  assert.match(screen, /alignItems: "center", justifyContent: "center"/);
  assert.match(screen, /height: anchor\.height, left: anchor\.left, top: anchor\.top/);
  assert.doesNotMatch(screen, /rewardOffsets|sliceOffsets|nudges|index ===|switch \(index\)/);
});

test("backend-selected wedge center still lands beneath the lowered twelve-o-clock pointer", () => {
  for (let index = 0; index < 10; index += 1) {
    const anchor = rewardAnchors(10, 360)[index];
    const finalCenter = ((anchor.sliceCenter + landingRotation(index, 10, 5)) % 360 + 360) % 360;
    assert.equal(finalCenter, 270);
  }
});

test("stage grows within the viewport and keeps equal horizontal spacing", () => {
  const screen = fs.readFileSync(path.join(__dirname, "../app/daily-rewards.tsx"), "utf8");
  const previousSmallPhoneStage = 320 - 28 - 28;
  const currentSmallPhoneStage = wheelStageSize(320 - 12);
  assert.ok(currentSmallPhoneStage / previousSmallPhoneStage >= 1.15);
  assert.ok(currentSmallPhoneStage <= 320 - 12);
  assert.match(screen, /content: \{ alignSelf: "center", maxWidth: 480, paddingHorizontal: 4/);
  assert.match(screen, /boardPanel: \{ paddingHorizontal: 0 \}/);
  assert.match(screen, /boardScene: \{ alignSelf: "center"/);
});

test("result reservation is compact and cannot reposition the preceding stage", () => {
  const screen = fs.readFileSync(path.join(__dirname, "../app/daily-rewards.tsx"), "utf8");
  assert.match(screen, /const STAGE_TO_RESULT_GAP = 0/);
  assert.match(screen, /const RESULT_SLOT_MIN_HEIGHT = 68/);
  assert.match(screen, /resultSlot: \{ marginTop: STAGE_TO_RESULT_GAP, minHeight: RESULT_SLOT_MIN_HEIGHT \}/);
  assert.ok(screen.indexOf('testID="board-scene"') < screen.indexOf('style={styles.resultSlot}'));
  assert.doesNotMatch(screen, /claim \?.*stageSize|claim \?.*boardScene/);
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
  assert.match(screen, /resultSlot: \{ marginTop: STAGE_TO_RESULT_GAP, minHeight: RESULT_SLOT_MIN_HEIGHT \}/);
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
