const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("friends and public profiles expose Challenge only for accepted friends", () => {
  const card = read("src/social/SocialPlayerCard.tsx");
  const profile = read("app/player/[publicId].tsx");
  assert.match(card, /friendship_state === "FRIENDS" && onChallenge/);
  assert.match(profile, /friendship_state === "FRIENDS" \? <FireButton fullWidth title="CHALLENGE"/);
  assert.match(read("app/friends.tsx"), /pvp\/challenge\/\$\{encodeURIComponent\(player\.public_id\)\}/);
});

test("challenge creation requires server-listed contest selection and is single-flight", () => {
  const source = read("app/pvp/challenge/[publicId].tsx");
  assert.match(source, /api\.pvpContests\(\)/);
  assert.match(source, /profile\.friendship_state !== "FRIENDS"/);
  assert.match(source, /if \(sending\.current \|\| !selected\) return/);
  assert.match(source, /api\.createPvpChallenge\(String\(publicId\), selected\)/);
});

test("challenge lists support incoming accept decline and outgoing cancel", () => {
  const source = read("app/friends.tsx");
  for (const operation of ["acceptPvpChallenge", "declinePvpChallenge", "cancelPvpChallenge"]) assert.match(source, new RegExp(`api\\.${operation}`));
  assert.match(source, /INCOMING CHALLENGES/); assert.match(source, /OUTGOING CHALLENGES/);
  assert.match(source, /if \(busyId\) return/);
});

test("VS screen uses bounded stable polling with generation cleanup", () => {
  const source = read("app/pvp/match/[matchId].tsx");
  assert.match(source, /const POLL_MS = 5000/);
  assert.match(source, /setInterval\(\(\) => \{ void refresh\(\); \}, POLL_MS\)/);
  assert.match(source, /clearInterval\(timer\); generation\.current \+= 1/);
  assert.match(source, /request === generation\.current/);
  assert.doesNotMatch(source, /\[match, refresh\]/);
});

test("PvP gameplay reuses accepted Level 2.5 log and frozen retry coordinator", () => {
  const play = read("app/play/[contestId].tsx");
  assert.match(play, /api\.startPvpAttempt\(pvpMatchId\)/);
  assert.match(play, /api\.submitPvpResult\(/);
  assert.match(play, /input_events: payload\.input_events/);
  assert.match(play, /const finalizedInputEvents = inputLog\.finish\(\)/);
  assert.match(play, /const completedPayload = resultSubmission\.preserve/);
});

test("opponent score remains hidden until the server returns a final result", () => {
  const screen = read("app/pvp/match/[matchId].tsx");
  assert.match(screen, /match\.result \? <>/);
  assert.match(screen, /match\.result\.opponent_score/);
  assert.doesNotMatch(screen, /opponent\.best_score.*score/i);
});

test("PvP result shows perspective outcome and explicitly zero phase-three economy", () => {
  const screen = read("app/pvp/match/[matchId].tsx");
  assert.match(screen, /match\.result\.outcome/);
  assert.match(screen, /match\.result\.own_score/);
  assert.match(screen, /NO PvP REWARDS OR RATING CHANGE/);
});

test("startup recovers participant-authorized PvP state after single-player recovery", () => {
  const startup = read("app/index.tsx");
  assert.match(startup, /api\.startupActivePvpMatch\(\)/);
  assert.match(startup, /operationName: "active-pvp-recovery"/);
  assert.match(startup, /router\.replace\(`\/pvp\/match\//);
});

test("root registers challenge and match screens without adding a bottom tab", () => {
  const layout = read("app/_layout.tsx");
  assert.match(layout, /pvp\/challenge\/\[publicId\]/);
  assert.match(layout, /pvp\/match\/\[matchId\]/);
  assert.doesNotMatch(read("app/(tabs)/_layout.tsx"), /pvp|challenge/i);
});
