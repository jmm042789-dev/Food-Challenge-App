const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");
const React = require("react");
const root = path.resolve(__dirname, "..");
const host = path.join(root, "tools/avatar-v5-preview");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
function harness() {
  const state = [], imports = []; let cursor = 0;
  const react = { ...React, useState(initial) {
    const i = cursor++; if (!(i in state)) state[i] = initial;
    return [state[i], (next) => { state[i] = typeof next === "function" ? next(state[i]) : next; }];
  } };
  function Proof() {}
  const module = { exports: {} };
  const code = ts.transpileModule(read("tools/avatar-v5-preview/Preview.tsx"), {
    fileName: "Preview.tsx", reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  });
  assert.equal(code.diagnostics.length, 0);
  new Function("require", "module", "exports", code.outputText)((id) => {
    imports.push(id);
    if (id === "react") return react;
    if (id === "react-native") return { Pressable: "Pressable", ScrollView: "ScrollView", Text: "Text", View: "View" };
    assert.equal(id, "../../src/avatar-v5/proof/FlattenedStandardProof");
    return { __esModule: true, default: Proof };
  }, module, module.exports);
  function render() { cursor = 0; return module.exports.default(); }
  function nodes(element) {
    if (!element || typeof element !== "object") return [];
    return [element, ...React.Children.toArray(element.props?.children).flatMap(nodes)];
  }
  return { state, imports, Proof, render, nodes, sizes: module.exports.PREVIEW_SIZES };
}
test("preview delegates rendering and asset ownership exclusively to the existing proof", () => {
  const h = harness(), nodes = h.nodes(h.render());
  assert.equal(nodes.filter((n) => n.type === h.Proof).length, 1);
  assert.deepEqual(h.imports, ["react", "react-native", "../../src/avatar-v5/proof/FlattenedStandardProof"]);
  assert.doesNotMatch(read("tools/avatar-v5-preview/Preview.tsx"), /\.png|AvatarV5Renderer|buildAvatarV5RenderPlan|\bImage\b|tintColor|transform|resizeMode/);
});
test("sizes and backgrounds change presentation only; remount changes only the proof key", () => {
  const h = harness();
  const button = (label) => h.nodes(h.render()).find((n) => n.type === "Pressable" && n.props.accessibilityLabel === label);
  const proof = () => h.nodes(h.render()).find((n) => n.type === h.Proof);
  const originalKey = proof().key;
  assert.deepEqual(h.sizes, [128, 192, 256]);
  for (const size of h.sizes) {
    button(`Preview size ${size}`).props.onPress();
    const p = proof(), panel = p.props.fallback;
    assert.equal(p.props.size, size); assert.equal(p.key, originalKey);
    assert.equal(panel.props.style.width, size); assert.equal(panel.props.style.height, size);
    assert.ok(h.nodes(h.render()).some((n) => n.type === "View" && n.props.style.width === size && n.props.style.height === size));
    assert.deepEqual(h.state, [size, false, 0]);
  }
  button("Dark preview background").props.onPress();
  assert.deepEqual(h.state, [256, true, 0]);
  assert.equal(h.render().props.style.backgroundColor, "#171717");
  button("Light preview background").props.onPress();
  assert.deepEqual(h.state, [256, false, 0]);
  assert.equal(h.render().props.style.backgroundColor, "#ffffff");
  button("Remount avatar proof").props.onPress();
  assert.notEqual(proof().key, originalKey); assert.deepEqual(h.state, [256, false, 1]);
});
test("complete fallback and accessible controls are always supplied", () => {
  const h = harness(), nodes = h.nodes(h.render());
  const controls = nodes.filter((n) => n.type === "Pressable");
  assert.equal(controls.length, 6);
  for (const n of controls) { assert.equal(n.props.accessibilityRole, "button"); assert.ok(n.props.accessibilityLabel); }
  assert.equal(controls.filter((n) => n.props.accessibilityState?.selected).length, 2);
  const panel = nodes.find((n) => n.type === h.Proof).props.fallback;
  assert.equal(panel.props.accessible, true); assert.match(panel.props.accessibilityLabel, /unavailable or loading/);
  assert.ok(panel.props.style.backgroundColor); assert.ok(panel.props.children.props.children);
});
test("standalone entry and config reuse installed modules without production routing", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(host, "package.json")));
  assert.equal(pkg.private, true); assert.equal(pkg.main, "index.js");
  assert.equal(pkg.dependencies, undefined); assert.equal(pkg.devDependencies, undefined);
  const entry = fs.readFileSync(path.join(host, "index.js"), "utf8");
  assert.match(entry, /registerRootComponent\(Preview\)/); assert.doesNotMatch(entry, /expo-router/);
  const preview = JSON.parse(fs.readFileSync(path.join(host, "app.json"))).expo;
  const production = JSON.parse(read("app.json")).expo;
  assert.notEqual(preview.slug, production.slug);
  assert.notEqual(preview.android.package, production.android.package);
  assert.notEqual(preview.ios.bundleIdentifier, production.ios?.bundleIdentifier);
  assert.equal(JSON.parse(read("package.json")).main, "expo-router/entry");
  const metro = fs.readFileSync(path.join(host, "metro.config.js"), "utf8");
  assert.match(metro, /disableHierarchicalLookup = true/); assert.match(metro, /nodeModulesPaths/);
});
test("production consumers remain disconnected and layered proof remains truthful", () => {
  function visit(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) visit(p);
      else if (/\.[jt]sx?$/.test(e.name)) assert.doesNotMatch(fs.readFileSync(p, "utf8"), /tools\/avatar-v5-preview|tools\\avatar-v5-preview/);
    }
  }
  visit(path.join(root, "app")); visit(path.join(root, "src"));
  assert.match(read("src/avatar-v5/registry.ts"), /AVATAR_V5_CATALOG[^=]*= Object\.freeze\(\{\}\)/);
  assert.equal(require("../scripts/check-avatar-v5-proof").NAMES.length, 14);
  const doc = fs.readFileSync(path.join(host, "README.md"), "utf8");
  assert.match(doc, /does not\s+establish 14-pass/); assert.match(doc, /Physical-device acceptance is PENDING/);
});

test("production configuration, renderer and layered validator retain the approved baseline", () => {
  const crypto = require("node:crypto");
  const hashes = {
  "package.json": "c0eff0502be14c3b3c503c1ff8e0750ae62d7c90ced2947bdca20d9a79e0a18a",
  "package-lock.json": "3ee6a2528c1a56d96c9ae6861a186b60cb8d37e47708995aa52c0907fd15b002",
  "app.json": "4a4b66faa7ee86eeff774f9302c853ebd946706e8a7817c00232e926725b876e",
  "app.config.js": "1926bf8de665fe106c5ebaa042590696b66635a14bc792dd54f07d81ee84e5c8",
  "metro.config.js": "47080ee41b1e4cc3e925ef6cd85939d5d9c47faa254a51fdbb2d3ca271719e73",
  "src/avatar-v5/registry.ts": "269eb9672eef89ed0c87da70dbeed74937c30e78f41bb2fc9b72b5b8f94f1319",
  "scripts/check-avatar-v5-proof.js": "f840a9bc3a31ede5f0d0f58d3bd1051cdf2df7b435c43af8b373f6b41e94940c",
  "src/avatar-v5/AvatarV5Renderer.tsx": "7151311d0fb439867b2c7de1d10122d836a491fda31778be90ef34b867f227ab",
  "src/avatar-v5/proof/FlattenedStandardProof.tsx": "4d660d67b4a7f1e6322d3bb3f1d64feea57913176b70a33ecd9a5b7044644048"
};
  for (const [file, expected] of Object.entries(hashes)) assert.equal(crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex"), expected, file);
});
