const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const test = require("node:test");
const ts = require("typescript");
const React = require("react");
const { inspectPngBuffer } = require("../scripts/check-png-integrity");
const layered = require("../scripts/check-avatar-v5-proof");
const root = path.resolve(__dirname, "..");
const asset = path.join(root, "src/assets/avatar-v5/proofs/flattened-standard/fire-feast-avatar-v5-standard-master-1024.png");
const entry = path.join(root, "src/avatar-v5/proof/FlattenedStandardProof.tsx");
const cache = new Map(), imports = [];
function load(filename) {
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} }; cache.set(filename, module);
  const result = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    fileName: filename, reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
  });
  assert.equal(result.diagnostics.length, 0);
  new Function("require", "module", "exports", result.outputText)((id) => {
    imports.push([filename, id]);
    if (id === "react") return React;
    if (id === "react-native") return { View: "View", Image: "Image" };
    assert.ok(id.startsWith("."), `unexpected dependency: ${id}`);
    const target = path.resolve(path.dirname(filename), id);
    if (id.endsWith(".png")) { assert.equal(target, asset); return 101; }
    return load(fs.existsSync(target + ".tsx") ? target + ".tsx" : target + ".ts");
  }, module, module.exports);
  return module.exports;
}
const Wrapper = load(entry).default;
const fallback = React.createElement("Fallback");
function mount(size = 256) {
  const element = Wrapper({ size, fallback });
  const component = new element.type(element.props);
  component.setState = (update) => { component.state = { ...component.state, ...update(component.state, component.props) }; };
  return component;
}
const group = (component) => component.render().props.children[1];
const image = (component) => group(component).props.children[0];

test("approved PNG preserves canonical hash, CRC/decode, RGBA, dimensions and alpha bounds", () => {
  const bytes = fs.readFileSync(asset);
  assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), "2403c7fdc6952e47020c1beb87f5b1302be601b89a7eb0b3a06cb84d6ab918fa");
  const p = inspectPngBuffer(bytes);
  assert.deepEqual([p.width, p.height, p.bitDepth, p.colorType], [1024, 1024, 8, 6]);
  let left = 1024, top = 1024, right = 0, bottom = 0, transparent = 0;
  for (let y = 0; y < 1024; y++) for (let x = 0; x < 1024; x++) {
    if (p.decoded.data[(y * 1024 + x) * 4 + 3] === 0) transparent++;
    else { left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1); }
  }
  assert.ok(transparent > 0);
  assert.deepEqual([left, top, right, bottom], [126, 112, 897, 952]);
});
test("wrapper uses exactly one literal approved asset and stable immutable untinted plan", () => {
  const first = Wrapper({ size: 256, fallback }), second = Wrapper({ size: 128, fallback });
  assert.equal(first.props.plan, second.props.plan);
  assert.ok(Object.isFrozen(first.props.plan) && Object.isFrozen(first.props.plan.passes[0]));
  assert.equal(first.props.plan.passes.length, 1);
  assert.equal(first.props.plan.passes[0].source, 101);
  assert.equal(first.props.plan.passes[0].tintColor, undefined);
  assert.deepEqual(first.props.plan.selections, []);
  assert.equal(imports.filter(([, id]) => id.endsWith(".png")).length, 1);
});
test("real renderer places the single pass uniformly with no transform or tint", () => {
  for (const size of [128, 256, 512]) {
    const component = mount(size);
    assert.equal(group(component).props.children.length, 1);
    assert.deepEqual(image(component).props.style, [{ position: "absolute", left: 0, top: 0, width: size, height: size }, undefined]);
    assert.equal(image(component).props.resizeMode, "contain");
  }
});
test("fallback remains until image load completes", () => {
  const component = mount();
  assert.equal(component.render().props.children[0], fallback);
  assert.equal(group(component).props.style[1].opacity, 0);
  image(component).props.onLoad();
  assert.equal(component.render().props.children[0], null);
  assert.equal(group(component).props.style[1].opacity, 1);
});
test("image error latches complete fallback before or after load", () => {
  for (const loaded of [false, true]) {
    const component = mount(), callbacks = image(component).props;
    if (loaded) callbacks.onLoad();
    callbacks.onError(); callbacks.onLoad();
    assert.equal(component.render(), fallback);
  }
});
test("catalog stays empty; wrapper has only renderer/type/React/asset dependencies", () => {
  assert.deepEqual(load(path.join(root, "src/avatar-v5/registry.ts")).AVATAR_V5_CATALOG, {});
  const source = fs.readFileSync(entry, "utf8");
  assert.doesNotMatch(source, /buildAvatarV5RenderPlan|fetch\(|equipment|storage|gameplay/);
  assert.deepEqual(imports.filter(([file]) => file === entry).map(([, id]) => id), ["react", "../AvatarV5Renderer", "../../assets/avatar-v5/proofs/flattened-standard/fire-feast-avatar-v5-standard-master-1024.png"]);
});
test("production consumers and barrel do not import the flattened proof", () => {
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) { if (file !== path.join(root, "src/avatar-v5/proof")) visit(file); }
      else if (/\.[jt]sx?$/.test(entry.name)) assert.doesNotMatch(fs.readFileSync(file, "utf8"), /FlattenedStandardProof|flattened-standard/);
    }
  }
  visit(path.join(root, "src")); visit(path.join(root, "app"));
});
test("layered validator still requires its exact fourteen files and rejects flattened substitution", () => {
  assert.deepEqual(layered.NAMES, [
    "body_proof_standard_skin_fill.png", "body_proof_standard_skin_shading.png", "body_proof_standard_skin_highlight.png", "body_proof_standard_skin_detail.png",
    "body_proof_standard_modesty_detail.png", "face_proof_standard_features_detail.png",
    "hair_proof_standard_front_fill.png", "hair_proof_standard_front_shading.png", "hair_proof_standard_front_highlight.png", "hair_proof_standard_front_detail.png",
    "top_proof_standard_shirt_detail.png", "bottom_proof_standard_pants_detail.png", "shoes_proof_standard_sneakers_detail.png", "apron_proof_standard_front_detail.png",
  ]);
  assert.equal(layered.PROOF_DIRECTORY, path.join(root, "src/assets/avatar-v5/proofs/standard"));
  const errors = layered.validateInventory([path.basename(asset)]);
  assert.equal(errors.filter((message) => message.includes("missing required PNG")).length, 14);
  assert.ok(errors.some((message) => message.includes("unexpected PNG")));
});
