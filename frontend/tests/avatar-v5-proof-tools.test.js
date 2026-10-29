const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");
const { PNG } = require("pngjs");
const tool = require("../scripts/check-avatar-v5-proof");
// Synthetic pixels only, in memory; never write placeholder artwork into the repository.
function fixture(width = 1024, height = 1024, opaque = false, colorType = 6) {
  const png = new PNG({ width, height });
  png.data.fill(opaque ? 255 : 0);
  png.data.set([255, 100, 50, 255], 0);
  return PNG.sync.write(png, { colorType, inputHasAlpha: true });
}
const valid = fixture();

test("exact 14-name inventory accepts documentation but rejects missing/extra/case variants", () => {
  assert.equal(tool.NAMES.length, 14);
  assert.deepEqual(tool.validateInventory([...tool.NAMES, "README.md"]), []);
  assert.match(tool.validateInventory([]).join("\n"), /expected 14 PNG files, found 0/);
  const changed = [...tool.NAMES.slice(1), tool.NAMES[0].toUpperCase()];
  assert.match(tool.validateInventory(changed).join("\n"), /missing required PNG/);
  assert.match(tool.validateInventory(changed).join("\n"), /unexpected PNG/);
  assert.match(tool.validateInventory([...tool.NAMES, "nested/extra.PNG"]).join("\n"), /unexpected PNG/);
  assert.deepEqual(tool.validateInventory(changed), tool.validateInventory([...changed].reverse()));
});
test("valid RGBA canvas decodes and reports half-open alpha bounds without enforcing preliminary guides", () => {
  const result = tool.inspectProof(valid);
  assert.deepEqual(result.bounds, [0, 0, 1, 1]);
  assert.equal(result.decoded.data.length, 1024 * 1024 * 4);
});
test("wrong dimensions and RGB-only files are rejected", () => {
  assert.throws(() => tool.inspectProof(fixture(16, 16)), /expected 1024x1024, found 16x16/);
  assert.throws(() => tool.inspectProof(fixture(1024, 1024, false, 2)), /expected 8-bit RGBA/);
});
test("opaque and empty artwork cannot pass the transparency/content checks", () => {
  assert.throws(() => tool.inspectProof(fixture(1024, 1024, true)), /transparent background/);
  const empty = new PNG({ width: 1024, height: 1024 }); empty.data.fill(0);
  assert.throws(() => tool.inspectProof(PNG.sync.write(empty)), /empty artwork/);
});
test("deliberately damaged in-memory PNG fixtures fail signature, CRC and truncation validation", () => {
  assert.throws(() => tool.inspectProof(Buffer.from("not PNG")), /invalid PNG/);
  const damaged = Buffer.from(valid); damaged[damaged.length - 1] ^= 1;
  assert.throws(() => tool.inspectProof(damaged), /IEND CRC mismatch/);
  assert.throws(() => tool.inspectProof(valid.subarray(0, -3)), /truncated/);
});
test("source-over preserves alpha and only explicitly supplied tint replaces source RGB", () => {
  const target = Buffer.from([0, 0, 255, 255]);
  tool.blendPixel(target, 0, Buffer.from([255, 0, 0, 128]));
  assert.deepEqual([...target], [128, 0, 127, 255]);
  tool.blendPixel(target, 0, Buffer.from([9, 9, 9, 255]), [10, 20, 30]);
  assert.deepEqual([...target], [10, 20, 30, 255]);
});
test("paint order agrees with the actual committed V5 layer/pass sorting contract", () => {
  const filename = path.resolve(__dirname, "../src/avatar-v5/layers.ts");
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function("exports", code)(module.exports);
  const layers = ["bodySkin", "bodySkin", "bodySkin", "bodySkin", "modestyUnderlayer", "facialFeatures", "frontHair", "frontHair", "frontHair", "frontHair", "topsSleeves", "bottoms", "shoes", "apronFront"];
  const treatments = ["fill", "shading", "highlight", "detail"];
  const parts = new Map();
  layers.forEach((layer, index) => {
    if (!parts.has(layer)) parts.set(layer, { id: layer, layer, passes: [] });
    parts.get(layer).passes.push({ id: tool.NAMES[index], index, treatment: index < 4 ? treatments[index] : index >= 6 && index <= 9 ? treatments[index - 6] : "detail" });
  });
  const order = module.exports.sortAvatarV5Parts([...parts.values()]).flatMap((part) => module.exports.sortAvatarV5Passes(part.passes).map((p) => p.index));
  assert.deepEqual(tool.PAINT_ORDER, order);
});
test("compositor emits a readable full-canvas PNG with explicit fill tints and untinted detail", () => {
  const proof = tool.NAMES.map(() => ({ decoded: { data: Buffer.alloc(1024 * 1024 * 4) } }));
  proof[0].decoded.data.set([255, 255, 255, 255], 0);
  proof[6].decoded.data.set([255, 255, 255, 255], 4);
  proof[9].decoded.data.set([42, 43, 44, 255], 8);
  const decoded = PNG.sync.read(tool.compose(proof, "#123456", "#654321"));
  assert.equal(decoded.width, 1024); assert.equal(decoded.height, 1024);
  assert.deepEqual([...decoded.data.subarray(0, 12)], [18, 52, 86, 255, 101, 67, 33, 255, 42, 43, 44, 255]);
  assert.throws(() => tool.compose(proof), /explicit skin and hair/);
});
test("CLI rejects unknown arguments, existing output and output inside asset intake before writing", () => {
  assert.throws(() => tool.main(["--unknown"]), /usage:/);
  assert.throws(() => tool.main(["--compose", path.join(tool.PROOF_DIRECTORY, "new.png"), "#123456", "#654321"]), /outside the proof directory/);
  assert.throws(() => tool.main(["--compose", path.resolve(__dirname, "../src/assets/icons/coin.png"), "#123456", "#654321"]), /already exists/);
});
test("README specifies the exact inventory and master identity without registering assets", () => {
  const readme = fs.readFileSync(path.join(tool.PROOF_DIRECTORY, "README.md"), "utf8");
  for (const name of tool.NAMES) assert.ok(readme.includes(name));
  assert.ok(readme.includes("2403C7FDC6952E47020C1BEB87F5B1302BE601B89A7EB0B3A06CB84D6AB918FA"));
  assert.ok(readme.includes("plain white tank top and plain white fitted shorts"));
});
