const fs = require("node:fs");
const path = require("node:path");
const { PNG } = require("pngjs");
const { inspectPngBuffer } = require("./check-png-integrity");

const PROOF_DIRECTORY = path.resolve(__dirname, "../src/assets/avatar-v5/proofs/standard");
// Inventory order is not paint order: clothing precedes face/hair in the V5 contract.
const NAMES = Object.freeze([
  "body_proof_standard_skin_fill.png",
  "body_proof_standard_skin_shading.png",
  "body_proof_standard_skin_highlight.png",
  "body_proof_standard_skin_detail.png",
  "body_proof_standard_modesty_detail.png",
  "face_proof_standard_features_detail.png",
  "hair_proof_standard_front_fill.png",
  "hair_proof_standard_front_shading.png",
  "hair_proof_standard_front_highlight.png",
  "hair_proof_standard_front_detail.png",
  "top_proof_standard_shirt_detail.png",
  "bottom_proof_standard_pants_detail.png",
  "shoes_proof_standard_sneakers_detail.png",
  "apron_proof_standard_front_detail.png",
]);
const PAINT_ORDER = Object.freeze([0, 1, 2, 3, 4, 11, 12, 10, 13, 5, 6, 7, 8, 9]);

function validateInventory(names) {
  const errors = [];
  const pngs = names.filter((name) => /\.png$/i.test(name)).sort();
  if (pngs.length !== 14) errors.push(`inventory: expected 14 PNG files, found ${pngs.length}`);
  for (const name of NAMES) if (!pngs.includes(name)) errors.push(`${name}: missing required PNG`);
  for (const name of pngs) if (!NAMES.includes(name)) errors.push(`${name}: unexpected PNG`);
  if (new Set(pngs).size !== pngs.length) errors.push("inventory: duplicate PNG names");
  return errors;
}

function inspectProof(buffer) {
  // Reject incorrect canvas dimensions before allocating/decompressing pixel data.
  if (buffer.length < 33 || !buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error("invalid PNG signature/header");
  if (buffer.toString("ascii", 12, 16) !== "IHDR" || buffer.readUInt32BE(8) !== 13) throw new Error("invalid IHDR");
  const width = buffer.readUInt32BE(16), height = buffer.readUInt32BE(20);
  if (width !== 1024 || height !== 1024) throw new Error(`expected 1024x1024, found ${width}x${height}`);
  if (buffer[24] !== 8 || buffer[25] !== 6) throw new Error(`expected 8-bit RGBA (PNG color type 6), found depth ${buffer[24]}, type ${buffer[25]}`);
  const { decoded } = inspectPngBuffer(buffer);
  if (decoded.data.length !== 1024 * 1024 * 4) throw new Error("decoded pixel length does not match canvas");
  let transparent = false, left = 1024, top = 1024, right = 0, bottom = 0;
  for (let y = 0; y < 1024; y++) for (let x = 0; x < 1024; x++) {
    const alpha = decoded.data[(y * 1024 + x) * 4 + 3];
    if (alpha === 0) transparent = true;
    if (alpha > 0) { left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1); }
  }
  if (!transparent) throw new Error("expected transparent background pixels (alpha 0)");
  if (!right) throw new Error("empty artwork: every pixel is transparent");
  return { decoded, bounds: [left, top, right, bottom] };
}

function readProof(directory = PROOF_DIRECTORY) {
  // Reject subdirectories/links so nested or redirected artwork cannot evade inventory.
  const entries = fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  for (const entry of entries) if (!entry.isFile()) throw new Error(`${entry.name}: expected regular files only`);
  const errors = validateInventory(entries.map((entry) => entry.name));
  if (errors.length) throw new Error(errors.join("\n"));
  return NAMES.map((name) => {
    try { return inspectProof(fs.readFileSync(path.join(directory, name))); }
    catch (error) { throw new Error(`${name}: ${error.message}`); }
  });
}

function color(value) {
  if (!/^#[0-9a-f]{6}$/i.test(value ?? "")) throw new Error("composition requires explicit skin and hair colors as #RRGGBB");
  return [1, 3, 5].map((offset) => parseInt(value.slice(offset, offset + 2), 16));
}
// Straight-alpha source-over in encoded RGB; visual aid, not a native-renderer oracle.
function blendPixel(target, offset, source, tint) {
  const sa = source[offset + 3] / 255, da = target[offset + 3] / 255;
  const alpha = sa + da * (1 - sa);
  if (!alpha) return;
  for (let channel = 0; channel < 3; channel++) target[offset + channel] = Math.round(((tint ? tint[channel] : source[offset + channel]) * sa + target[offset + channel] * da * (1 - sa)) / alpha);
  target[offset + 3] = Math.round(alpha * 255);
}
function compose(proof, skin, hair) {
  const skinColor = color(skin), hairColor = color(hair);
  if (proof.length !== 14) throw new Error("composition requires 14 validated passes");
  const png = new PNG({ width: 1024, height: 1024 });
  png.data.fill(0);
  for (const index of PAINT_ORDER) {
    const data = proof[index].decoded.data;
    if (data.length !== png.data.length) throw new Error("composition canvas mismatch");
    const tint = index === 0 ? skinColor : index === 6 ? hairColor : undefined;
    for (let offset = 0; offset < data.length; offset += 4) blendPixel(png.data, offset, data, tint);
  }
  return PNG.sync.write(png, { colorType: 6 });
}

function main(args) {
  if (args.length !== 0 && !(args.length === 4 && args[0] === "--compose")) throw new Error("usage: node scripts/check-avatar-v5-proof.js [--compose NEW_OUTPUT.png '#RRGGBB' '#RRGGBB']");
  let output;
  if (args.length) {
    color(args[2]); color(args[3]);
    output = path.resolve(args[1]);
    const relative = path.relative(PROOF_DIRECTORY, output);
    if (!relative || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))) throw new Error("composition output must be outside the proof directory");
    if (path.extname(output).toLowerCase() !== ".png") throw new Error("composition output must end in .png");
    if (fs.existsSync(output)) throw new Error("composition output already exists; refusing overwrite");
  }
  const proof = readProof();
  for (let i = 0; i < NAMES.length; i++) console.log(`${NAMES[i]}: PASS 1024x1024 RGBA; alpha bounds [${proof[i].bounds.join(", ")})`);
  if (output) fs.writeFileSync(output, compose(proof, args[2], args[3]), { flag: "wx" });
  console.log(`PASS: 14/14 proof PNGs validated${output ? "; comparison composite created" : ""}.`);
}
if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(`HOLD: ${error.message}`); process.exitCode = 1; }
}
module.exports = { NAMES, PAINT_ORDER, PROOF_DIRECTORY, validateInventory, inspectProof, readProof, blendPixel, compose, main };
