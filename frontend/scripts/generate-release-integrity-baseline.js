const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { inspectPngBuffer } = require("./check-png-integrity");
const { releaseIntegrityFiles } = require("./release-integrity-files");

const projectRoot = path.resolve(__dirname, "..");
const outputFile = path.join(projectRoot, "release-integrity-baseline.json");

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function readStable(relativePath) {
  const absolutePath = path.join(projectRoot, relativePath);
  const reads = [fs.readFileSync(absolutePath), fs.readFileSync(absolutePath), fs.readFileSync(absolutePath)];
  const hashes = reads.map(sha256);
  if (new Set(hashes).size !== 1) {
    throw new Error(`${relativePath}: inconsistent SHA-256 across repeated reads (${hashes.join(", ")})`);
  }
  if (relativePath.toLowerCase().endsWith(".png")) {
    for (const buffer of reads) inspectPngBuffer(buffer);
  }
  return { path: relativePath, size: reads[0].length, sha256: hashes[0] };
}

const files = releaseIntegrityFiles(projectRoot).map(readStable);
const baseline = {
  format: "fire-feast-release-integrity-v1",
  hash: "sha256",
  repeatedReads: 3,
  files,
};

fs.writeFileSync(outputFile, `${JSON.stringify(baseline, null, 2)}\n`, { encoding: "utf8", flag: "w" });
console.log(`Release-integrity baseline written: ${files.length} files -> ${path.basename(outputFile)}`);
