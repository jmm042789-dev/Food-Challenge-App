const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = fs.readFileSync(path.join(__dirname, "../app/_layout.tsx"), "utf8");
const hook = fs.readFileSync(path.join(__dirname, "../src/systemUi/useAndroidImmersiveMode.ts"), "utf8");
const config = require("../app.json").expo;
const pkg = require("../package.json");

test("root layout applies one Android immersive controller and hides the status bar", () => {
  assert.match(root, /useAndroidImmersiveMode\(\);/);
  assert.match(root, /<StatusBar animated hidden style="light" \/>/);
  assert.equal(pkg.dependencies["expo-navigation-bar"], "~5.0.10");
});

test("navigation-bar calls are Android-gated and reapplied only on foreground", () => {
  assert.match(hook, /if \(Platform\.OS !== "android"\) return;/);
  assert.match(hook, /setVisibilityAsync\("hidden"\)/);
  assert.match(hook, /if \(state === "active"\) apply\(\)/);
  assert.match(hook, /mounted = false;[\s\S]*subscription\.remove\(\)/);
  assert.doesNotMatch(hook, /useEffect\([\s\S]*?, \[(?!\])/);
});

test("native startup uses transient immersive navigation without changing edge-to-edge", () => {
  assert.equal(config.android.edgeToEdgeEnabled, true);
  const entry = config.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === "expo-navigation-bar");
  assert.ok(entry);
  assert.deepEqual(entry[1], {
    backgroundColor: "#070405",
    barStyle: "light",
    visibility: "hidden",
    behavior: "overlay-swipe",
    position: "absolute",
    legacyVisible: "sticky-immersive",
  });
});

test("tab and gameplay layouts continue consuming safe-area insets", () => {
  const tabs = fs.readFileSync(path.join(__dirname, "../app/(tabs)/_layout.tsx"), "utf8");
  const play = fs.readFileSync(path.join(__dirname, "../app/play/[contestId].tsx"), "utf8");
  assert.match(tabs, /useSafeAreaInsets\(\)/);
  assert.match(tabs, /Math\.max\(insets\.bottom, 5\)/);
  assert.match(play, /useSafeAreaInsets\(\)/);
  assert.match(play, /paddingBottom: Math\.max\(insets\.bottom, 6\)/);
});
