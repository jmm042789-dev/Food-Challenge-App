const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const read = (relativePath) => fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");

test("Ranks exposes distinct Overall and contest-authoritative views", () => {
  const screen = read("app/(tabs)/leaderboard.tsx");
  assert.match(screen, /OVERALL/);
  assert.match(screen, /CONTESTS/);
  assert.match(screen, /api\.leaderboardContests\(\)/);
  assert.match(screen, /api\.contestLeaderboard\(contestId\)/);
  assert.match(screen, /TOP VERIFIED SCORES/);
  assert.match(screen, /YOUR RANK/);
});

test("contest selector includes personal best and stable contest IDs", () => {
  const screen = read("app/(tabs)/leaderboard.tsx");
  assert.match(screen, /key=\{contest\.id\}/);
  assert.match(screen, /setSelectedContestId\(contest\.id\)/);
  assert.match(screen, /BEST \{contest\.personal_best \|\| "—"\}/);
  assert.match(screen, /<ScrollView horizontal contentContainerStyle=\{styles\.selector\} showsHorizontalScrollIndicator=\{false\}/);
});

test("leaderboard requests are authenticated and public profiles are navigable", () => {
  const api = read("src/api.ts");
  const screen = read("app/(tabs)/leaderboard.tsx");
  assert.match(api, /leaderboard: \(\) => req\(`\/leaderboard`, \{\}, true\)/);
  assert.match(api, /leaderboardContests: \(\) => req\(`\/leaderboard\/contests`, \{\}, true\)/);
  assert.match(screen, /router\.push\(`\/player\/\$\{encodeURIComponent\(leader\.public_id\)\}`/);
});

test("contest switching rejects stale responses and supports recoverable states", () => {
  const screen = read("app/(tabs)/leaderboard.tsx");
  assert.match(screen, /const requestGeneration = useRef\(0\)/);
  assert.match(screen, /if \(generation !== requestGeneration\.current\) return/);
  assert.match(screen, /buttonLabel="RETRY"/);
  assert.match(screen, /No Rankings Yet/);
  assert.match(screen, /is_you/);
});
