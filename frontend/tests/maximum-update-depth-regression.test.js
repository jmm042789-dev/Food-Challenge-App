const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { initialResultFlow, transitionResultFlow } = require("../src/game/resultFlow.ts");

const source = (relativePath) => fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");

test("result flow ignores repeated semantic transitions without recursive state growth", () => {
  let state = initialResultFlow();
  for (let index = 0; index < 2000; index += 1) {
    const next = transitionResultFlow(state, { type: "FINISH" });
    if (index === 0) assert.equal(next.phase, "FINISHED");
    else assert.equal(next, state);
    state = next;
  }

  state = transitionResultFlow(state, { type: "SUBMIT", startedAt: 100, timeoutMs: 15000 });
  const submitting = state;
  for (let index = 0; index < 2000; index += 1) {
    state = transitionResultFlow(state, { type: "SUBMIT", startedAt: 200, timeoutMs: 15000 });
    assert.equal(state, submitting);
  }

  state = transitionResultFlow(state, { type: "ACCEPT", generation: state.generation, result: { ok: true } });
  state = transitionResultFlow(state, { type: "SHOW_RESULT" });
  state = transitionResultFlow(state, { type: "SHOW_RESULT" });
  assert.equal(state.phase, "RESULT_SCREEN");
  for (let index = 0; index < 2000; index += 1) {
    const next = transitionResultFlow(state, { type: "SHOW_RESULT" });
    assert.equal(next, state);
    state = next;
  }
});

test("arena reset is keyed by match semantics rather than theme object identity", () => {
  const arena = source("src/game/arena/ArenaAtmosphere.ts");
  assert.match(arena, /const resetKeyRef = useRef\(resetKey\)/);
  assert.match(arena, /if \(resetKeyRef\.current === resetKey\) return;/);
  const reset = arena.slice(arena.indexOf("const reset = useCallback"), arena.indexOf("const react = useCallback"));
  assert.match(reset, /\}, \[\]\);/);
  assert.doesNotMatch(reset, /\[theme\]/);
});

test("result notification defaults have stable module identity", () => {
  const victory = source("src/game/ui/VictoryOverlay.tsx");
  assert.match(victory, /const NO_ACHIEVEMENTS:[^\n]+ = \[\];/);
  assert.match(victory, /achievements = NO_ACHIEVEMENTS/);
  assert.match(victory, /restaurantUnlocks = NO_RESTAURANT_UNLOCKS/);
  assert.match(victory, /titleUnlocks = NO_TITLE_UNLOCKS/);
  assert.doesNotMatch(victory, /achievements = \[\], restaurantUnlocks = \[\], titleUnlocks = \[\]/);
});

test("rapid feedback queues use refs and bounded semantic guards", () => {
  const commentary = source("src/game/commentary/CommentaryEngine.ts");
  const gameplay = source("app/play/[contestId].tsx");
  assert.match(commentary, /const queue = useRef<CommentaryItem\[]>\(\[\]\)/);
  assert.match(commentary, /\.slice\(0, MAX_QUEUE_LENGTH\)/);
  assert.match(gameplay, /milestone <= lastArenaPlayerCombo\.current/);
  assert.match(gameplay, /missionRecordedMatch\.current === matchRouteKey/);
  assert.match(gameplay, /missionRecordedMatch\.current = matchRouteKey/);
});

test("identity sync is event-driven and cannot hydrate from its own remote response", () => {
  const provider = source("src/profile/PlayerIdentityContext.tsx");
  const sync = source("src/social/publicIdentitySync.ts");
  assert.match(provider, /void syncPublicIdentity\(result\.identity\)/);
  assert.doesNotMatch(provider, /useEffect\([\s\S]*syncPublicIdentity\(identity\)/);
  assert.match(sync, /if \(syncInFlight\) return syncInFlight/);
  assert.doesNotMatch(sync, /setIdentity|refreshIdentity/);
});

test("immersive and startup listeners remain single-install or generation guarded", () => {
  const immersive = source("src/systemUi/useAndroidImmersiveMode.ts");
  const startup = source("app/index.tsx");
  assert.match(immersive, /\}, \[\]\);/);
  assert.match(immersive, /subscription\.remove\(\)/);
  assert.match(startup, /const currentGeneration = \+\+generation\.current/);
  assert.match(startup, /const isCurrent = \(\) => active && generation\.current === currentGeneration/);
});
