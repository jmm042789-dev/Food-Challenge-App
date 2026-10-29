const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const geometry = require("../src/profile/avatarGeometry.ts");
const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("normalized anchors place face wearables on semantic anatomy", () => {
  const { AVATAR_ANCHORS: a } = geometry;
  assert.equal(a.eyes.x, a.head_center.x);
  assert.ok(a.eyes.y < a.mouth.y && a.mouth.y < a.jaw.y);
  assert.ok(a.left_ear.x < a.head_center.x && a.right_ear.x > a.head_center.x);
  assert.ok(a.neck.y < a.chest.y && a.chest.y < a.waist.y);
  assert.notEqual(a.neck.y, a.left_shoulder.y);
});

test("anchor scaling and render modes are deterministic", () => {
  assert.deepEqual(geometry.scaledAnchor("eyes", 264), { x: 132, y: 108 });
  assert.equal(geometry.renderModeForSize(42), "compact");
  assert.equal(geometry.renderModeForSize(88), "medium");
  assert.equal(geometry.renderModeForSize(176), "detailed");
  assert.deepEqual([...geometry.AVATAR_LAYER_ORDER].slice(2, 6), ["outfit", "neck", "ears", "head"]);
  assert.ok(geometry.AVATAR_LAYER_ORDER.indexOf("outfit") < geometry.AVATAR_LAYER_ORDER.indexOf("apron"));
});

test("renderer anchors gear and cosmetics instead of generic shoulder offsets", () => {
  const renderer = read("src/profile/AvatarRenderer.tsx");
  assert.match(renderer, /anchoredBox\("left_ear"/);
  assert.match(renderer, /styles\.glasses/);
  assert.match(renderer, /styles\.necklace/);
  assert.match(renderer, /effectiveApron/);
  assert.match(renderer, /equippedGearSlots\?\.hat \? "none" : avatar\.headwear/);
  assert.doesNotMatch(renderer, /top: "31%"|right: "20%"|bottom: "5%"/);
});

test("schema v4 provides meaningful option counts and migrates missing apron safely", () => {
  const model = read("src/profile/PlayerIdentity.ts");
  assert.match(model, /version: 4/);
  assert.match(model, /LEGACY_ACCESSORY_APRON/);
  for (const category of ["hair", "eyes", "facialHair", "glasses", "headwear", "clothing", "apron", "accessory", "background"]) assert.match(model, new RegExp(`${category}: \\[`));
  assert.match(model, /ponytail:Power Ponytail/);
  assert.match(model, /full_beard:Full Beard/);
});

test("tester tribute gear has three coordinated explicit palettes", () => {
  const renderer = read("src/profile/AvatarRenderer.tsx");
  for (const set of ["shannon", "lynette", "brittany"]) assert.match(renderer, new RegExp(`${set}: \\{ primary:`));
  assert.match(renderer, /gearPalette\(equippedGearSlots\?\.outfit/);
  assert.match(renderer, /gearPalette\(equippedGearSlots\?\.apron/);
  assert.match(renderer, /gearPalette\(equippedGearSlots\?\.hat/);
});

test("Avatar Creator exposes apron and bounded draft-only live preview", () => {
  const screen = read("app/avatar-customization.tsx");
  assert.match(screen, /key: "apron", label: "APRON STYLE"/);
  assert.match(screen, /LIVE ARENA PREVIEW/);
  assert.match(screen, /version: 4/);
  assert.doesNotMatch(screen, /saveIdentity[^\n]+onResponderMove/);
});
