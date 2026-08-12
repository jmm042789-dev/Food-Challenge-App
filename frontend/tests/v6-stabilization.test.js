const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { ApiRequestError } = require("../src/requestDiagnostics.ts");
const { classifyPlayerError, isTransientPlayerError, playerFacingErrorMessage } = require("../src/playerFacingErrors.ts");
const { equipmentStatus } = require("../src/equipmentState.ts");
const { resolveMatchHudLayout } = require("../src/game/ui/gameplayLayout.ts");

test("shop errors classify without exposing raw backend JSON", () => {
  const alreadyOwned = new ApiRequestError(400, 'HTTP 400: {"detail":"item already owned"}');
  assert.equal(classifyPlayerError(alreadyOwned), "already_owned");
  assert.match(playerFacingErrorMessage(alreadyOwned), /already in your Locker/i);
  assert.doesNotMatch(playerFacingErrorMessage(alreadyOwned), /HTTP|\{"detail"/);

  const insufficient = new ApiRequestError(400, 'HTTP 400: {"detail":"not enough coins"}');
  assert.equal(classifyPlayerError(insufficient), "insufficient_funds");
  assert.equal(isTransientPlayerError(insufficient), false);
  assert.equal(isTransientPlayerError(new ApiRequestError(503, "service unavailable")), true);
  assert.equal(isTransientPlayerError(new TypeError("Network request failed")), true);
});

test("gameplay presentation receives a discrete accepted bite count", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/game/useGameLoop.ts"), "utf8");
  assert.match(source, /acceptedTapCountRef\.current \+= 1/);
  assert.match(source, /return acceptedTapCountRef\.current/);
  assert.doesNotMatch(source, /return acceptedActionSequence;/);
});

test("all mapped gameplay food sprites and Blaze are alpha PNGs", () => {
  const assets = [
    "hot-dog.png", "wings.png", "pizza-pepperoni.png", "pastrami-sandwich.png", "dessert.png", "burger-deluxe.png",
  ];
  for (const filename of assets) {
    const png = fs.readFileSync(path.join(__dirname, "../src/assets/food", filename));
    assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(png[25], 6, `${filename} must use RGBA color type`);
  }
  const blaze = fs.readFileSync(path.join(__dirname, "../src/assets/characters/blaze.png"));
  assert.equal(blaze[25], 6, "Blaze must use RGBA color type");
});

test("immersive status bar is scoped to the play route", () => {
  const source = fs.readFileSync(path.join(__dirname, "../app/_layout.tsx"), "utf8");
  assert.match(source, /hidden=\{segments\[0\] === "play"\}/);
});

test("Shop and Locker resolve authoritative gear and cosmetic state identically", () => {
  const inventory = {
    owned_gear: ["tap_boost", "gold_apron"],
    equipped_gear: "tap_boost",
    equipped_cosmetic: "gold_apron",
  };
  assert.equal(equipmentStatus({ id: "tap_boost", type: "gear" }, inventory), "equipped");
  assert.equal(equipmentStatus({ id: "gold_apron", type: "cosmetic" }, inventory), "equipped");
  assert.equal(equipmentStatus({ id: "combo_boost", type: "gear" }, inventory), "available");
  assert.equal(equipmentStatus({ id: "gold_apron", type: "gear" }, inventory), "owned");
});

test("gameplay HUD reserves compact center space on representative Android widths", () => {
  assert.deepEqual(resolveMatchHudLayout(320), { centerWidth: 66, horizontalPadding: 6 });
  assert.deepEqual(resolveMatchHudLayout(360), { centerWidth: 66, horizontalPadding: 6 });
  assert.deepEqual(resolveMatchHudLayout(412), { centerWidth: 72, horizontalPadding: 9 });
});

test("leaderboard uses a compact natural-flow podium without fixed vertical fill", () => {
  const source = fs.readFileSync(path.join(__dirname, "../app/(tabs)/leaderboard.tsx"), "utf8");
  assert.match(source, /crown:\{fontSize:34\}/);
  assert.match(source, /padding:10/);
  assert.doesNotMatch(source, /flexGrow|minHeight|height:\s*\d{3}/);
});
