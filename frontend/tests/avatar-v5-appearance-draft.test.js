const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");
const cache = new Map();
function load(name) {
  if (cache.has(name)) return cache.get(name);
  const file = path.resolve(__dirname, "../src/avatar-v5", name + ".ts");
  const module = { exports: {} }; cache.set(name, module.exports);
  const result = ts.transpileModule(fs.readFileSync(file, "utf8"), { fileName: file, reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  assert.equal(result.diagnostics.length, 0);
  new Function("require", "module", "exports", result.outputText)((id) => {
    assert.ok(id.startsWith("./"), `forbidden runtime dependency ${id}`); return load(id.slice(2));
  }, module, module.exports);
  cache.set(name, module.exports); return module.exports;
}
const clone = (value) => JSON.parse(JSON.stringify(value));
function appearance() {
  const a = clone(load("loadout").EMPTY_AVATAR_V5_LOADOUT);
  return { ...a, faceId: "face", eyeColorId: "brown", backgroundId: "background", hairId: "hair",
    skinTone: { paletteId: "skin", value: 50 }, hairColor: { paletteId: "hair", value: 25.5 },
    wardrobe: { ...a.wardrobe, topId: "shirt", bottomId: "pants", shoesId: "shoes" } };
}
function context() {
  const catalog = {};
  for (const [id, slot, layer] of [["body", "body", "bodySkin"], ["face", "face", "facialFeatures"], ["background", "background", "background"],
    ["hair", "hair", "frontHair"], ["shirt", "top", "topsSleeves"], ["pants", "bottom", "bottoms"], ["shoes", "shoes", "shoes"]]) {
    const parts = [{ id, layer, passes: [{ id: "detail", treatment: "detail", source: 1 }] }];
    if (id === "body") parts.push({ id: "modesty", layer: "modestyUnderlayer", passes: [{ id: "detail", treatment: "detail", source: 1 }] });
    catalog[id] = { id, slot, visibleName: id, acquisition: "starter", contentRevision: 1,
      variants: { standard: { parts: clone(parts) }, broad: { parts: clone(parts) } }, compatibility: { headFit: "shared_v1" } };
  }
  return { catalog, availability: Object.fromEntries(Object.keys(catalog).map((id) => [id, "available"])),
    bodyItemIds: { standard: "body", broad: "body" }, palettes: {
      skin: { skin: [{ value: 0, color: "#000000" }, { value: 100, color: "#FFFFFF" }] },
      hair: { hair: [{ value: 0, color: "#000000" }, { value: 100, color: "#FFFFFF" }] }, eyes: { brown: "#804020" },
    } };
}
function frozen(value) { if (value && typeof value === "object") { Object.values(value).forEach(frozen); Object.freeze(value); } return value; }
const draft = load("appearanceDraft");
const { beginAvatarV5Draft: begin, editAvatarV5Draft: edit, resetAvatarV5Draft: reset, cancelAvatarV5Draft: cancel, confirmAvatarV5Draft: confirm } = draft;
test("begin makes deeply frozen independent saved and draft snapshots", () => {
  const a = appearance(), r = begin(a); assert.equal(r.ok, true);
  for (const field of ["skinTone", "hairColor", "wardrobe", "itemColorways", "gearVisibility"]) {
    assert.notEqual(r.state.saved[field], r.state.draft[field]); assert.notEqual(r.state.saved[field], a[field]);
    assert.ok(Object.isFrozen(r.state.draft[field]));
  }
  a.wardrobe.topId = "external-change"; assert.equal(r.state.saved.wardrobe.topId, "shirt");
  assert.ok(Object.isFrozen(r.state)); assert.ok(Object.isFrozen(r.state.draft));
  assert.equal(begin({}).ok, false);
});
test("typed edits touch only draft, including gear visibility and colorway removal", () => {
  const s = begin(appearance()).state;
  const e = edit(s, { type: "wardrobe", field: "topId", value: "future" }); assert.equal(e.ok, true);
  assert.equal(s.draft.wardrobe.topId, "shirt"); assert.equal(e.state.saved, s.saved); assert.equal(e.state.draft.wardrobe.topId, "future");
  const v = edit(s, { type: "visibility", field: "hat", value: false }); assert.equal(v.state.draft.gearVisibility.hat, false); assert.equal(s.saved.gearVisibility.hat, true);
  const c = edit(s, { type: "colorway", itemId: "shirt", value: "red" }); assert.equal(c.state.draft.itemColorways.shirt, "red");
  assert.deepEqual(edit(c.state, { type: "colorway", itemId: "shirt", value: null }).state.draft.itemColorways, {});
});
test("invalid edits preserve state identity and cannot inject authority or execute getters", () => {
  const s = begin(appearance()).state;
  for (const action of [null, { type: "set", field: "schemaVersion", value: 4 }, { type: "set", field: "equippedGear", value: "gold_apron" },
    { type: "set", field: "bodyId", value: "giant" }, { type: "visibility", field: "hat", value: 1 },
    { type: "wardrobe", field: "topId", value: null }, { type: "colorway", itemId: "__proto__", value: "red" },
    { type: "set", field: "faceId", value: "face", extra: true }, { type: "replace-with-render-plan", value: {} }]) {
    const r = edit(s, action); assert.equal(r.ok, false); assert.equal(r.state, s);
  }
  let calls = 0; const action = { field: "faceId", value: "face", get type() { calls++; return "set"; } };
  assert.equal(edit(s, action).ok, false); assert.equal(calls, 0);
});
test("cancel returns original baseline; reset is explicit and cannot overwrite saved", () => {
  const s = begin(appearance()).state, changed = edit(s, { type: "set", field: "presentation", value: "female" }).state;
  assert.deepEqual(cancel(changed), s.saved); assert.notEqual(cancel(changed), s.saved);
  const target = appearance(); target.bodyId = "broad";
  const r = reset(changed, target); assert.equal(r.ok, true); assert.equal(r.state.draft.bodyId, "broad"); assert.equal(r.state.saved, s.saved);
  target.bodyId = "standard"; assert.equal(r.state.draft.bodyId, "broad");
  const bad = reset(changed, undefined); assert.equal(bad.ok, false); assert.equal(bad.state, changed);
});
test("confirm returns a separate frozen candidate and revalidates availability", () => {
  const s = begin(appearance()).state, c = context(), first = confirm(s, c);
  assert.equal(first.ok, true); assert.deepEqual(first.candidate, s.draft); assert.notEqual(first.candidate, s.draft);
  assert.notEqual(first.candidate.wardrobe, s.draft.wardrobe); assert.ok(Object.isFrozen(first.candidate));
  c.availability.shirt = "lockedPreview";
  const second = confirm(s, c); assert.equal(second.ok, false); assert.equal(second.state, s);
  assert.ok(second.diagnostics.some((d) => d.code === "locked-selection"));
  delete c.availability.shirt; assert.equal(confirm(s, c).ok, false);
});
test("body edits preserve IDs and reassess geometry; presentation never restricts fit", () => {
  const s = begin(appearance()).state, c = context(); delete c.catalog.shirt.variants.broad;
  const broad = edit(s, { type: "set", field: "bodyId", value: "broad" }).state;
  assert.deepEqual(broad.draft.wardrobe, s.draft.wardrobe);
  const r = confirm(broad, c); assert.equal(r.ok, false); assert.ok(r.diagnostics.some((d) => d.code === "missing-geometry-variant"));
  const female = edit(s, { type: "set", field: "presentation", value: "female" }).state; assert.equal(confirm(female, c).ok, true);
});
test("incomplete sentinel, unknown IDs, incompatible items and missing palettes cannot confirm", () => {
  const s = begin(load("loadout").EMPTY_AVATAR_V5_LOADOUT).state; assert.equal(confirm(s, context()).ok, false);
  const unknown = edit(begin(appearance()).state, { type: "wardrobe", field: "topId", value: "future" }).state;
  assert.equal(confirm(unknown, context()).ok, false); assert.equal(unknown.draft.wardrobe.topId, "future");
  const c = context(); c.catalog.shirt.compatibility.incompatibleItemIds = ["pants"]; assert.equal(confirm(begin(appearance()).state, c).ok, false);
  delete c.catalog.shirt.compatibility.incompatibleItemIds; delete c.palettes.skin.skin; assert.equal(confirm(begin(appearance()).state, c).ok, false);
});
test("missing artwork warns but never substitutes selections or persists render fallbacks", () => {
  const a = appearance(), c = context(); c.catalog.shirt.variants.standard.parts = [];
  const s = begin(a).state, r = confirm(s, c);
  assert.equal(r.ok, true); assert.equal(r.candidate.wardrobe.topId, "shirt"); assert.ok(r.diagnostics.some((d) => d.code === "missing-artwork"));
  const render = load("renderPlan").buildAvatarV5RenderPlan({ appearance: s.draft, ...c, tintColors: { skin: "#888888", hair: "#444444", eye: "#804020" }, equipment: { equippedGear: null, equippedGearSlots: {}, equippedCosmetic: null } });
  assert.equal(render.status, "fallback"); assert.deepEqual(s.draft, a);
  assert.equal(reset(s, render).ok, false); assert.equal(confirm(s, c).candidate.wardrobe.topId, "shirt");
});
test("equipment authority remains external and modules have no side-effect dependencies", () => {
  const equipment = frozen({ equippedGear: "gold_apron", equippedGearSlots: { outfit: "shannon_outfit" }, equippedCosmetic: null, modifiers: { score: 2 } });
  const before = JSON.stringify(equipment), c = frozen(context());
  const s = edit(begin(appearance()).state, { type: "visibility", field: "outfit", value: false }).state;
  assert.equal(confirm(s, c).ok, true); assert.equal(JSON.stringify(equipment), before);
  for (const name of ["appearanceValidation", "paletteResolution", "appearanceDraft"]) {
    const source = fs.readFileSync(path.resolve(__dirname, "../src/avatar-v5", name + ".ts"), "utf8");
    assert.doesNotMatch(source, /from ["'][^"']*(?:react|storage|network|api|game\/|profile\/)/);
    assert.doesNotMatch(source, /fetch\(|setItem\(|Date\.now|Math\.random|buildAvatarV5RenderPlan/);
  }
});
