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
const { resolveAvatarV5Palette: resolve, resolveAvatarV5TintColors: tints } = load("paletteResolution");
const defs = { p: [{ value: 0, color: "#000000" }, { value: 100, color: "#ffffff" }] };
test("endpoints and RGB rounding are deterministic and uppercase", () => {
  for (const [value, expected] of [[0, "#000000"], [100, "#FFFFFF"], [50, "#808080"], [0.5, "#010101"], [25.5, "#414141"]]) {
    const r = resolve(frozen({ paletteId: "p", value }), frozen(defs)); assert.equal(r.ok, true); assert.equal(r.value, expected);
    assert.deepEqual(r, resolve({ paletteId: "p", value }, defs));
  }
});
test("piecewise interpolation handles exact and fractional stops with decreasing channels", () => {
  const d = { p: [{ value: 0, color: "#FF0000" }, { value: 25.5, color: "#00FF00" }, { value: 100, color: "#0000FF" }] };
  assert.equal(resolve({ paletteId: "p", value: 25.5 }, d).value, "#00FF00");
  assert.equal(resolve({ paletteId: "p", value: 12.75 }, d).value, "#808000");
});
test("invalid stop definitions are rejected rather than sorted, clamped or defaulted", () => {
  for (const stops of [[], [{ value: 0, color: "#000000" }], [{ value: 1, color: "#000000" }, { value: 100, color: "#ffffff" }],
    [{ value: 0, color: "red" }, { value: 100, color: "#fff" }], [{ value: 0, color: "#000000" }, { value: 0, color: "#ffffff" }, { value: 100, color: "#ffffff" }],
    [{ value: 0, color: "#000000" }, { value: NaN, color: "#ffffff" }, { value: 100, color: "#ffffff" }],
    [{ value: 0, color: "#000000" }, { value: 90, color: "#ffffff" }, { value: 20, color: "#ffffff" }, { value: 100, color: "#ffffff" }], [null, null]]) {
    const r = resolve({ paletteId: "p", value: 50 }, { p: stops }); assert.equal(r.ok, false); assert.equal(r.diagnostics[0].code, "invalid-palette-definition");
  }
});
test("unknown and sentinel palettes, out-of-range and nonfinite selections fail explicitly", () => {
  for (const value of [-0.1, 100.1, NaN, Infinity, "20"]) assert.equal(resolve({ paletteId: "p", value }, defs).ok, false);
  assert.equal(resolve({ paletteId: "missing", value: 10 }, defs).diagnostics[0].code, "unknown-palette");
  assert.equal(resolve({ paletteId: "__unassigned__", value: 10 }, { __unassigned__: defs.p }).ok, false);
  assert.equal(resolve({ paletteId: "p", value: 10 }, Object.create(defs)).ok, false);
});
test("skin hair and eyes resolve independently without replacing selections", () => {
  const a = frozen(appearance()), c = frozen(context()), before = JSON.stringify(a);
  const r = tints(a, c.palettes); assert.equal(r.ok, true); assert.deepEqual(r.value, { skin: "#808080", hair: "#414141", eye: "#804020" });
  assert.equal(JSON.stringify(a), before); assert.ok(Object.isFrozen(r.value));
  const d = context().palettes; delete d.eyes.brown; assert.equal(tints(a, d).diagnostics[0].code, "unknown-eye-color");
  d.eyes.brown = "#fff"; assert.equal(tints(a, d).diagnostics[0].code, "invalid-eye-color-definition");
});

test("strict color format rejects trailing newlines and sparse definitions fail explicitly", () => {
  const sparse = [{ value: 0, color: "#000000" }, , { value: 100, color: "#FFFFFF" }];
  assert.equal(resolve({ paletteId: "p", value: 25 }, { p: sparse }).ok, false);
  assert.equal(resolve({ paletteId: "p", value: 25 }, { p: [{ value: 0, color: "#000000\n" }, { value: 100, color: "#FFFFFF" }] }).ok, false);
  const c = context(); c.palettes.eyes.brown = "#804020\n"; assert.equal(tints(appearance(), c.palettes).ok, false);
});
