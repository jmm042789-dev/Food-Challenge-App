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
const { validateAvatarV5Appearance: validate, assessAvatarV5Selections: assess } = load("appearanceValidation");
const codes = (r) => r.diagnostics.map((d) => `${d.path}:${d.code}`);
test("all presentations and both geometries validate without changing selections", () => {
  for (const presentation of ["male", "female", "non_binary"]) for (const bodyId of ["standard", "broad"]) {
    const a = frozen({ ...appearance(), presentation, bodyId });
    const r = validate(a); assert.equal(r.ok, true); assert.deepEqual(r.appearance, a); assert.notEqual(r.appearance, a);
    assert.deepEqual(assess(r.appearance, frozen(context())), []);
  }
});
test("wrong root, nested structures, missing and extra fields give stable diagnostics", () => {
  for (const x of [null, [], 4, "appearance", new Date()]) assert.equal(validate(x).ok, false);
  for (const field of Object.keys(appearance())) { const a = appearance(); delete a[field]; assert.ok(codes(validate(a)).includes(`${field}:missing-field`)); }
  for (const field of ["skinTone", "hairColor", "wardrobe", "gearVisibility", "itemColorways"]) {
    const a = appearance(); a[field] = []; assert.ok(codes(validate(a)).includes(`${field}:invalid-object`));
  }
  const a = appearance(); a.extra = true; a.wardrobe.extra = "x";
  assert.ok(codes(validate(a)).includes("extra:unexpected-field"));
  assert.ok(codes(validate(a)).includes("wardrobe.extra:unexpected-field"));
  assert.deepEqual(validate(a), validate(a));
});
test("rejects unsafe keys and accessors without executing them", () => {
  let called = false;
  const a = appearance(); Object.defineProperty(a, "faceId", { enumerable: true, get() { called = true; throw Error("getter executed"); } });
  assert.equal(validate(a).ok, false); assert.equal(called, false);
  const b = appearance(); b.itemColorways = JSON.parse('{"__proto__":"red"}'); assert.ok(codes(validate(b)).includes("itemColorways.__proto__:unsafe-key"));
  b.itemColorways = { constructor: "red" }; assert.equal(validate(b).ok, false);
  const c = appearance(); c[Symbol("extra")] = 1; assert.equal(validate(c).ok, false);
  const d = Object.create({ faceId: "face" }); Object.assign(d, appearance()); assert.equal(validate(d).ok, false);
});
test("strict enums, version, IDs, nullable fields and numeric boundaries", () => {
  for (const [field, value] of [["schemaVersion", 4], ["bodyId", "giant"], ["presentation", "other"], ["faceId", " a "], ["faceId", "../face"], ["faceId", "constructor"], ["faceId", null], ["backgroundId", ""], ["faceId", "a".repeat(129)]]) {
    assert.equal(validate({ ...appearance(), [field]: value }).ok, false);
  }
  for (const value of [-1, 101, NaN, Infinity, "50"]) { const a = appearance(); a.skinTone.value = value; assert.equal(validate(a).ok, false); }
  for (const value of [0, 0.5, 100]) { const a = appearance(); a.skinTone.value = value; assert.equal(validate(a).appearance.skinTone.value, value); }
  const a = appearance(); a.gearVisibility.hat = 1; assert.equal(validate(a).ok, false);
  a.gearVisibility.hat = false; a.hairId = null; a.facialHairId = null; a.effectId = null; assert.equal(validate(a).ok, true);
});
test("sentinels require explicit incomplete mode; unknown well-formed IDs remain unchanged", () => {
  const empty = load("loadout").EMPTY_AVATAR_V5_LOADOUT;
  assert.equal(validate(empty).ok, false); assert.equal(validate(empty, { allowIncomplete: true }).ok, true);
  const a = appearance(); a.faceId = "future-face_2";
  assert.equal(validate(a).appearance.faceId, a.faceId);
  assert.ok(assess(a, context()).some((d) => d.path === "faceId" && d.code === "unknown-item"));
});
test("selection diagnostics distinguish slot, permissions, geometry and missing artwork", () => {
  const cases = [
    [(c) => { c.catalog.shirt.slot = "hair"; }, "wrong-slot", "error"],
    [(c) => { c.availability.shirt = "lockedPreview"; }, "locked-selection", "error"],
    [(c) => { delete c.availability.shirt; }, "unknown-availability", "error"],
    [(c) => { delete c.catalog.shirt.variants.standard; }, "missing-geometry-variant", "error"],
    [(c) => { c.catalog.shirt.variants.standard.parts = []; }, "missing-artwork", "warning"],
    [(c) => { c.catalog.shirt.variants.standard.parts[0].passes[0].source = null; }, "missing-artwork", "warning"],
    [(c) => { c.catalog.shirt.id = "other"; }, "catalog-id-mismatch", "error"],
  ];
  for (const [change, code, severity] of cases) { const c = context(); change(c); assert.ok(assess(appearance(), c).some((d) => d.path === "wardrobe.topId" && d.code === code && d.severity === severity)); }
  const c = context(); c.availability.shirt = "owned"; assert.deepEqual(assess(appearance(), c), []);
  delete c.bodyItemIds.standard; assert.ok(assess(appearance(), c).some((d) => d.code === "missing-body-mapping"));
});
test("colorways use selected geometry, retain preferences and reject unknown definitions", () => {
  const a = appearance(), c = context(); a.itemColorways = { shirt: "red" };
  assert.ok(assess(a, c).some((d) => d.code === "invalid-colorway"));
  c.catalog.shirt.variants.standard.parts[0].authoredColorways = { red: [{ id: "red", treatment: "detail", source: 2 }] };
  assert.deepEqual(assess(a, c), []);
  a.bodyId = "broad"; assert.ok(assess(a, c).some((d) => d.code === "invalid-colorway"));
  assert.equal(a.itemColorways.shirt, "red");
  a.itemColorways = { future: "blue" }; assert.ok(assess(a, c).some((d) => d.code === "unknown-item"));
});
test("incompatibility is symmetric and inherited availability is not permission", () => {
  const c = context(); c.catalog.pants.compatibility.incompatibleItemIds = ["shirt"];
  assert.ok(assess(appearance(), c).some((d) => d.code === "incompatible-selection"));
  c.catalog.pants.compatibility.incompatibleItemIds = [];
  c.availability = Object.create(c.availability);
  assert.ok(assess(appearance(), c).some((d) => d.code === "unknown-availability"));
});

test("trailing newlines, nested omissions and sentinel colorway preferences are rejected", () => {
  const a = appearance(); a.faceId = "face\n"; assert.equal(validate(a).ok, false);
  a.faceId = "face"; delete a.wardrobe.topId; assert.ok(codes(validate(a)).includes("wardrobe.topId:missing-field"));
  const b = appearance(); b.itemColorways = { shirt: "__unassigned__" };
  assert.equal(validate(b).ok, false); assert.equal(validate(b, { allowIncomplete: true }).ok, true);
  b.itemColorways = { __unassigned__: "red" }; assert.equal(validate(b).ok, false);
});
test("dormant locked colorways and empty authored colorway passes are diagnosed", () => {
  const a = appearance(), c = context();
  c.catalog.hat = clone(c.catalog.shirt); c.catalog.hat.id = "hat"; c.catalog.hat.slot = "headwear";
  c.catalog.hat.variants.standard.parts[0].authoredColorways = { red: [] };
  a.itemColorways = { hat: "red" }; c.availability.hat = "lockedPreview";
  const d = assess(a, c); assert.ok(d.some((x) => x.code === "locked-selection")); assert.ok(d.some((x) => x.code === "missing-artwork"));
});
