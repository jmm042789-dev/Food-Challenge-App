const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");
const React = require("react");
const cache = new Map();
function load(name, extension = ".ts") {
  if (cache.has(name)) return cache.get(name).exports;
  const module = { exports: {} }; cache.set(name, module);
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, "../src/avatar-v5", name + extension), "utf8"), {
    fileName: name + extension,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  new Function("require", "module", "exports", code)((id) => {
    if (id === "react") return React;
    if (id === "react-native") return { View: "View", Image: "Image" };
    assert.ok(id.startsWith("./")); return load(id.slice(2));
  }, module, module.exports);
  return module.exports;
}
const { createAvatarV5RenderState: create, advanceAvatarV5RenderState: advance } = load("renderState");
const Renderer = load("AvatarV5Renderer", ".tsx").default;
const fallback = React.createElement("Fallback");
const plan = () => ({ status: "ready", mode: "FULL_BODY", selections: [], passes: [
  { key: "body", itemId: "body", partId: "skin", passId: "fill", layer: "bodySkin", treatment: "fill", source: 1, tintColor: "#123456" },
  { key: "modesty", itemId: "body", partId: "modesty", passId: "fill", layer: "modestyUnderlayer", treatment: "fill", source: 2 },
] });
// Exercise the real component and event closures, with synchronous class state updates.
// Native decoding/compositing still requires later device validation with approved art.
function mount(value = plan(), size = 256) {
  const component = new Renderer({ plan: value, fallback, size });
  component.setState = (update) => {
    const patch = typeof update === "function" ? update(component.state, component.props) : update;
    component.state = { ...component.state, ...patch };
  };
  return component;
}
function update(component, next) {
  component.props = { ...component.props, ...next };
  component.state = Renderer.getDerivedStateFromProps(component.props, component.state) ?? component.state;
}
const composition = (component) => component.render().props.children[1];
const images = (component) => composition(component).props.children;

test("loading state requires all passes; duplicate and unknown loads cannot reveal it", () => {
  let state = create(3, ["skin", "modesty"]);
  state = advance(state, { generation: 3, key: "unknown", type: "loaded" }); assert.equal(state.status, "loading");
  state = advance(state, { generation: 3, key: "skin", type: "loaded" }); assert.equal(state.status, "loading");
  state = advance(state, { generation: 3, key: "skin", type: "loaded" }); assert.equal(state.status, "loading");
  state = advance(state, { generation: 3, key: "modesty", type: "loaded" }); assert.equal(state.status, "ready");
  assert.equal(create(4, []).status, "fallback");
});
test("renderer retains fallback and hides visual/accessibility tree until every pass loads", () => {
  const component = mount(); const callbacks = images(component);
  assert.equal(component.render().props.children[0], fallback);
  assert.equal(composition(component).props.style[1].opacity, 0);
  assert.equal(composition(component).props.accessibilityElementsHidden, true);
  callbacks[0].props.onLoad(); assert.equal(composition(component).props.style[1].opacity, 0);
  callbacks[1].props.onLoad(); assert.equal(component.render().props.children[0], null);
  assert.equal(composition(component).props.style[1].opacity, 1);
  assert.equal(composition(component).props.accessibilityElementsHidden, false);
});
test("image/decode error latches complete fallback before or after successful loading", () => {
  for (const readyFirst of [false, true]) {
    const component = mount(); const callbacks = images(component);
    if (readyFirst) callbacks.forEach((image) => image.props.onLoad());
    callbacks[0].props.onError(); assert.equal(component.render(), fallback);
    callbacks.forEach((image) => image.props.onLoad()); assert.equal(component.render(), fallback);
    update(component, { size: 128 }); assert.equal(component.render(), fallback);
  }
});
test("new composition generation resets loading and rejects stale success/error callbacks", () => {
  const component = mount(); const old = images(component);
  old.forEach((image) => image.props.onLoad());
  update(component, { plan: plan() }); assert.equal(component.state.images.generation, 1);
  const current = images(component); assert.notEqual(old[0].key, current[0].key);
  old.forEach((image) => image.props.onLoad()); old[0].props.onError();
  assert.equal(component.state.images.status, "loading");
  current.forEach((image) => image.props.onLoad()); assert.equal(component.state.images.status, "ready");
  update(component, { plan: { status: "fallback", reasons: ["missing-art"], selections: [] } });
  assert.equal(component.render(), fallback);
  update(component, { plan: plan() }); assert.equal(component.state.images.generation, 3);
  current[0].props.onError(); assert.equal(component.state.images.status, "loading");
});
test("same immutable plan and display size changes do not restart composition", () => {
  const component = mount(); images(component).forEach((image) => image.props.onLoad());
  update(component, { size: 512 }); assert.equal(component.state.images.generation, 0); assert.equal(component.state.images.status, "ready");
});
test("all layers occupy identical full-body rectangle without per-item transforms", () => {
  for (const size of [128, 256, 512]) {
    const component = mount(plan(), size);
    for (const image of images(component)) {
      assert.deepEqual(image.props.style[0], { position: "absolute", left: 0, top: 0, width: size, height: size });
      assert.equal(image.props.resizeMode, "contain"); assert.equal(image.props.fadeDuration, 0);
    }
    assert.deepEqual(images(component)[0].props.style[1], { tintColor: "#123456" });
    assert.equal(images(component)[1].props.style[1], undefined);
  }
});
test("explicit fallback plans, empty plans and invalid display sizes never mount artwork", () => {
  assert.equal(mount({ status: "fallback", reasons: ["missing-required:body"], selections: [] }).render(), fallback);
  assert.equal(mount({ ...plan(), passes: [] }).render(), fallback);
  for (const size of [0, -1, NaN, Infinity]) assert.equal(mount(plan(), size).render(), fallback);
});
test("V4 production consumers and pure barrel remain isolated; catalog has no artwork", () => {
  const root = path.resolve(__dirname, "..");
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) { if (entry.name !== "avatar-v5") visit(filename); }
      else if (/\.[jt]sx?$/.test(entry.name)) assert.doesNotMatch(fs.readFileSync(filename, "utf8"), /(?:from\s*|require\(\s*|import\(\s*)["'][^"']*avatar-v5/, filename);
    }
  }
  visit(path.join(root, "src")); visit(path.join(root, "app"));
  assert.doesNotMatch(fs.readFileSync(path.join(root, "src/avatar-v5/index.ts"), "utf8"), /Renderer|renderPlan|renderState/);
  assert.deepEqual(load("registry").AVATAR_V5_CATALOG, {});
  for (const name of ["renderPlan.ts", "renderState.ts", "AvatarV5Renderer.tsx"]) {
    const source = fs.readFileSync(path.join(root, "src/avatar-v5", name), "utf8");
    assert.doesNotMatch(source, /from ["'][^"']*(?:profile\/|game\/|storage|network|backend)/);
    assert.doesNotMatch(source, /fetch\(|setTimeout\(|setInterval\(/);
  }
});
