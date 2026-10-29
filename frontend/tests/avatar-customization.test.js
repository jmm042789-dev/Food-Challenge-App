const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("legacy identity records migrate in place with safe version 4 defaults", () => {
  const model = read("src/profile/PlayerIdentity.ts");
  assert.match(model, /STORAGE_KEY = "fire_feast_player_identity_v1"/);
  assert.match(model, /version: 4/);
  assert.match(model, /presentation: "non_binary"/);
  assert.match(model, /sanitizeAvatar\(stored\.avatar\)/);
});

test("invalid and missing options sanitize per category without resetting the name", () => {
  const model = read("src/profile/PlayerIdentity.ts");
  assert.match(model, /const avatar = \{ \.\.\.DEFAULT_AVATAR \}/);
  assert.match(model, /validOption\(category, value\?\.\[category\]\)/);
  assert.match(model, /gamerName: name\.normalized, avatar: sanitizeAvatar\(identity\.avatar\)/);
});

test("five presets apply complete drafts and individual choices update preview only", () => {
  const model = read("src/profile/PlayerIdentity.ts");
  const screen = read("app/avatar-customization.tsx");
  for (const id of ["ember_ace", "midnight_pro", "golden_grill", "emerald_chef", "royal_heat"]) assert.match(model, new RegExp(`preset\\(\"${id}\"`));
  assert.match(screen, /setAvatar\(\{ \.\.\.item\.avatar \}\)/);
  assert.match(screen, /updateAvatarDraft\(current, key, item\.id\)/);
  assert.match(screen, /<AvatarRenderer configuration=\{avatar\} size=\{176\}/);
});

test("draft changes persist only through Save while Cancel only navigates back", () => {
  const screen = read("app/avatar-customization.tsx");
  assert.match(screen, /const result = await saveIdentity/);
  assert.match(screen, /if \(result\.ok\) router\.back\(\)/);
  assert.match(screen, /title="CANCEL"[^>]+onPress=\{\(\) => router\.back\(\)\}/);
  assert.doesNotMatch(screen, /onPress=\{\(\) => saveIdentity/);
});

test("shared portrait renders selected configuration and simplifies compact sizes", () => {
  const renderer = read("src/profile/AvatarRenderer.tsx");
  const portrait = read("src/game/ui/CharacterPortrait.tsx");
  assert.match(renderer, /sanitizeAvatar\(configuration\)/);
  assert.match(renderer, /renderModeForSize\(size\)/);
  assert.match(renderer, /avatar\.outfitColor/);
  assert.match(renderer, /avatar\.hair/);
  assert.match(renderer, /avatar\.eyes/);
  assert.match(portrait, /<AvatarRenderer configuration=\{avatarConfiguration\}/);
});
