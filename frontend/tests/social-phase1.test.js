const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("public social types contain only safe presentation and public progression fields", () => {
  const types = read("src/social/types.ts");
  const publicProfile = types.match(/export type PublicPlayerProfile = \{[\s\S]*?\n\};/)[0];
  for (const field of ["public_id", "handle", "display_name", "avatar", "level", "rank", "wins", "matches", "best_score", "friendship_state"]) assert.match(publicProfile, new RegExp(field));
  for (const privateField of ["device_id", "installation_id", "auth_token", "match_seed", "active_match", "coins", "antacid"]) assert.doesNotMatch(publicProfile, new RegExp(privateField));
});

test("local identity save wins immediately and remote profile sync is recoverable", () => {
  const provider = read("src/profile/PlayerIdentityContext.tsx");
  const sync = read("src/social/publicIdentitySync.ts");
  assert.ok(provider.indexOf("setIdentity(result.identity)") < provider.indexOf("syncPublicIdentity(result.identity)"));
  assert.match(provider, /void syncPublicIdentity\(result\.identity\)/);
  assert.match(sync, /PENDING_SOCIAL_SYNC_KEY/);
  assert.match(sync, /pendingIdentity = identity/);
  assert.match(sync, /while \(pendingIdentity\)/);
  assert.match(sync, /await storage\.setItem[\s\S]*api\.updatePublicProfile[\s\S]*storage\.removeItem/);
  assert.match(sync, /catch \{[\s\S]*return false/);
});

test("frontend API exposes the complete authenticated Phase 1 surface", () => {
  const api = read("src/api.ts");
  for (const pathPart of ["/social/me", "/social/search", "/social/handle/availability", "/social/players/", "/social/friends", "/social/friends/request", "/social/friends/accept", "/social/friends/decline", "/social/friends/cancel", "/social/friends/remove"]) assert.match(api, new RegExp(pathPart.replaceAll("/", "\\/")));
  assert.doesNotMatch(api, /updatePublicProfile[\s\S]{0,300}device_id/);
});

test("search is debounced and stale generations cannot replace current results", () => {
  const coordinator = read("src/social/searchCoordinator.ts");
  assert.match(coordinator, /delayMs = 350/);
  assert.match(coordinator, /generation \+= 1/);
  assert.match(coordinator, /if \(current === generation\) apply\(value\)/);
  assert.match(coordinator, /if \(timer\) clearTimeout\(timer\)/);
});

test("Friends screen provides friends requests search and recoverable network states", () => {
  const screen = read("app/friends.tsx");
  for (const text of ["FRIENDS", "REQUESTS", "SEARCH", "INCOMING", "OUTGOING", "NO PLAYERS FOUND", "RETRY", "SAVE HANDLE"]) assert.match(screen, new RegExp(text));
  assert.match(screen, /if \(busyId\) return/);
  assert.match(screen, /query\.trim\(\)\.toLowerCase\(\)/);
  assert.match(screen, /normalized\.length < 3/);
  assert.match(screen, /HANDLE AVAILABLE/);
  assert.match(screen, /handleAvailable !== true/);
});

test("friend actions are single-flight and refresh authoritative lists", () => {
  const screen = read("app/friends.tsx");
  assert.match(screen, /setBusyId\(player\.public_id\)/);
  assert.match(screen, /await api\.(sendFriendRequest|acceptFriendRequest)/);
  assert.match(screen, /await load\(\)/);
  assert.match(screen, /finally \{ if \(mounted\.current\) setBusyId\(null\)/);
});

test("public profile renders only the public model and friendship action", () => {
  const screen = read("app/player/[publicId].tsx");
  for (const field of ["display_name", "handle", "avatar", "rank", "level", "wins", "matches", "best_score", "friendship_state"]) assert.match(screen, new RegExp(field));
  for (const privateField of ["device_id", "auth_token", "installation_id", "match_seed"]) assert.doesNotMatch(screen, new RegExp(privateField));
});

test("Profile and root navigation expose Social without adding a primary tab", () => {
  const profile = read("app/(tabs)/profile.tsx");
  const rootLayout = read("app/_layout.tsx");
  const tabs = read("app/(tabs)/_layout.tsx");
  assert.match(profile, /title="FRIENDS"[\s\S]*router\.push\("\/friends"/);
  assert.match(rootLayout, /name="friends"/);
  assert.match(rootLayout, /name="player\/\[publicId\]"/);
  assert.doesNotMatch(tabs, /Tabs\.Screen name="friends"/);
});

test("existing identity and match authority remain separate", () => {
  const provider = read("src/profile/PlayerIdentityContext.tsx");
  const play = read("app/play/[contestId].tsx");
  assert.doesNotMatch(provider, /device_id|match_id|validation_version/);
  assert.match(play, /api\.submitDurableResult/);
  assert.match(read("src/api.ts"), /api\.submitResult\(record.payload, signal, playerId\)/);
  assert.match(play, /isPvp[\s\S]*api\.submitPvpResult/);
  assert.doesNotMatch(play, /public_(id|handle)[\s\S]{0,120}(deviceId|authToken)/);
});

test("account deletion clears local presentation and pending social sync state", () => {
  const api = read("src/api.ts");
  assert.match(api, /fire_feast_player_identity_v1/);
  assert.match(api, /fire_feast_pending_social_identity_v1/);
  assert.match(api, /clearLocalGuestData/);
});

test("custom avatar is rendered consistently in social cards and profiles", () => {
  assert.match(read("src/social/SocialPlayerCard.tsx"), /AvatarRenderer configuration=\{player\.avatar\}/);
  assert.match(read("app/player/[publicId].tsx"), /AvatarRenderer configuration=\{player\.avatar\}/);
});
