const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const m = { exports: {} };
new Function('exports', ts.transpileModule(read('src/ranks.ts'), { fileName: 'ranks.ts', compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(m.exports);
const { resolveOfficialProgression: resolve, BELTS, beltForXp, nextBelt } = m.exports;
for (const [i, xp] of [0, 200, 800, 2000, 5000].entries()) {
  test('official belt boundary ' + xp, () => {
    const value = resolve({ xp, level: 19 });
    assert.equal(value.belt, BELTS[i]); assert.equal(value.beltTierIndex, i + 1);
    assert.equal(value.level, 19); assert.equal(value.available, true);
    assert.equal(value.progress, i === 4 ? 1 : 0);
    assert.equal(beltForXp(xp), value.belt); assert.equal(nextBelt(xp), value.nextBelt);
    if (xp) assert.equal(resolve({ xp: xp - 1, level: 1 }).belt, BELTS[i - 1]);
  });
}
test('local totals and account level cannot alter belt progress or mutate inputs', () => {
  const input = Object.freeze({ xp: 500, level: 2, claimedRewards: Object.freeze({ xp: 90000, coins: 90000 }) });
  const a = resolve(input), b = resolve({ xp: 500, level: 80 });
  assert.equal(a.xp, 500); assert.equal(a.progress, 0.5); assert.equal(a.intervalSize, 600);
  assert.equal(a.progress, b.progress); assert.equal(a.belt, b.belt); assert.notEqual(a.level, b.level);
  assert.equal(resolve({ xp: 10000, level: 1 }).progress, 1);
});
test('missing and invalid fields never fabricate official progression', () => {
  for (const value of [-1, NaN, Infinity, '200', true, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
    const r = resolve({ xp: value, level: value });
    assert.equal(r.fields.xp, 'invalid'); assert.equal(r.xp, null); assert.equal(r.belt, null); assert.equal(r.progress, null);
  }
  assert.equal(resolve({ xp: 10, level: 0 }).level, null);
  const missing = resolve({}); assert.equal(missing.fields.xp, 'missing'); assert.equal(missing.available, false);
  assert.equal(resolve({ xp: 200 }).beltTierIndex, 2); assert.equal(resolve({ xp: 200 }).level, null);
});
test('Home Profile Career use one server-only rule and preserve local history', () => {
  for (const p of ['app/(tabs)/home.tsx', 'app/(tabs)/profile.tsx', 'app/career.tsx']) {
    const s = read(p); assert.match(s, /resolveOfficialProgression\(player\)/);
    assert.doesNotMatch(s, /claimedRewards\.xp|BELTS\.findIndex/);
    assert.match(s, /resolveOfficialProgression\(previous\)/);
  }
  const profile = read('app/(tabs)/profile.tsx');
  assert.match(profile, /if \(xp !== null\) void syncRestaurants\(xp\)/);
  assert.match(profile, /const beltRank = official.beltTierIndex/);
  assert.match(profile, /level=\{level\}/);
  assert.match(read('app/career.tsx'), /Locally Tracked XP Earned/);
});
test('authoritative gameplay social and wallet paths stay separate', () => {
  assert.match(read('app/play/[contestId].tsx'), /beltForXp\(Number\(player.xp/);
  assert.match(read('src/social/SocialPlayerCard.tsx'), /player.level/);
  assert.doesNotMatch(read('src/playerBalance.ts'), /claimedRewards|claimedXp/);
  assert.doesNotMatch(read('src/ranks.ts'), /storage|fetch\(|api\./);
});
test('local cards never promise wallet rewards and labels match their actions', () => {
  for (const p of ['src/components/fire/DailyMissionCard.tsx', 'src/achievements/components/AchievementCard.tsx', 'src/tournaments/components/TournamentPanel.tsx']) {
    const s = read(p); assert.match(s, /LOCAL MILESTONE/); assert.match(s, /Does not add account coins or XP/);
    assert.match(s, /RECORDED/); assert.doesNotMatch(s, /\+\{.*reward\.(coins|xp)|Claim .*reward/);
  }
});
