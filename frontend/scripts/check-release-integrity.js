const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { inspectPngBuffer } = require("./check-png-integrity");
const { releaseIntegrityFiles } = require("./release-integrity-files");

const projectRoot = path.resolve(__dirname, "..");
const baselineFile = path.join(projectRoot, "release-integrity-baseline.json");

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

let baseline;
try {
  baseline = JSON.parse(fs.readFileSync(baselineFile, "utf8"));
} catch (error) {
  fail(`Release-integrity baseline could not be read: ${error instanceof Error ? error.message : String(error)}`);
  return;
}

if (baseline.format !== "fire-feast-release-integrity-v1" || !Array.isArray(baseline.files)) {
  fail("Release-integrity baseline has an unsupported format.");
  return;
}

const expectedPaths = releaseIntegrityFiles(projectRoot);
const baselinePaths = baseline.files.map((entry) => entry.path);
if (JSON.stringify(expectedPaths) !== JSON.stringify(baselinePaths)) {
  fail("Release-integrity monitored file set differs from the baseline; regenerate only after reviewing intended changes.");
}

for (const expected of baseline.files) {
  const absolutePath = path.join(projectRoot, expected.path);
  try {
    const reads = [fs.readFileSync(absolutePath), fs.readFileSync(absolutePath), fs.readFileSync(absolutePath)];
    const hashes = reads.map(sha256);
    if (new Set(hashes).size !== 1) {
      fail(`${expected.path}: unstable source read (${hashes.join(", ")})`);
      continue;
    }
    if (reads[0].length !== expected.size) fail(`${expected.path}: size ${reads[0].length}, expected ${expected.size}`);
    if (hashes[0] !== expected.sha256) fail(`${expected.path}: SHA-256 ${hashes[0]}, expected ${expected.sha256}`);
    if (expected.path.toLowerCase().endsWith(".png")) {
      for (const buffer of reads) inspectPngBuffer(buffer);
    }
  } catch (error) {
    fail(`${expected.path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (!process.exitCode) {
  console.log(`Release integrity passed: ${baseline.files.length} monitored files matched across 3 reads; all PNGs decoded cleanly.`);
}
