/* global __dirname */
const fs = require("node:fs");
const path = require("node:path");
const { PNG } = require("pngjs");

const root = path.join(__dirname, "../src/assets/daily-rewards");
const files = [
  "wheel/charcuterie-wheel.png",
  "pointer/chef-knife-pointer.png",
  "hub/fire-feast-hub.png",
  "decorations/grapes-top-left.png",
  "decorations/salami-top-right.png",
  "decorations/olives-bottom-left.png",
  "decorations/cheese-bottom-right.png",
  "effects/winner-glow.png",
  "background/restaurant-table.png",
];

function inspect(relativePath) {
  const png = PNG.sync.read(fs.readFileSync(path.join(root, relativePath)));
  let transparent = 0;
  let partial = 0;
  let minX = png.width;
  let minY = png.height;
  let maxX = -1;
  let maxY = -1;
  const edgeColors = new Map();
  const thresholdBounds = [1, 16, 64, 128, 192, 250].map((threshold) => ({ threshold, minX: png.width, minY: png.height, maxX: -1, maxY: -1 }));
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const offset = (y * png.width + x) * 4;
      const alpha = png.data[offset + 3];
      for (const thresholdBound of thresholdBounds) {
        if (alpha >= thresholdBound.threshold) {
          thresholdBound.minX = Math.min(thresholdBound.minX, x);
          thresholdBound.minY = Math.min(thresholdBound.minY, y);
          thresholdBound.maxX = Math.max(thresholdBound.maxX, x);
          thresholdBound.maxY = Math.max(thresholdBound.maxY, y);
        }
      }
      if (alpha === 0) transparent += 1;
      else {
        if (alpha < 255) partial += 1;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
      if (x === 0 || y === 0 || x === png.width - 1 || y === png.height - 1) {
        const key = `${png.data[offset]},${png.data[offset + 1]},${png.data[offset + 2]},${alpha}`;
        edgeColors.set(key, (edgeColors.get(key) ?? 0) + 1);
      }
    }
  }
  const total = png.width * png.height;
  const bounds = maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  const padding = bounds ? { left: minX, right: png.width - 1 - maxX, top: minY, bottom: png.height - 1 - maxY } : null;
  const contentCenter = bounds ? { x: (minX + maxX) / 2, y: (minY + maxY) / 2 } : null;
  const canvasCenter = { x: (png.width - 1) / 2, y: (png.height - 1) / 2 };
  const alphaOneBounds = thresholdBounds[0];
  const alphaHalfBounds = thresholdBounds[3];
  const alphaOneArea = alphaOneBounds.maxX < 0 ? 0 : (alphaOneBounds.maxX - alphaOneBounds.minX + 1) * (alphaOneBounds.maxY - alphaOneBounds.minY + 1);
  const alphaHalfArea = alphaHalfBounds.maxX < 0 ? 0 : (alphaHalfBounds.maxX - alphaHalfBounds.minX + 1) * (alphaHalfBounds.maxY - alphaHalfBounds.minY + 1);
  const hasAlphaChannel = png.alpha;
  const hasRealTransparency = hasAlphaChannel && transparent > 0;
  const hasDiffuseRectangularBackdrop = hasRealTransparency && alphaHalfArea > 0 && alphaOneArea / alphaHalfArea > 1.5;
  return {
    file: relativePath,
    dimensions: `${png.width}x${png.height}`,
    colorMode: png.colorType === 6 ? "RGBA" : png.colorType === 4 ? "grayscale+alpha" : png.colorType === 2 ? "RGB" : `PNG color type ${png.colorType}`,
    alphaChannel: hasAlphaChannel,
    hasRealTransparency,
    fullyTransparentPercent: Number((transparent / total * 100).toFixed(4)),
    partiallyTransparentPercent: Number((partial / total * 100).toFixed(4)),
    bounds,
    padding,
    symmetricPadding: padding ? padding.left === padding.right && padding.top === padding.bottom : false,
    canvasCenter,
    contentCenter,
    centerCorrection: contentCenter ? { x: Number((canvasCenter.x - contentCenter.x).toFixed(2)), y: Number((canvasCenter.y - contentCenter.y).toFixed(2)) } : null,
    dominantEdgeColors: [...edgeColors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([rgba, count]) => ({ rgba, count })),
    alphaThresholdBounds: thresholdBounds.map(({ threshold, minX: x, minY: y, maxX, maxY }) => ({
      threshold,
      bounds: maxX < 0 ? null : { x, y, width: maxX - x + 1, height: maxY - y + 1 },
    })),
    bakedBackground: !hasAlphaChannel
      ? (relativePath.includes("hub/") ? "black" : relativePath.includes("decorations/") ? "white/gray" : relativePath.includes("background/") ? "brown (allowed table)" : "opaque")
      : hasDiffuseRectangularBackdrop ? "diffuse gray/brown rectangular backdrop" : "none detected",
    validTransparentArtwork: hasRealTransparency && !hasDiffuseRectangularBackdrop,
  };
}

if (require.main === module) {
  for (const file of files) console.log(JSON.stringify(inspect(file)));
}

module.exports = { files, inspect };
