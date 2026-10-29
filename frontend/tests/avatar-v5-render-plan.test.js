const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");
const cache = new Map();
function load(name) {
  if (cache.has(name)) return cache.get(name).exports;
  const module = { exports: {} };
  cache.set(name, module);
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, "../src/avatar-v5", name + ".ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("require", "module", "exports", code)((id) => {
    assert.ok(id.startsWith("./")); return load(id.slice(2));
  }, module, module.exports);
  return module.exports;
}
const { buildAvatarV5RenderPlan: build } = load("renderPlan");
const { EMPTY_AVATAR_V5_LOADOUT: empty } = load("loadout");
const pass = (id = "fill", treatment = "fill", extra = {}) => ({ id, treatment, source: 1, ...extra });
const part = (id, layer, passes = [pass()]) => ({ id, layer, passes });
const item = (id, slot, parts, compatibility = {}) => ({ id, slot, visibleName: id, acquisition: "starter", contentRevision: 1,
  variants: { standard: { parts }, broad: { parts: parts.map((p) => ({ ...p, passes: p.passes.map((v) => ({ ...v, source: 2 })) })) } },
  compatibility: { headFit: "shared_v1", ...compatibility } });
function fixture() {
  return {
    appearance: { ...empty, faceId: "face", hairId: "hair", backgroundId: "absent", wardrobe: { ...empty.wardrobe, topId: "top", bottomId: "bottom", shoesId: "shoes", apronId: "apron" } },
    bodyItemIds: { standard: "body", broad: "body" }, tintColors: { skin: "#a07050", hair: "#201010", eye: "#123456" },
    equipment: { equippedGear: null, equippedGearSlots: {}, equippedCosmetic: null }, equipmentMappings: [],
    catalog: {
      body: item("body", "body", [part("skin", "bodySkin", [pass("fill", "fill", { tint: "skin" })]), part("modesty", "modestyUnderlayer")]),
      face: item("face", "face", [part("front", "facialFeatures")]),
      hair: item("hair", "hair", [part("back", "rearHair"), part("front", "frontHair", [pass("fill", "fill", { tint: "hair" })])]),
      top: item("top", "top", [part("front", "topsSleeves")]),
      bottom: item("bottom", "bottom", [part("front", "bottoms")]),
      shoes: item("shoes", "shoes", [part("front", "shoes")]),
      apron: item("apron", "apron", [part("front", "apronFront")]),
    },
  };
}
function freeze(value) { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
const ids = (plan) => { assert.equal(plan.status, "ready", JSON.stringify(plan)); return [...new Set(plan.passes.map((p) => p.itemId))]; };
function gear(f, id, slot, kind = "performance", compatibility = {}) {
  const visualSlot = slot === "hat" ? "headwear" : slot === "outfit" ? "top" : "apron";
  const layer = slot === "hat" ? "headwear" : slot === "outfit" ? "topsSleeves" : "apronFront";
  f.catalog[id] = item(id, visualSlot, [part("front", layer)], compatibility);
  f.equipmentMappings.push({ backendId: id, slot, kind, visualItemId: id });
  if (kind === "cosmetic") f.equipment.equippedCosmetic = id;
  else f.equipment.equippedGearSlots[slot] = id;
}

test("both geometries support all presentations and select authored fit", () => {
  for (const bodyId of ["standard", "broad"]) for (const presentation of ["male", "female", "non_binary"]) {
    const f = fixture(); f.appearance = { ...f.appearance, bodyId, presentation };
    const result = build(f); ids(result);
    assert.ok(result.passes.every((p) => p.source === (bodyId === "standard" ? 1 : 2)));
  }
});
test("required items, body skin and modesty must all resolve", () => {
  for (const missing of ["body", "face", "top", "bottom", "shoes"]) {
    const f = fixture(); delete f.catalog[missing]; assert.equal(build(f).status, "fallback");
  }
  for (const layer of ["bodySkin", "modestyUnderlayer"]) {
    const f = fixture(); f.catalog.body.variants.standard.parts = f.catalog.body.variants.standard.parts.filter((p) => p.layer !== layer);
    assert.equal(build(f).status, "fallback");
  }
});
test("empty production catalog and sentinel loadout safely fall back", () => {
  const f = fixture(); assert.deepEqual(load("registry").AVATAR_V5_CATALOG, {});
  assert.equal(build({ ...f, catalog: load("registry").AVATAR_V5_CATALOG }).status, "fallback");
  assert.equal(build({ ...f, appearance: empty }).status, "fallback");
});
test("explicit starter retains requested IDs and frozen inputs", () => {
  const f = fixture(); f.appearance.wardrobe.topId = "unknown"; f.starterIds = { top: "top" };
  const before = JSON.stringify(f); const result = build(freeze(f)); ids(result);
  assert.equal(JSON.stringify(f), before);
  assert.ok(result.selections.some((s) => s.requestedId === "unknown" && s.resolvedId === "top" && s.outcome === "starterFallback"));
});
test("canonical ordering, pass order and item tie-break produce unique stable keys", () => {
  const f = fixture(); f.catalog.face.variants.standard.parts[0].layer = "frontHair";
  f.catalog.face.variants.standard.parts[0].passes = [pass("z", "detail"), pass("h", "highlight"), pass("s", "shading"), pass("b"), pass("a")];
  const result = build(f); ids(result);
  assert.deepEqual(result.passes.filter((p) => p.itemId === "face").map((p) => p.passId), ["a", "b", "s", "h", "z"]);
  assert.ok(result.passes.findIndex((p) => p.itemId === "face") < result.passes.findIndex((p) => p.itemId === "hair" && p.partId === "front"));
  assert.equal(new Set(result.passes.map((p) => p.key)).size, result.passes.length);
  const layers = load("layers").AVATAR_V5_LAYER_ORDER;
  const ranks = result.passes.map((p) => layers.indexOf(p.layer));
  assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b));
  f.catalog = Object.fromEntries(Object.entries(f.catalog).reverse()); assert.deepEqual(build(f), result);
});
test("only explicitly tintable fills receive supplied colors", () => {
  const f = fixture(); f.catalog.face.variants.standard.parts[0].passes = [pass("eye", "fill", { tint: "eye" }), pass("fixed"), pass("shadow", "shading"), pass("shine", "highlight"), pass("ink", "detail")];
  const result = build(f); ids(result);
  assert.equal(result.passes.find((p) => p.passId === "eye").tintColor, "#123456");
  for (const name of ["fixed", "shadow", "shine", "ink"]) assert.equal(result.passes.find((p) => p.passId === name).tintColor, undefined);
  delete f.tintColors.skin; assert.equal(build(f).status, "fallback");
});
test("tint metadata on non-fill passes is rejected", () => {
  for (const treatment of ["shading", "highlight", "detail"]) {
    const f = fixture(); f.catalog.top.variants.standard.parts[0].passes = [pass("bad", treatment, { tint: "skin" })];
    assert.equal(build(f).status, "fallback");
  }
});
test("authored colorways replace passes; unknown colorways use original artwork", () => {
  const f = fixture(); f.catalog.top.variants.standard.parts[0].authoredColorways = { red: [pass("red", "fill", { source: 9 })] };
  f.appearance.itemColorways = { top: "red" };
  const red = build(f).passes.find((p) => p.itemId === "top"); assert.equal(red.source, 9); assert.equal(red.tintColor, undefined);
  f.appearance.itemColorways.top = "unknown"; assert.equal(build(f).passes.find((p) => p.itemId === "top").source, 1);
});
test("cosmetics override visible performance gear which overrides wardrobe", () => {
  const f = fixture(); gear(f, "gear", "apron"); gear(f, "gold", "apron", "cosmetic");
  assert.ok(ids(build(f)).includes("gold")); assert.ok(!ids(build(f)).includes("gear")); assert.ok(!ids(build(f)).includes("apron"));
  f.equipment.equippedCosmetic = null; assert.ok(ids(build(f)).includes("gear"));
  f.appearance.gearVisibility = { hat: true, apron: false, outfit: true }; assert.ok(ids(build(f)).includes("apron"));
  f.equipment.equippedCosmetic = "gold"; assert.ok(ids(build(f)).includes("gold"));
});
test("missing, wrong-fit and incompatible override art leaves wardrobe intact", () => {
  for (const failure of ["missing", "fit", "incompatible", "reverse"]) {
    const f = fixture(); gear(f, "gear", "apron");
    if (failure === "missing") delete f.catalog.gear;
    if (failure === "fit") delete f.catalog.gear.variants.standard;
    if (failure === "incompatible") f.catalog.gear.compatibility.incompatibleItemIds = ["top"];
    if (failure === "reverse") f.catalog.top.compatibility.incompatibleItemIds = ["gear"];
    assert.ok(ids(build(f)).includes("apron")); assert.ok(!ids(build(f)).includes("gear"));
  }
});
test("headwear alternatives replace hair only after valid final headwear resolves", () => {
  const f = fixture(); gear(f, "hat", "hat", "performance", { headwearFit: "brimmed-cap" });
  f.catalog.hair.variants.standard.headwearAlternatives = { "brimmed-cap": [part("under", "frontHair")] };
  assert.deepEqual(build(f).passes.filter((p) => p.itemId === "hair").map((p) => p.partId), ["under"]);
  delete f.catalog.hat.variants.standard;
  assert.deepEqual(build(f).passes.filter((p) => p.itemId === "hair").map((p) => p.partId), ["back", "front"]);
});
test("full-cover suppresses ordinary hair but allows authored alternative; hidesHair suppresses all", () => {
  const f = fixture(); gear(f, "hat", "hat", "performance", { headwearFit: "full-cover" });
  assert.ok(!ids(build(f)).includes("hair"));
  f.catalog.hair.variants.standard.headwearAlternatives = { "full-cover": [part("under", "frontHair")] };
  assert.ok(ids(build(f)).includes("hair"));
  f.catalog.hat.compatibility.hidesHair = true; assert.ok(!ids(build(f)).includes("hair"));
});
test("multipart outfit covers complete underlying art atomically", () => {
  const f = fixture(); gear(f, "outfit", "outfit", "performance", { covers: ["bottoms"] });
  f.catalog.outfit.variants.standard.parts.push(part("pants", "bottoms"));
  const result = build(f); assert.ok(!ids(result).includes("bottom"));
  assert.equal(result.passes.filter((p) => p.itemId === "outfit").length, 2);
  assert.ok(result.passes.some((p) => p.layer === "modestyUnderlayer"));
});
test("partial, unbacked and protected coverage fail safely", () => {
  for (const mode of ["partial", "unbacked", "protected"]) {
    const f = fixture(); gear(f, "outfit", "outfit", "performance", { covers: [mode === "protected" ? "modestyUnderlayer" : "bottoms"] });
    if (mode === "partial") {
      f.catalog.bottom.variants.standard.parts.push(part("rear", "rearGarmentAccessory"));
      f.catalog.outfit.variants.standard.parts.push(part("pants", "bottoms"));
    }
    assert.equal(build(f).status, "fallback");
  }
});
test("conflicting wardrobe selections and ambiguous override mappings are bounded fallbacks", () => {
  const f = fixture(); f.catalog.top.compatibility.incompatibleItemIds = ["bottom"];
  assert.equal(build(f).status, "fallback");
  const g = fixture(); gear(g, "gear", "apron"); g.equipmentMappings.push({ ...g.equipmentMappings[0] });
  assert.equal(build(g).status, "fallback");
});
test("duplicate internal part/pass IDs cannot produce colliding render keys", () => {
  for (const mode of ["part", "pass"]) {
    const f = fixture(); const parts = f.catalog.top.variants.standard.parts;
    if (mode === "part") parts.push({ ...parts[0] }); else parts[0].passes.push(pass());
    assert.equal(build(f).status, "fallback");
  }
});
test("equipment and appearance remain byte-for-byte unchanged under visual overrides", () => {
  const f = fixture(); gear(f, "gear", "apron"); gear(f, "gold", "apron", "cosmetic");
  const before = JSON.stringify(f); ids(build(freeze(f))); assert.equal(JSON.stringify(f), before);
});
