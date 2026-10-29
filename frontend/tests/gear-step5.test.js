const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("shop exposes responsive gear categories and explicit effects", () => {
  const shop = read("app/(tabs)/shop.tsx");
  for (const label of ["All", "Hats", "Aprons", "Outfits", "Sets"]) assert.match(shop, new RegExp(`"${label}"`));
  assert.match(shop, /WHAT THIS GEAR DOES IN GAME/);
  assert.match(shop, /effect_description/);
  assert.match(shop, /DETAILS \/ EFFECTS/);
});

test("tribute sets support authoritative single-flight complete-set purchase", () => {
  const shop = read("app/(tabs)/shop.tsx");
  const api = read("src/api.ts");
  assert.match(shop, /actionInFlight\.current/);
  assert.match(shop, /api\.purchaseGearSet\(set\.id\)/);
  assert.match(shop, /BUY COMPLETE SET/);
  assert.match(api, /\/purchase\/gear-set/);
});

test("profile and locker present three independent slots without changing identity", () => {
  const profile = read("app/(tabs)/profile.tsx");
  const locker = read("app/locker.tsx");
  assert.match(profile, /\["Hat", "Apron", "Outfit"\]/);
  assert.match(profile, /COMPLETE SET ACTIVE/);
  assert.match(profile, /PlayerProfileCard[\s\S]*identity=\{identity\}/);
  assert.match(locker, /Equip one Hat, one Apron, and one Outfit/);
  assert.match(locker, /equipmentStatus\(item, player\)/);
});

test("gameplay consumes server-snapshotted modifier values", () => {
  const route = read("app/play/[contestId].tsx");
  const loop = read("src/game/useGameLoop.ts");
  const modifiers = read("src/game/matchModifiers.ts");
  assert.match(route, /authoritativeGearModifiers/);
  assert.match(loop, /deriveMatchStats\(equippedGear, authoritativeGearModifiers\)/);
  assert.match(modifiers, /if \(authoritative\) return \{ \.\.\.BASE_MATCH_STATS, \.\.\.authoritative/);
  assert.match(route, /heat_generation_multiplier/);
});

test("equipment status recognizes any equipped slot and retains legacy compatibility", () => {
  const equipment = read("src/equipmentState.ts");
  assert.match(equipment, /Object\.values\(inventory\.equipped_gear_slots \?\? \{\}\)/);
  assert.match(equipment, /\?\? inventory\.equipped_gear/);
});
