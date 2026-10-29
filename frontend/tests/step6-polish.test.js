const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("schema v4 supports all presentation options and bounded slider migration", () => {
  const model = read("src/profile/PlayerIdentity.ts");
  for (const id of ["male", "female", "non_binary"]) assert.match(model, new RegExp(`id: "${id}"`));
  assert.match(model, /Math\.min\(100, Math\.max\(0/);
  assert.match(model, /LEGACY_SKIN/); assert.match(model, /LEGACY_HAIR/);
  assert.match(model, /skinToneValue/); assert.match(model, /hairColorValue/);
});

test("avatar creator uses accessible live sliders and keeps all categories presentation-neutral", () => {
  const screen = read("app/avatar-customization.tsx");
  assert.match(screen, /accessibilityRole="adjustable"/);
  assert.match(screen, /onResponderMove=\{update\}/);
  assert.match(screen, /PRESENTATION_OPTIONS\.map/);
  assert.match(screen, /AVATAR_OPTIONS\[key\]\.map/);
  assert.match(screen, /subtitle="A visual style only; every option below stays available"/);
});

test("renderer resolves curated gradients simplifies compact portraits and supports gear layers", () => {
  const renderer = read("src/profile/AvatarRenderer.tsx");
  assert.match(renderer, /resolveSkinTone\(avatar\.skinToneValue\)/);
  assert.match(renderer, /resolveHairColor\(avatar\.hairColorValue\)/);
  assert.match(renderer, /renderModeForSize\(size\)/);
  assert.match(renderer, /equippedGearSlots\?\.hat/);
  assert.match(renderer, /equippedGearSlots\?\.apron/);
  assert.match(renderer, /equippedGearSlots\?\.outfit/);
});

test("rapid bite feedback is pooled rate-limited and never haptic per tap", () => {
  const registry = read("src/audio/AudioRegistry.ts");
  const play = read("app/play/[contestId].tsx");
  assert.match(registry, /CORRECT_BITE:[^\n]*minIntervalMs: 110[^\n]*poolSize: 2/);
  const handler = play.slice(play.indexOf("const handleTap"), play.indexOf("const handleUseAntacid"));
  assert.doesNotMatch(handler, /Haptics\./);
  for (const event of ["HEAT_WARNING", "BURNOUT", "ANTACID_SAVE", "RECOVERY"]) assert.match(play, new RegExp(`playAudioEvent\\("${event}"\\)`));
});

test("first-use tips persist once without effect setter cycles", () => {
  const tip = read("src/onboarding/FirstUseTip.tsx");
  const shop = read("app/(tabs)/shop.tsx");
  const friends = read("app/friends.tsx");
  assert.match(tip, /fire_feast_first_use_tip_v1:/);
  assert.match(tip, /setVisible\(false\)[\s\S]*storage\.setItem/);
  assert.match(shop, /tipKey="gear"/); assert.match(friends, /tipKey="pvp"/);
});

test("tutorial accurately covers action heat gear social PvP quips and daily rewards", () => {
  const tutorial = read("app/tutorial.tsx");
  for (const phrase of ["Bite or Slice", "two-second warning", "burnout", "Hat, Apron, and Outfit", "three in-game quips", "Daily Charcuterie"]) assert.match(tutorial, new RegExp(phrase));
});
