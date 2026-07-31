const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  formatCountdown,
  landingRotation,
  serverCountdownMs,
} = require("../src/retention/DailyRewards.ts");

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
