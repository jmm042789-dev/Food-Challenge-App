/* global __dirname */
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { PNG } = require("pngjs");

const root = path.join(__dirname, "../src/assets/daily-rewards");
const files = [
  "wheel/charcuterie-wheel.png",
  "pointer/chef-knife-pointer.png",
  "hub/fire-feast-hub.png",
  "decorations/grapes-top-left.png",
  "decorations/cheese-bottom-right.png",
  "effects/winner-glow.png",
];

function hash(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function integerShift(canvasCenter, contentCenter) {
  const delta = canvasCenter - contentCenter;
  return Math.abs(delta) <= 0.5 ? 0 : Math.round(delta);
}

function alphaBounds(png) {
  let minX = png.width;
  let minY = png.height;
  let maxX = -1;
  let maxY = -1;
  let visiblePixels = 0;

  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      if (png.data[(y * png.width + x) * 4 + 3] === 0) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      visiblePixels += 1;
    }
  }

  if (maxX < 0) throw new Error("Artwork contains no visible pixels");
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
    visiblePixels,
  };
}

for (const relativePath of files) {
  const filePath = path.join(root, relativePath);
  const originalBuffer = fs.readFileSync(filePath);
  const source = PNG.sync.read(originalBuffer);
  if (!source.alpha || source.colorType !== 6) {
    throw new Error(`${relativePath} must be an RGBA PNG`);
  }

  const before = alphaBounds(source);
  const shift = {
    x: integerShift((source.width - 1) / 2, before.center.x),
    y: integerShift((source.height - 1) / 2, before.center.y),
  };
  const output = new PNG({ width: source.width, height: source.height, colorType: 6 });
  output.data.fill(0);

  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const sourceOffset = (y * source.width + x) * 4;
      const targetX = x + shift.x;
      const targetY = y + shift.y;
      if (targetX < 0 || targetX >= source.width || targetY < 0 || targetY >= source.height) {
        if (source.data[sourceOffset + 3] !== 0) {
          throw new Error(`${relativePath} translation would clip visible pixel (${x}, ${y})`);
        }
        continue;
      }
      const targetOffset = (targetY * source.width + targetX) * 4;
      source.data.copy(output.data, targetOffset, sourceOffset, sourceOffset + 4);
    }
  }

  const after = alphaBounds(output);
  if (after.visiblePixels !== before.visiblePixels) {
    throw new Error(`${relativePath} visible pixel count changed`);
  }
  const encoded = PNG.sync.write(output, { colorType: 6 });
  fs.writeFileSync(filePath, encoded);
  console.log(JSON.stringify({
    file: relativePath,
    dimensions: `${source.width}x${source.height}`,
    shift,
    before,
    after,
    clippedVisiblePixels: 0,
    originalSha256: hash(originalBuffer),
    finalSha256: hash(encoded),
  }));
}
