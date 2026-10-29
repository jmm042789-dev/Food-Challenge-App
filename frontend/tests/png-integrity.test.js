const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { PNG } = require("pngjs");

const { auditPngFiles, inspectPngBuffer } = require("../scripts/check-png-integrity");

function validPng() {
  const png = new PNG({ width: 2, height: 2 });
  png.data.set([
    255, 0, 0, 255, 0, 255, 0, 128,
    0, 0, 255, 64, 255, 255, 255, 0,
  ]);
  return PNG.sync.write(png, { colorType: 6 });
}

test("integrity parser validates chunks, IDAT decompression, and decoded pixels", () => {
  const inspected = inspectPngBuffer(validPng());
  assert.equal(inspected.width, 2);
  assert.equal(inspected.height, 2);
  assert.deepEqual(inspected.chunks, ["IHDR", "IDAT", "IEND"]);
  assert.equal(inspected.decoded.data.length, 16);
});

test("integrity parser rejects CRC damage, truncation, and broken IDAT data", () => {
  const crcDamage = validPng();
  crcDamage[crcDamage.length - 1] ^= 0xff;
  assert.throws(() => inspectPngBuffer(crcDamage), /IEND CRC mismatch/);

  const truncated = validPng().subarray(0, -3);
  assert.throws(() => inspectPngBuffer(truncated), /truncated (?:PNG chunk header|IEND chunk)/);

  const idatDamage = validPng();
  const idatOffset = idatDamage.indexOf(Buffer.from("IDAT"));
  idatDamage[idatOffset + 5] ^= 0xff;
  assert.throws(() => inspectPngBuffer(idatDamage), /IDAT CRC mismatch/);
});

test("production/config PNG assets pass the permanent integrity guard", () => {
  const projectRoot = path.resolve(__dirname, "..");
  const roots = [path.join(projectRoot, "src", "assets"), path.join(projectRoot, "assets")];
  const { findPngs } = require("../scripts/check-png-integrity");
  const result = auditPngFiles(roots.flatMap(findPngs), projectRoot);
  assert.deepEqual(result.failures, []);
  assert.ok(result.scanned > 0);
});
