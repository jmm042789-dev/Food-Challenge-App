const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

// Execute the actual isolated TS modules, resolving their normal extensionless imports.
// No renderer/backend mocks or copied implementation rules.
const cache = new Map();
function load(name) {
  const filename = path.resolve(__dirname, "../src/avatar-v5", name + ".ts");
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("require", "module", "exports", code)((id) => {
    assert.ok(id.startsWith("./"), "V5 must not acquire production/runtime dependencies");
    return load(id.slice(2));
  }, module, module.exports);
  return module.exports;
}
const v5 = load("index");
const read = (name) => fs.readFileSync(path.resolve(__dirname, "..", name), "utf8");
const pass = (id, treatment = "fill", extra = {}) => ({ id, treatment, source: 1, ...extra });
const part = (id, layer, passes = [pass("fill")]) => ({ id, layer, passes });
const item = (id, slot, parts, bodies = ["standard", "broad"]) => ({
  id, slot, visibleName: id, acquisition: "starter", contentRevision: 1,
  variants: Object.fromEntries(bodies.map((body) => [body, { parts }])),
  compatibility: { headFit: "shared_v1" },
});
function freeze(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

// Numeric source=1 is a test-only bundled-image token; no fake artwork is registered.
const catalog = freeze({
  shirt: item("shirt", "top", [part("shirt", "topsSleeves")]),
  broadOnly: item("broadOnly", "top", [part("shirt", "topsSleeves")], ["broad"]),
  hair: item("hair", "hair", [part("fringe", "frontHair"), part("back", "rearHair")]),
  body: item("body", "body", [part("skin", "bodySkin"), part("modesty", "modestyUnderlayer")]),
  unsafeBody: item("unsafeBody", "body", [part("skin", "bodySkin")]),
});

test("V5 schema uses canonical identity and explicit unassigned infrastructure values", () => {
  const a = v5.EMPTY_AVATAR_V5_LOADOUT;
  assert.equal(a.schemaVersion, 5);
  assert.deepEqual(v5.AVATAR_V5_PRESENTATIONS, ["male", "female", "non_binary"]);
  assert.deepEqual(v5.AVATAR_V5_BODY_IDS, ["standard", "broad"]);
  assert.equal(a.bodyId, "standard");
  assert.equal(a.faceId, "__unassigned__");
  assert.deepEqual(Object.keys(a.wardrobe), ["topId", "bottomId", "shoesId", "socksId", "apronId", "headwearId", "eyewearId", "neckAccessoryId", "wristAccessoryId", "miscAccessoryId"]);
  for (const forbidden of ["version", "base", "performanceGear", "equippedGear", "stats", "modifiers"]) assert.equal(forbidden in a, false);
  assert.ok(Object.isFrozen(a.wardrobe) && Object.isFrozen(a.gearVisibility));
});

test("every presentation can use either geometry; catalog fit depends only on body", () => {
  for (const presentation of v5.AVATAR_V5_PRESENTATIONS) {
    for (const bodyId of v5.AVATAR_V5_BODY_IDS) {
      const appearance = { ...v5.EMPTY_AVATAR_V5_LOADOUT, presentation, bodyId };
      assert.equal(v5.resolveAvatarV5Item({ id: "shirt", slot: "top", bodyId: appearance.bodyId }, catalog).outcome, "selected");
    }
  }
  assert.deepEqual(v5.avatarV5ItemsForBody("standard", catalog).map((x) => x.id), ["shirt", "hair", "body", "unsafeBody"]);
  assert.equal(v5.resolveAvatarV5Item({ id: "broadOnly", slot: "top", bodyId: "standard", starterId: "shirt" }, catalog).resolvedId, "shirt");
  assert.equal(v5.resolveAvatarV5Item({ id: "broadOnly", slot: "top", bodyId: "broad" }, catalog).resolvedId, "broadOnly");
});

test("all 27 named layers follow approved deterministic order", () => {
  assert.deepEqual(v5.AVATAR_V5_LAYER_ORDER, [
    "background", "rearEffects", "rearGarmentAccessory", "rearHair", "bodySkin",
    "modestyUnderlayer", "socks", "bottoms", "shoes", "topsSleeves", "rearApronWaist",
    "outerGarmentFront", "apronFront", "rearNeckAccessory", "longHairFront", "faceSkinDetail",
    "facialFeatures", "facialHair", "frontHair", "eyewearRear", "headwear", "eyewearFront",
    "exposedHandsForearms", "wristAccessory", "foregroundNeckMisc", "heldAccessoryFront", "foregroundEffects",
  ]);
  const original = freeze([part("z", "frontHair"), part("a", "frontHair"), part("back", "rearHair"), part("bad", 999)]);
  assert.deepEqual(v5.sortAvatarV5Parts(original).map((p) => p.id), ["back", "a", "z"]);
  assert.equal(original[0].id, "z");
  assert.deepEqual(v5.resolveAvatarV5Item({ id: "hair", slot: "hair", bodyId: "standard" }, catalog).parts.map((p) => p.id), ["back", "fringe"]);
});

test("tint fills preserve untinted illustration passes and authored colorways", () => {
  const garment = item("colored", "top", [{ ...part("front", "topsSleeves", [pass("ink", "detail"), pass("base", "fill", { tint: "skin" }), pass("shadow", "shading")]),
    authoredColorways: { gold: [pass("gold")] } }]);
  const source = freeze({ colored: garment });
  const request = { id: "colored", slot: "top", bodyId: "standard" };
  assert.deepEqual(v5.resolveAvatarV5Item(request, source).parts[0].passes.map((p) => p.id), ["base", "shadow", "ink"]);
  assert.equal(v5.resolveAvatarV5Item({ ...request, colorwayId: "gold" }, source).parts[0].passes[0].id, "gold");
  assert.equal(v5.resolveAvatarV5Item({ ...request, colorwayId: "unknown" }, source).parts[0].passes[0].id, "base");
  const invalid = { bad: item("bad", "top", [part("bad", "topsSleeves", [pass("bad", "shading", { tint: "hair" })])]) };
  assert.equal(v5.resolveAvatarV5Item({ ...request, id: "bad" }, invalid).outcome, "useExistingAvatar");
});

test("headwear uses shared fit alternatives and full-cover safely suppresses hair", () => {
  const request = { id: "hair", slot: "hair", bodyId: "standard", headwearFit: "full-cover" };
  assert.deepEqual(v5.resolveAvatarV5Item(request, catalog).parts, []);
  const alternate = item("alt", "hair", [part("ordinary", "frontHair")]);
  alternate.variants.standard.headwearAlternatives = { "brimmed-cap": [part("under-cap", "frontHair")] };
  assert.equal(v5.resolveAvatarV5Item({ ...request, id: "alt", headwearFit: "brimmed-cap" }, { alt: alternate }).parts[0].id, "under-cap");
});

test("missing optional art is omitted; required art delegates to existing avatar", () => {
  for (const slot of ["hair", "facialHair", "apron", "headwear", "eyewear", "effect"]) {
    assert.equal(v5.resolveAvatarV5Item({ id: "unknown", slot, bodyId: "standard" }).outcome, "omitted");
  }
  for (const slot of ["body", "face", "top", "bottom", "shoes"]) {
    assert.equal(v5.resolveAvatarV5Item({ id: "unknown", slot, bodyId: "standard" }).outcome, "useExistingAvatar");
  }
  assert.equal(v5.resolveAvatarV5Item({ id: null, slot: "hair", bodyId: "standard", starterId: "hair" }, catalog).outcome, "omitted");
});

test("unknown legacy/server IDs, wrong slots and prototype keys fall back without mutation", () => {
  for (const id of ["legacy_unknown", "new_server_item", "__proto__", "toString", "hair"]) {
    const request = freeze({ id, slot: "top", bodyId: "standard", starterId: "shirt" });
    const result = v5.resolveAvatarV5Item(request, catalog);
    assert.equal(result.outcome, "starterFallback");
    assert.equal(result.requestedId, id);
    assert.equal(result.resolvedId, "shirt");
    assert.equal(request.id, id);
  }
});

test("body without permanent modesty and missing image sources cannot resolve", () => {
  assert.equal(v5.resolveAvatarV5Item({ id: "unsafeBody", slot: "body", bodyId: "standard", starterId: "body" }, catalog).resolvedId, "body");
  const bad = { bad: item("bad", "top", [part("bad", "topsSleeves", [pass("bad", "fill", { source: null })])]) };
  assert.equal(v5.resolveAvatarV5Item({ id: "bad", slot: "top", bodyId: "standard" }, bad).outcome, "useExistingAvatar");
});

test("incompatible selections resolve safely without removing saved selections", () => {
  const incompatible = item("conflict", "top", [part("front", "topsSleeves")]);
  incompatible.compatibility.incompatibleItemIds = ["apron"];
  const request = freeze({ id: "conflict", slot: "top", bodyId: "standard", selectedItemIds: ["apron"], starterId: "shirt" });
  assert.equal(v5.resolveAvatarV5Item(request, { ...catalog, conflict: incompatible }).resolvedId, "shirt");
  assert.deepEqual(request.selectedItemIds, ["apron"]);
});

test("Shannon and Golden Apron reserve real backend IDs without pretending art exists", () => {
  assert.deepEqual(v5.AVATAR_V5_EQUIPMENT_MAPPINGS.map((m) => m.backendId), ["shannon_hat", "shannon_apron", "shannon_outfit", "gold_apron"]);
  assert.ok(v5.AVATAR_V5_EQUIPMENT_MAPPINGS.every((m) => m.visualItemId === null));
  assert.deepEqual(v5.AVATAR_V5_CATALOG, {});
});

test("gear visibility and cosmetic override are visual-only and never mutate equipment", () => {
  const equipment = freeze({ equippedGear: null, equippedGearSlots: { hat: "shannon_hat", apron: "shannon_apron", outfit: "shannon_outfit" }, equippedCosmetic: "gold_apron" });
  const before = JSON.stringify(equipment);
  const visibility = freeze({ hat: false, apron: true, outfit: true });
  assert.deepEqual(v5.avatarV5EquipmentVisualCandidates(equipment, visibility), []);
  // Test-only visual IDs prove future mapping behavior; none enter the shipped catalog.
  const mappings = v5.AVATAR_V5_EQUIPMENT_MAPPINGS.map((m) => ({ ...m, visualItemId: "test_" + m.backendId }));
  assert.deepEqual(v5.avatarV5EquipmentVisualCandidates(equipment, visibility, mappings).map((m) => m.backendId), ["shannon_apron", "shannon_outfit", "gold_apron"]);
  assert.deepEqual(v5.avatarV5EquipmentVisualCandidates(equipment, { hat: false, apron: false, outfit: false }, mappings).map((m) => m.backendId), ["gold_apron"]);
  assert.equal(JSON.stringify(equipment), before);
  assert.deepEqual(v5.avatarV5EquipmentVisualCandidates({ ...equipment, equippedGearSlots: { hat: "unknown" }, equippedCosmetic: null }, visibility, mappings), []);
});

test("legacy visual mapping is supported without displacing authoritative slotted gear", () => {
  const mappings = [{ backendId: "old", slot: "hat", kind: "performance", visualItemId: "test_old" }];
  const equipment = { equippedGear: "old", equippedGearSlots: {}, equippedCosmetic: null };
  assert.equal(v5.avatarV5EquipmentVisualCandidates(equipment, { hat: true }, mappings).length, 1);
  assert.equal(v5.avatarV5EquipmentVisualCandidates({ ...equipment, equippedGearSlots: { apron: "current" } }, { hat: true }, mappings).length, 0);
});

test("alignment and all render crops match approved guides", () => {
  assert.deepEqual(v5.AVATAR_V5_RENDER_MODES, {
    FULL_BODY: { x: 0, y: 0, width: 1024, height: 1024 },
    PROFILE: { x: 300, y: 48, width: 424, height: 424 },
    COMPACT: { x: 364, y: 48, width: 296, height: 296 },
    TINY: { x: 404, y: 48, width: 216, height: 216 },
  });
  assert.equal(v5.AVATAR_V5_ALIGNMENT.centerline, 512);
  assert.equal(v5.AVATAR_V5_ALIGNMENT.soleBaseline, 952);
  assert.deepEqual(v5.AVATAR_V5_ALIGNMENT.shoulders, [{ x: 406, y: 270 }, { x: 618, y: 270 }]);
});

test("literal registry architecture contains no dynamic asset loading or production dependencies", () => {
  const registry = read("src/avatar-v5/registry.ts");
  assert.ok(registry.includes('literal require("...png")'));
  for (const filename of fs.readdirSync(path.resolve(__dirname, "../src/avatar-v5"))) {
    if (!filename.endsWith(".ts")) continue;
    const source = read("src/avatar-v5/" + filename);
    assert.doesNotMatch(source, /require\(`|require\([^"']/);
    assert.doesNotMatch(source, /from ["'].*(?:api|storage|game\/|profile\/)/);
    assert.doesNotMatch(source, /fetch\(|setTimeout\(|setInterval\(/);
  }
});

test("V4 identity and all production consumers remain disconnected from V5", () => {
  const identity = read("src/profile/PlayerIdentity.ts");
  assert.match(identity, /version: 4/);
  function visit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { if (entry.name !== "avatar-v5") visit(full); }
      else if (/\.[jt]sx?$/.test(entry.name)) {
        assert.doesNotMatch(fs.readFileSync(full, "utf8"), /(?:from\s*|require\(\s*|import\(\s*)["'][^"']*avatar-v5/, full);
      }
    }
  }
  visit(path.resolve(__dirname, "../app"));
  visit(path.resolve(__dirname, "../src"));
});

test("art contract retains everyday proportions, geometry fitting and no art activation", () => {
  const spec = read("src/assets/avatar-v5/README.md");
  for (const phrase of ["1024 x 1024", "standard", "broad", "average everyday", "Never tightly crop", "programmer-art", "V4 remains production-active", "modestyUnderlayer"]) assert.ok(spec.includes(phrase), phrase);
});
