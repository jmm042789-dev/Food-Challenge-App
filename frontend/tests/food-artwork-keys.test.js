const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  resolveFoodArtworkKey,
} = require("../src/assets/foodArtworkKeys.ts");

const EXPECTED_ARTWORK = {
  "nathans-hotdogs": "hot-dog.png",
  "wing-bowl": "wings.png",
  "pizza-hut-stuffed": "pizza-pepperoni.png",
  "katz-pastrami": "pastrami-sandwich.png",
  "ben-jerry-icecream": "dessert.png",
  "in-n-out-burgers": "burger-deluxe.png",
};

test("resolves hot-dog variants to the canonical artwork key", () => {
  const variants = [
    "hot dog",
    "hot dogs",
    "hotdog",
    "hotdogs",
    "hot-dog",
    "hot-dogs",
    "hot_dog",
    "hot_dogs",
    "Hot Dogs",
  ];

  for (const variant of variants) {
    assert.equal(resolveFoodArtworkKey(variant), "nathans-hotdogs");
  }
});

test("preserves every production contest artwork key", () => {
  for (const contestId of Object.keys(EXPECTED_ARTWORK)) {
    assert.equal(resolveFoodArtworkKey(contestId), contestId);
  }
});

test("maps every production contest to its own explicit static asset", () => {
  const registrySource = fs.readFileSync(
    path.join(__dirname, "../src/assets/foodArtwork.ts"),
    "utf8",
  );
  const resolvedAssets = new Set();

  for (const [contestId, filename] of Object.entries(EXPECTED_ARTWORK)) {
    const mapping = `"${contestId}": { source: require("./food/${filename}")`;
    assert.equal(registrySource.includes(mapping), true, `${contestId} must require ${filename}`);
    resolvedAssets.add(filename);
  }

  assert.equal(resolvedAssets.size, Object.keys(EXPECTED_ARTWORK).length);
  assert.equal(EXPECTED_ARTWORK["wing-bowl"] === EXPECTED_ARTWORK["nathans-hotdogs"], false);
  assert.equal(EXPECTED_ARTWORK["pizza-hut-stuffed"] === EXPECTED_ARTWORK["nathans-hotdogs"], false);
  assert.equal(EXPECTED_ARTWORK["katz-pastrami"] === EXPECTED_ARTWORK["nathans-hotdogs"], false);
  assert.equal(EXPECTED_ARTWORK["ben-jerry-icecream"] === EXPECTED_ARTWORK["nathans-hotdogs"], false);
  assert.equal(EXPECTED_ARTWORK["in-n-out-burgers"] === EXPECTED_ARTWORK["nathans-hotdogs"], false);
});

test("documents burger fallback for unknown artwork keys", () => {
  const registrySource = fs.readFileSync(
    path.join(__dirname, "../src/assets/foodArtwork.ts"),
    "utf8",
  );

  assert.equal(resolveFoodArtworkKey("unknown food"), "unknown-food");
  assert.match(
    registrySource,
    /const DEFAULT_FOOD_ARTWORK:[\s\S]*?require\("\.\/food\/burger-deluxe\.png"\)/,
  );
});

test("menu and gameplay use the same shared artwork resolver", () => {
  const homeSource = fs.readFileSync(path.join(__dirname, "../app/(tabs)/home.tsx"), "utf8");
  const contestsSource = fs.readFileSync(path.join(__dirname, "../app/(tabs)/contests.tsx"), "utf8");
  const arenaSource = fs.readFileSync(path.join(__dirname, "../src/game/ui/FoodArena.tsx"), "utf8");

  assert.match(homeSource, /getFoodArtwork\(contest\.id\)/);
  assert.match(contestsSource, /getFoodArtwork\(contest\.id\)/);
  assert.match(arenaSource, /getFoodArtwork\(contestId\)/);
});
