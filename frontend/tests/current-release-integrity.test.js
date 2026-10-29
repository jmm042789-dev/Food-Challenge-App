const assert = require('node:assert/strict');
const test = require('node:test');
const { reviewedHunks, applyHunks, requireReviewedContent, requireReviewedSequence, requireHash } = require('../scripts/check-current-release-integrity');
const hunk = { oldStart: 1, oldCount: 2, newStart: 1, newCount: 3, lines: [' keep', '-old', '+guard', '+new'] };

test('current integrity derives expected source from immutable content and an exact reviewed change', () => {
  assert.equal(applyHunks('keep\nold\n', [hunk]), 'keep\nguard\nnew\n');
  requireReviewedContent('keep\r\nguard\r\nnew\r\n', 'keep\nold\n', [hunk], 'fixture');
});
test('unreviewed edits outside the patch cannot be accepted', () => {
  assert.throws(() => requireReviewedContent('changed\nguard\nnew\n', 'keep\nold\n', [hunk], 'fixture'), /independently derived/);
});
test('missing guards cannot be accepted as the current release', () => {
  assert.throws(() => requireReviewedContent('keep\nnew\n', 'keep\nold\n', [hunk], 'fixture'), /independently derived/);
});
test('context, offsets and line counts fail closed without fuzzy patching', () => {
  assert.throws(() => applyHunks('wrong\nold\n', [hunk]), /context/);
  assert.throws(() => applyHunks('keep\nold\n', [{ ...hunk, oldStart: 5 }]), /offset/);
  assert.throws(() => applyHunks('keep\nold\n', [{ ...hunk, newCount: 9 }]), /line-count/);
});
test('patches cannot authorize unreviewed paths or omit an approved change', () => {
  assert.throws(() => reviewedHunks('diff --git a/file b/file\n+++ b/frontend/package.json\n'), /Unreviewed/);
  assert.throws(() => reviewedHunks(''), /exactly the approved/);
});
test('tampered historical anchors and patch artifacts fail their independent digests', () => {
  assert.throws(() => requireHash(Buffer.from('tampered'), '0'.repeat(64), 'Historical evidence'), /independent digest mismatch/);
});

test('gameplay expectations cannot silently authorize changes to the original authentication patch scope', () => {
  const gameplayPaths = ['app/play/[contestId].tsx', 'src/game/useGameLoop.ts'];
  const patch = gameplayPaths.map(name => `diff --git a/frontend/${name} b/frontend/${name}\n+++ b/frontend/${name}\n@@ -1 +1 @@\n-old\n+reviewed\n`).join('');
  assert.equal(reviewedHunks(patch, gameplayPaths).size, 2);
  assert.throws(() => reviewedHunks(patch), /Unreviewed/);
  assert.throws(() => reviewedHunks(patch.replace('src/game/useGameLoop.ts\n@@', 'src/api.ts\n@@'), gameplayPaths), /Unreviewed/);
});

test('a lifecycle overlay must apply to the reviewed gameplay source, not replace it', () => {
  const overlay = { oldStart: 3, oldCount: 1, newStart: 3, newCount: 1, lines: ['-new', '+lifecycle'] };
  requireReviewedSequence('keep\nguard\nlifecycle\n', 'keep\nold\n', [[hunk], [overlay]], 'fixture');
  assert.throws(() => requireReviewedSequence('keep\nguard\nlifecycle\n', 'keep\nold\n', [[overlay]], 'fixture'), /context|offset/);
  assert.throws(() => requireReviewedSequence('keep\nguard\nunreviewed\n', 'keep\nold\n', [[hunk], [overlay]], 'fixture'), /independently derived/);
});
