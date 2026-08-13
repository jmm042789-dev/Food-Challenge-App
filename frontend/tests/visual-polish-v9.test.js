const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { foodConsumptionPresentation } = require("../src/game/ui/foodConsumptionPresentation.ts");

test("accepted bite count produces bounded drift-free food presentation", () => {
  assert.deepEqual(foodConsumptionPresentation(0), { progress: 0, scale: 1, opacity: 1, complete: false });
  assert.deepEqual(foodConsumptionPresentation(5), { progress: 0.5, scale: 0.84, opacity: 0.75, complete: false });
  assert.equal(foodConsumptionPresentation(9).progress, 0.9);
  assert.deepEqual(foodConsumptionPresentation(10), { progress: 1, scale: 0.6799999999999999, opacity: 0.5, complete: true });
  assert.equal(foodConsumptionPresentation(15).progress, 0.5);
  for (const count of [-5, 0, 1, 9, 10, 999, Number.NaN]) {
    const value = foodConsumptionPresentation(count);
    assert.ok(value.progress >= 0 && value.progress <= 1);
    assert.ok(value.scale >= 0 && value.scale <= 1);
    assert.ok(value.opacity >= 0 && value.opacity <= 1);
  }
});

test("FoodArena renders one aspect-preserving sprite without rectangular segment masks", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/game/ui/FoodArena.tsx"), "utf8");
  assert.match(source, /foodConsumptionPresentation\(nextBiteCount\)/);
  assert.match(source, /resizeMode="contain" style=\{styles\.foodImage\}/);
  assert.doesNotMatch(source, /FOOD_SEGMENTS|SEGMENT_REMOVAL|foodSegment/);
});

test("achievement cards stay compact without dropping descriptions, progress, rewards, or claims", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/achievements/components/AchievementCard.tsx"), "utf8");
  for (const content of ["definition.description", "FireProgressBar", "definition.reward.coins", "definition.reward.xp", 'title="CLAIM"']) {
    assert.ok(source.includes(content), content);
  }
  assert.match(source, /paddingHorizontal: 8, paddingVertical: 6/);
  assert.match(source, /minHeight: 44/);
});

test("fullscreen remains scoped to play without an unsupported navigation-bar native dependency", () => {
  const layout = fs.readFileSync(path.join(__dirname, "../app/_layout.tsx"), "utf8");
  const pkg = fs.readFileSync(path.join(__dirname, "../package.json"), "utf8");
  assert.match(layout, /hidden=\{segments\[0\] === "play"\}/);
  assert.doesNotMatch(pkg, /expo-navigation-bar/);
});
