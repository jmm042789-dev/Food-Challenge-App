const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("rematch is single-flight and never reuses a client-created match", () => {
  const screen = read("app/pvp/match/[matchId].tsx");
  assert.match(screen, /rematchInFlight\.current \|\| !match\?\.result/);
  assert.match(screen, /api\.createPvpRematch\(match\.match_id\)/);
  assert.match(screen, /REMATCH PENDING/);
});

test("VS and result presentation include public competitors rivalry and official scores", () => {
  const screen = read("app/pvp/match/[matchId].tsx");
  for (const value of ["match.player.avatar", "match.opponent.avatar", "match.player.handle", "match.opponent.handle", "match.result.own_score", "match.result.opponent_score", "match.result.rivalry.wins", "VIEW PROFILE"]) assert.match(screen, new RegExp(value.replaceAll(".", "\\.")));
});

test("recent opponents are bounded server data with future-compatible friend action", () => {
  const screen = read("app/friends.tsx"); const api = read("src/api.ts");
  assert.match(screen, /api\.recentPvpOpponents\(\)/); assert.match(screen, /RECENT OPPONENTS/);
  assert.match(screen, /friendship_state === "FRIENDS"[\s\S]*CHALLENGE[\s\S]*ADD FRIEND/);
  assert.match(api, /\/pvp\/recent/);
});

test("quick chat sends only server-listed IDs and enforces the three-quips UI boundary", () => {
  const source = read("src/social/PvpQuickChat.tsx");
  assert.match(source, /Object\.entries\(status\.approved_quips\[category\]/);
  assert.match(source, /status\.quip_counts\[category\][\s\S]*>= 3/);
  assert.match(source, /api\.sendPvpQuip\(matchId, category, quipId/);
  assert.doesNotMatch(source, /TextInput/);
});

test("in-game quips are compact bounded and suppressed by critical heat", () => {
  const source = read("src/social/PvpQuickChat.tsx"); const play = read("app/play/[contestId].tsx");
  assert.match(source, /BUBBLE_MS = 1800/); assert.match(source, /incoming\.at\(-1\)/); assert.match(source, /position: "absolute"/);
  assert.match(play, /PvpInGameQuickChat[\s\S]*overheatWarningActive \|\| overheatPenaltyActive \|\| heatTier === "CRITICAL"/);
});

test("mute is local persistent presentation state only", () => {
  const source = read("src/social/PvpQuickChat.tsx");
  assert.match(source, /fire_feast_pvp_quips_muted_v1/); assert.match(source, /AsyncStorage\.setItem/);
  assert.doesNotMatch(source, /api\.(block|mute)/);
});

test("quip delivery deduplicates event IDs and polling is bounded and cleaned up", () => {
  const source = read("src/social/PvpQuickChat.tsx");
  assert.match(source, /new Set<string>/); assert.match(source, /seen\.current\.has\(event\.event_id\)/);
  assert.match(source, /POLL_MS = 5000/); assert.match(source, /clearInterval\(timer\)/); assert.match(source, /generation\.current \+= 1/);
});

test("status synchronization does not write state from the prop-consumption effect", () => {
  const source = read("src/social/PvpQuickChat.tsx");
  assert.match(source, /if \(applyStatus\) onStatus\?\.\(value\)/);
  assert.match(source, /useEffect\(\(\) => \{ consume\(status\); \}, \[consume, status\]\)/);
});
