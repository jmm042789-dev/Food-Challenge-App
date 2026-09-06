const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { BURNOUT_DURATION_MS, authoritativeBurnoutUntil, canAcceptScoringInput } = require("../src/game/burnoutPolicy");

test("burnout deterministically rejects scoring until the 1.5 second boundary", () => {
  assert.equal(BURNOUT_DURATION_MS, 1500);
  assert.equal(canAcceptScoringInput("PLAYING", 2500, 1000), false);
  assert.equal(canAcceptScoringInput("PLAYING", 2500, 2499), false);
  assert.equal(canAcceptScoringInput("PLAYING", 2500, 2500), true);
  assert.equal(canAcceptScoringInput("FINISHED", 0, 2500), false);
});

test("warning and burnout boundaries match authoritative event-time replay", () => {
  const warningUntil = 4000;
  const burnoutUntil = 5500;
  assert.equal(authoritativeBurnoutUntil(warningUntil, 0), burnoutUntil);
  assert.equal(canAcceptScoringInput("PLAYING", 0, 3999, warningUntil), true);
  assert.equal(canAcceptScoringInput("PLAYING", 0, 4000, warningUntil), false);
  assert.equal(canAcceptScoringInput("PLAYING", burnoutUntil, 5499, 0), false);
  assert.equal(canAcceptScoringInput("PLAYING", burnoutUntil, 5500, 0), true);
  assert.equal(canAcceptScoringInput("PLAYING", burnoutUntil, 5501, 0), true);
});

test("a delayed warning timer cannot admit rapid physical input during authoritative burnout", () => {
  const warningUntil = 4000;
  const attempted = Array.from({ length: 61 }, (_, index) => 3500 + index * 50);
  const accepted = attempted.filter((now) => canAcceptScoringInput("PLAYING", 0, now, warningUntil));
  assert.ok(accepted.includes(3950));
  assert.ok(accepted.includes(5500));
  assert.ok(accepted.every((timestamp) => timestamp < warningUntil || timestamp >= 5500));
  assert.ok(attempted.filter((timestamp) => timestamp >= 4000 && timestamp < 5500).every((timestamp) => !accepted.includes(timestamp)));
});

test("rapid accepted presses have one scoring call and one conditional log append", () => {
  const play = fs.readFileSync(path.join(__dirname, "../app/play/[contestId].tsx"), "utf8");
  const handler = play.slice(play.indexOf("const handleTap = useCallback"), play.indexOf("const handleUseAntacid"));
  assert.ok(handler.indexOf("tapLatest(actionNow)") < handler.indexOf("acceptedActionSequence === null"));
  assert.ok(handler.indexOf("acceptedActionSequence === null") < handler.indexOf("inputLog.record(actionType, evidence, actionNow)"));
  assert.equal((play.match(/const acceptedActionSequence = tapLatest\(actionNow\)/g) || []).length, 1);
  assert.equal((play.match(/inputLog\.record\(actionType, evidence, actionNow\)/g) || []).length, 1);
  assert.doesNotMatch(play, /onPressIn=\{handleTap\}/);
});

test("burnout guard occurs before score, progress, combo, and heat mutation", () => {
  const loop = fs.readFileSync(path.join(__dirname, "../src/game/useGameLoop.ts"), "utf8");
  const tapBody = loop.slice(loop.indexOf("const tap = useCallback"), loop.indexOf("const didDraw"));
  const guard = tapBody.indexOf("canAcceptScoringInput");
  assert.ok(tapBody.indexOf("synchronizeBurnoutBoundary(now)") < guard);
  for (const mutation of ["acceptedTapCountRef.current += 1", "acceptedActionSequenceRef.current =", "comboRef.current =", "scoreRef.current +="])
    assert.ok(guard >= 0 && guard < tapBody.indexOf(mutation), `${mutation} must follow burnout guard`);
});

test("burnout synchronization precedes antacid acceptance and official input logging", () => {
  const loop = fs.readFileSync(path.join(__dirname, "../src/game/useGameLoop.ts"), "utf8");
  const antacid = loop.slice(loop.indexOf("const applyAntacid = useCallback"), loop.indexOf("const resetMatch"));
  assert.ok(antacid.indexOf("synchronizeBurnoutBoundary(now)") < antacid.indexOf("canConsumeAntacid"));
  const play = fs.readFileSync(path.join(__dirname, "../app/play/[contestId].tsx"), "utf8");
  const handler = play.slice(play.indexOf("const handleTap = useCallback"), play.indexOf("const handleUseAntacid"));
  assert.ok(handler.indexOf("acceptedActionSequence === null") < handler.indexOf("inputLog.record(actionType, evidence, actionNow)"));
});

test("burnout disables the interaction surface and owns the critical message slot", () => {
  const play = fs.readFileSync(path.join(__dirname, "../app/play/[contestId].tsx"), "utf8");
  const overlay = fs.readFileSync(path.join(__dirname, "../src/game/ui/HeatPresentationOverlay.tsx"), "utf8");
  assert.match(play, /active=\{state\.status === "PLAYING" && !overheatPenaltyActive\}/);
  assert.match(play, /suppressed=\{overheatWarningActive \|\| overheatPenaltyActive/);
  assert.match(overlay, /if \(overheatPenaltyActive\)[\s\S]*COOLING DOWN · BITES LOCKED/);
});

test("arena reset effect cannot feed back merely because a theme object changed identity", () => {
  const arena = fs.readFileSync(path.join(__dirname, "../src/game/arena/ArenaAtmosphere.ts"), "utf8");
  const resetBlock = arena.slice(arena.indexOf("const reset = useCallback"), arena.indexOf("const react = useCallback"));
  assert.match(resetBlock, /\}, \[\]\);/);
  assert.match(arena, /if \(resetKeyRef\.current === resetKey\) return;/);
  assert.doesNotMatch(resetBlock, /\}, \[theme\]\);/);
});

test("achievement completion remains idempotent and match notification is guarded", () => {
  const tracker = fs.readFileSync(path.join(__dirname, "../src/achievements/AchievementTracker.ts"), "utf8");
  const play = fs.readFileSync(path.join(__dirname, "../app/play/[contestId].tsx"), "utf8");
  assert.match(tracker, /processedEventIds\.includes\(event\.eventId\)/);
  assert.match(play, /missionRecordedMatch\.current === matchRouteKey/);
  assert.match(play, /missionRecordedMatch\.current = matchRouteKey/);
});

test("client applies authoritative replay cooling before progress and antacid decisions", () => {
  const loop = fs.readFileSync(path.join(__dirname, "../src/game/useGameLoop.ts"), "utf8");
  const tapBody = loop.slice(loop.indexOf("const tap = useCallback"), loop.indexOf("const didDraw"));
  assert.match(loop, /const applyReplayCoolingUntil = useCallback/);
  assert.ok(tapBody.indexOf("canAcceptScoringInput") < tapBody.indexOf("applyReplayCoolingUntil(now)"));
  assert.ok(tapBody.indexOf("applyReplayCoolingUntil(now)") < tapBody.indexOf("effectiveTapPower"));
  assert.ok(tapBody.indexOf("lastCoolingFrameAtRef.current = now") < tapBody.indexOf("effectiveComboWindowMs"));

  const antacid = loop.slice(loop.indexOf("const applyAntacid = useCallback"), loop.indexOf("const resetMatch"));
  assert.ok(antacid.indexOf("applyReplayCoolingUntil(now)") < antacid.indexOf("canConsumeAntacid"));

  const frame = loop.slice(loop.indexOf("const startCoolingLoop = useCallback"), loop.indexOf("const addHeartburn"));
  assert.doesNotMatch(frame, /lastCoolingFrameAtRef\.current = now;[\s\S]{0,80}applyNaturalCooling/);
});