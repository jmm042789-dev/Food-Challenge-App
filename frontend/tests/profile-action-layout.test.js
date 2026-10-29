const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const profile = fs.readFileSync(path.join(__dirname, "../app/(tabs)/profile.tsx"), "utf8");
const button = fs.readFileSync(path.join(__dirname, "../src/components/fire/FireButton.tsx"), "utf8");

test("Profile action labels use an intentional single-line fitting policy", () => {
  assert.match(profile, /title="ACHIEVEMENTS" singleLineTitle/);
  assert.match(button, /numberOfLines=\{singleLineTitle \? 1 : undefined\}/);
  assert.match(button, /adjustsFontSizeToFit=\{singleLineTitle\}/);
  assert.match(button, /minimumFontScale=\{singleLineTitle \? 0\.86 : undefined\}/);
  assert.match(button, /style=\{singleLineTitle \? styles\.singleLineWidth : undefined\}/);
});

test("Profile action row wraps deliberately below the three-column threshold", () => {
  assert.match(profile, /retentionNav: \{ flexDirection: "row", flexWrap: "wrap", gap: 6 \}/);
  assert.match(profile, /retentionButton: \{ flexGrow: 1, flexShrink: 1, flexBasis: 118, marginTop: 0, minWidth: 118 \}/);
});

test("all three Profile actions retain their existing destinations", () => {
  assert.match(profile, /title="DAILY REWARDS"[^\n]+router\.push\("\/daily-rewards"\)/);
  assert.match(profile, /title="ACHIEVEMENTS"[^\n]+router\.push\("\/achievements"\)/);
  assert.match(profile, /title="MISSIONS"[^\n]+router\.push\("\/missions"\)/);
});
