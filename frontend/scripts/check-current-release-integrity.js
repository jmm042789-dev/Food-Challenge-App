// Read-only, scoped source integrity. This does not qualify builds or runtime behavior.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const { inspectPngBuffer } = require('./check-png-integrity');

const ASSEMBLY = '7973669816bb8243850562edddde8ee0a8310ccd';
const INVENTORY_HASH = '13afb7f49bc4cc2cbd839b69a963b558ecc9b73e9d5b0d8fe30e366cbdbecc4d';
const HISTORY_HASH = '86f00999393c97a7adee5372c4cefd0b7531d11ee80e8a1b846e22a406b46613';
const PATCH_HASH = 'de90f60cb7e8017f1e5f3756730f706997c12083e5bccdce63edabd62467b6cb';
const PATCHED = ['src/api.ts', 'tests/api-base.test.js'];
const GAMEPLAY_PATCH_HASH = 'eed078e8ce78afdf2bef46443a1f4ad5bc8e1e2a336bfb58eeb010f9c2ed612f';
const GAMEPLAY_PATCHED = ['app/play/[contestId].tsx', 'src/game/useGameLoop.ts'];
const LIFECYCLE_PATCH_HASH = 'a774755b396672dfa6986c3bf775f31cb7a4f72f26ebe4c16d868ac61154b3d7';
const LIFECYCLE_PATCHED = ['app/play/[contestId].tsx', 'src/game/useGameLoop.ts'];
const ADDITIONAL = [
  'src/guestAuthDiagnostics.ts', 'src/guestAuthReset.ts', 'src/guestAuthStartupPolicy.ts',
  'src/game/pendingResult.js', 'src/game/pendingResult.d.ts', 'src/game/safeMatchEntry.ts',
];
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const lf = text => text.replace(/\r\n/g, '\n');
function requireHash(bytes, expected, label) {
  if (sha256(bytes) !== expected) throw Error(label + ': independent digest mismatch');
}

// No fuzzy/context-only patching: offsets, context, removals and line counts must
// all match the immutable assembly source. Each patch has its own explicit scope.
function reviewedHunks(patch, approvedPaths = PATCHED) {
  const files = new Map();
  let hunks, hunk;
  for (const line of lf(patch).split('\n')) {
    if (line.startsWith('diff --git ')) { hunks = null; hunk = null; }
    else if (line.startsWith('+++ b/frontend/')) {
      const name = line.slice('+++ b/frontend/'.length);
      if (!approvedPaths.includes(name) || files.has(name)) throw Error('Unreviewed or duplicate patch path: ' + name);
      hunks = []; files.set(name, hunks);
    } else if (line.startsWith('@@')) {
      const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
      if (!match || !hunks) throw Error('Malformed reviewed patch hunk');
      hunk = { oldStart: +match[1], oldCount: +(match[2] ?? 1), newStart: +match[3], newCount: +(match[4] ?? 1), lines: [] };
      hunks.push(hunk);
    } else if (hunk && /^[ +\-]/.test(line)) hunk.lines.push(line);
    else if (hunk && line !== '') throw Error('Unsupported reviewed patch line');
  }
  if (approvedPaths.some(name => !files.get(name)?.length)) throw Error('Reviewed patch must cover exactly the approved changes');
  return files;
}
function applyHunks(base, hunks) {
  const lines = lf(base).split('\n'), output = [];
  let cursor = 0;
  for (const hunk of hunks) {
    const start = hunk.oldStart - 1;
    if (start < cursor || start > lines.length) throw Error('Patch offset mismatch');
    output.push(...lines.slice(cursor, start)); cursor = start;
    if (output.length !== hunk.newStart - 1) throw Error('Patch output offset mismatch');
    let oldCount = 0, newCount = 0;
    for (const line of hunk.lines) {
      if (line[0] !== '+') {
        if (lines[cursor++] !== line.slice(1)) throw Error('Patch context/removal mismatch');
        oldCount++;
      }
      if (line[0] !== '-') { output.push(line.slice(1)); newCount++; }
    }
    if (oldCount !== hunk.oldCount || newCount !== hunk.newCount) throw Error('Patch line-count mismatch');
  }
  return output.concat(lines.slice(cursor)).join('\n');
}
function requireReviewedContent(actual, base, hunks, label) {
  requireReviewedSequence(actual, base, [hunks], label);
}
function requireReviewedSequence(actual, base, layers, label) {
  let expected = lf(base);
  for (const hunks of layers) expected = applyHunks(expected, hunks);
  if (lf(actual) !== expected) throw Error(label + ': differs from independently derived reviewed source');
}

function checkCurrentRelease(repositoryRoot = path.resolve(__dirname, '../..')) {
  function safePath(relative) {
    if (!relative || relative.includes('\\') || relative.split('/').some(p => !p || p === '.' || p === '..' || p.includes(':'))) throw Error('Unsafe integrity path');
    let current = repositoryRoot;
    if (fs.lstatSync(current).isSymbolicLink()) throw Error('Linked repository root');
    for (const part of relative.split('/')) {
      current = path.join(current, part);
      if (fs.lstatSync(current).isSymbolicLink()) throw Error('Linked integrity path: ' + relative);
    }
    return current;
  }
  function read(relative) {
    const absolute = safePath(relative), before = fs.statSync(absolute);
    if (!before.isFile() || before.size > 16 * 1024 * 1024) throw Error('Not a bounded regular file: ' + relative);
    const bytes = fs.readFileSync(absolute), after = fs.statSync(absolute);
    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ino !== after.ino) throw Error('Unstable integrity read: ' + relative);
    return bytes;
  }
  const inventoryBytes = read('provenance/SHA256SUMS.txt');
  requireHash(inventoryBytes, INVENTORY_HASH, 'Preserved assembly inventory');
  const inventory = new Map();
  for (const line of inventoryBytes.toString('utf8').trim().split(/\r?\n/)) {
    const match = /^([a-f0-9]{64})  (.+)$/.exec(line);
    if (!match || inventory.has(match[2])) throw Error('Invalid assembly inventory');
    inventory.set(match[2], match[1]);
  }
  const baselineBytes = read('frontend/release-integrity-baseline.json');
  requireHash(baselineBytes, inventory.get('frontend/release-integrity-baseline.json'), 'Build 19 baseline');
  requireHash(read('validation-results/historical-integrity.json'), HISTORY_HASH, 'Historical Build 19 report');
  const patchBytes = read('frontend/current-release-reviewed.patch');
  requireHash(patchBytes, PATCH_HASH, 'Explicitly reviewed patch');
  const patches = reviewedHunks(patchBytes.toString('utf8'));
  const gameplayPatch = read('frontend/current-release-gameplay-reviewed.patch');
  requireHash(gameplayPatch, GAMEPLAY_PATCH_HASH, 'Explicitly reviewed gameplay patch');
  for (const [name, hunks] of reviewedHunks(gameplayPatch.toString('utf8'), GAMEPLAY_PATCHED)) {
    if (patches.has(name)) throw Error('Overlapping reviewed patches');
    patches.set(name, hunks);
  }
  const lifecyclePatch = read('frontend/current-release-lifecycle-reviewed.patch');
  requireHash(lifecyclePatch, LIFECYCLE_PATCH_HASH, 'Explicitly reviewed lifecycle patch');
  const lifecyclePatches = reviewedHunks(lifecyclePatch.toString('utf8'), LIFECYCLE_PATCHED);
  for (const name of lifecyclePatches.keys()) if (!patches.has(name)) throw Error('Lifecycle patch lacks a reviewed gameplay base');
  const baseline = JSON.parse(baselineBytes);
  const png = name => /^frontend\/(src\/assets|assets)\/.+\.png$/i.test(name);
  const expectedPngs = [...inventory.keys()].filter(png).sort();
  const actualPngs = [];
  let visitedEntries = 0;
  function collect(relative, depth = 0) {
    if (depth > 16) throw Error('Asset directory depth exceeded');
    for (const entry of fs.readdirSync(safePath(relative), { withFileTypes: true })) {
      if (++visitedEntries > 2000) throw Error('Asset entry inspection bound exceeded');
      const name = relative + '/' + entry.name;
      safePath(name); // Fail on links before descent, including junctions.
      if (entry.isDirectory()) collect(name, depth + 1);
      else if (entry.isFile() && name.toLowerCase().endsWith('.png')) actualPngs.push(name);
      if (actualPngs.length > 500) throw Error('Asset inspection bound exceeded');
    }
  }
  collect('frontend/assets'); collect('frontend/src/assets');
  if (JSON.stringify(actualPngs.sort()) !== JSON.stringify(expectedPngs)) throw Error('PNG inventory differs from preserved assembly');
  const monitored = [...new Set([...baseline.files.map(e => e.path), ...ADDITIONAL, ...expectedPngs.map(p => p.slice('frontend/'.length))])].sort();
  let pngCount = 0;
  for (const name of monitored) {
    const relative = 'frontend/' + name, bytes = read(relative);
    if (patches.has(name)) {
      const git = process.platform === 'win32' ? 'C:\\Program Files\\Git\\cmd\\git.exe' : 'git';
      const result = cp.spawnSync(git, ['--no-optional-locks', 'show', ASSEMBLY + ':' + relative], {
        cwd: repositoryRoot, windowsHide: true, timeout: 10000, maxBuffer: 1024 * 1024,
      });
      if (result.error || result.status !== 0) throw Error('Cannot read immutable assembly source: ' + name);
      const layers = [patches.get(name)];
      if (lifecyclePatches.has(name)) layers.push(lifecyclePatches.get(name));
      requireReviewedSequence(bytes.toString('utf8'), result.stdout.toString('utf8'), layers, name);
    } else requireHash(bytes, inventory.get(relative), name);
    if (name.toLowerCase().endsWith('.png')) { inspectPngBuffer(bytes); pngCount++; }
  }
  return { status: 'PASS', scope: 'Historical monitored frontend files, preserved PNG inventory, and six additional auth/recovery source files',
    assembly: ASSEMBLY, checkedFiles: monitored.length, decodedPngs: pngCount, reviewedChanges: [...patches.keys()],
    historicalEvidenceUnchanged: true, lifecycleOverlay: true, qualification: 'Source integrity only; not build, runtime, database or device acceptance.' };
}
if (require.main === module) {
  try { console.log(JSON.stringify(checkCurrentRelease(), null, 2)); }
  catch (error) { console.error(JSON.stringify({ status: 'FAIL', error: error.message })); process.exitCode = 1; }
}
module.exports = { reviewedHunks, applyHunks, requireReviewedContent, requireReviewedSequence, requireHash, checkCurrentRelease };
