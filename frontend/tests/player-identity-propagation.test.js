const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const read = (relativePath) => fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");

test("root provides one hydrated presentation identity and saves update it immediately", () => {
  const root = read("app/_layout.tsx");
  const context = read("src/profile/PlayerIdentityContext.tsx");
  const customization = read("app/avatar-customization.tsx");
  assert.match(root, /<PlayerIdentityProvider>/);
  assert.match(context, /loadPlayerIdentity\(\)/);
  assert.match(context, /setIdentity\(result\.identity\)/);
  assert.match(context, /request === generation\.current/);
  assert.match(customization, /saveIdentity\(\{ version: 4/);
  assert.doesNotMatch(customization, /savePlayerIdentity/);
});

test("contest intro, gameplay HUD, and result use the current player identity", () => {
  const play = read("app/play/[contestId].tsx");
  const countdown = read("src/game/ui/CountdownOverlay.tsx");
  const hud = read("src/game/ui/MatchHUD.tsx");
  const result = read("src/game/ui/ResultBanner.tsx");
  assert.match(play, /playerName: presentationIdentity\.gamerName/);
  assert.match(play, /playerName=\{presentationIdentity\.gamerName\}/);
  assert.match(play, /playerAvatar=\{presentationIdentity\.avatar\}/);
  assert.match(play, /!identityHydrated/);
  for (const source of [countdown, hud, result]) {
    assert.match(source, /avatarConfiguration/);
    assert.doesNotMatch(source, /characters\/blaze\.png/);
    assert.doesNotMatch(source, /name="Blaze"/);
  }
});

test("fallback remains valid while opponent identity stays independent", () => {
  const identity = read("src/profile/PlayerIdentity.ts");
  const play = read("app/play/[contestId].tsx");
  const countdown = read("src/game/ui/CountdownOverlay.tsx");
  assert.match(identity, /gamerName: "Hungry Hero"/);
  assert.match(play, /identity \?\? DEFAULT_IDENTITY/);
  assert.match(countdown, /opponentName = "Blaze"/);
  assert.match(countdown, /name=\{opponentName\}/);
});

test("leaderboard marks only the authenticated player's server-backed public identity", () => {
  const leaderboard = read("app/(tabs)/leaderboard.tsx");
  assert.match(leaderboard, /leader\.is_you \? playerName : leader\.display_name/);
  assert.match(leaderboard, /displayName\(contestResult\.your_rank\)/);
  assert.match(leaderboard, /disabled=\{leader\.is_you\}/);
});
