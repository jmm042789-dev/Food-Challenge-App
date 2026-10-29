const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
function load(file, dependencies = {}) {
  const module = { exports: {} };
  const output = ts.transpileModule(read(file), { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2020 } }).outputText;
  new Function("require", "module", "exports", output)(id => {
    assert.ok(Object.hasOwn(dependencies, id), "Unexpected dependency: " + id);
    return dependencies[id];
  }, module, module.exports);
  return module.exports;
}
const ids = ["nathans-hotdogs", "wing-bowl", "pizza-hut-stuffed", "katz-pastrami", "ben-jerry-icecream", "in-n-out-burgers"];
function entryHarness() {
  const routes = [], alerts = [], calls = [];
  let catalog = ids.map(id => ({ id })), active = { status: "absent" }, failCatalog = false, failActive = false;
  const api = {
    pendingResult: async () => null,
    listContests: async () => { calls.push("catalog"); if (failCatalog) throw Error("offline"); return catalog; },
    activeMatch: async () => { calls.push("active"); if (failActive) throw Error("offline"); return active; },
    abandonMatch: async () => { calls.push("abandon"); return { status: "cancelled" }; },
  };
  const { useContestEntry: createEntryCallback } = load("src/game/useContestEntry.ts", {
    react: { useCallback: fn => fn, useRef: value => ({ current: value }) },
    "react-native": { Alert: { alert: (...args) => alerts.push(args) } },
    "expo-router": { useRouter: () => ({ push: route => routes.push(route) }) },
    "../api": { api, parseContests: value => value },
  });
  return { enter: createEntryCallback(), routes, alerts, calls, active: value => { active = value; }, catalog: value => { catalog = value; }, offline: value => { failCatalog = value; }, activeFailure: value => { failActive = value; } };
}
for (const id of ids) test("catalog contest remains playable: " + id, async () => {
  const h = entryHarness();
  await h.enter(id, { tournamentOccurrenceId: "weekly:1" });
  assert.deepEqual(h.routes, ["/play/" + id + "?tournament=weekly%3A1"]);
  assert.deepEqual(h.calls, ["catalog", "active"]);
});
test("unavailable IDs and a match UUID cannot navigate or substitute another contest", async () => {
  for (const id of ["taco-tower-challenge", "ramen-rumble", "8cec10bc-2d31-4e52-859e-f9fd10f3cd2b", ""]) {
    const h = entryHarness(); await h.enter(id);
    assert.deepEqual(h.routes, []); assert.deepEqual(h.calls, ["catalog"]);
    assert.equal(h.alerts[0][0], "Contest Unavailable");
  }
});
test("fresh catalog controls entry rather than a client whitelist", async () => {
  const h = entryHarness(); h.catalog([]); await h.enter(ids[0]); assert.equal(h.routes.length, 0);
  h.catalog([{ id: "synthetic-new-contest" }]); await h.enter("synthetic-new-contest");
  assert.deepEqual(h.routes, ["/play/synthetic-new-contest"]);
});
test("catalog and active-match failures fail closed and allow explicit retry", async () => {
  const h = entryHarness(); h.offline(true); await h.enter(ids[0]);
  assert.equal(h.routes.length, 0); assert.equal(h.alerts[0][0], "Unable to Check Contests");
  h.offline(false); h.activeFailure(true); await h.enter(ids[0]); assert.equal(h.routes.length, 0);
  h.activeFailure(false); await h.enter(ids[0]); assert.deepEqual(h.routes, ["/play/" + ids[0]]);
});
test("same-contest resume retains tournament context and duplicate entry is guarded", async () => {
  const h = entryHarness(); h.active({ status: "resumable", match_id: "match-a", contest_id: ids[0] });
  await Promise.all([h.enter(ids[0], { tournamentOccurrenceId: "week" }), h.enter(ids[0])]);
  assert.deepEqual(h.routes, ["/play/" + ids[0] + "?tournament=week&resumeMatchId=match-a"]);
});
test("resume validates its contest ID and preserves explicit abandon-and-enter", async () => {
  for (const activeId of [ids[1], "missing-contest"]) {
    const h = entryHarness(); h.active({ status: "resumable", match_id: "match-a", contest_id: activeId });
    await h.enter(ids[0]); assert.equal(h.routes.length, 0);
    const choices = h.alerts[0][2]; choices[0].onPress();
    assert.deepEqual(h.routes, activeId === ids[1] ? ["/play/" + ids[1] + "?resumeMatchId=match-a"] : []);
    choices[1].onPress(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.routes.at(-1), "/play/" + ids[0]); assert.ok(h.calls.includes("abandon"));
  }
});
const React = { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }) };
const native = { Image: "Image", Pressable: "Pressable", Text: "Text", View: "View", StyleSheet: { create: value => value } };
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== "object") return [];
  return [tree, ...nodes(tree.props?.children)];
}
const catalog = load("src/tournaments/TournamentCatalog.ts");
function panel(reason, tournament = catalog.TOURNAMENT_CATALOG[3]) {
  let entries = 0;
  const component = load("src/tournaments/components/TournamentPanel.tsx", {
    react: React, "react-native": native,
    "../../components/fire/FireButton": "FireButton", "../../components/fire/FirePanel": "FirePanel",
    "../../restaurants/RestaurantCatalog": { RESTAURANT_BY_ID: new Map() },
    "../TournamentRotation": { formatTournamentTimeRemaining: () => "1 day" },
    "../../assets/foodArtwork": { getFoodArtwork: () => ({ source: 1, scale: 1 }) },
  }).default;
  const progress = { bestScore: 200, matchesEntered: 3, wins: 1, highestCombo: 4, claimedRewardIds: [tournament.rewardTable[0].id] };
  const before = JSON.stringify(progress);
  const tree = component({ tournament, progress, entryUnavailableReason: reason, onEnter: () => { entries++; }, onClaimReward: () => {} });
  assert.equal(JSON.stringify(progress), before);
  return { tree, entries: () => entries };
}
test("unavailable tournament has accessible explanation and disabled guarded entry while history stays visible", () => {
  const h = panel("This tournament's contest is not currently available."); const all = nodes(h.tree);
  const button = all.find(n => n.type === "FireButton");
  assert.equal(button.props.disabled, true); assert.equal(button.props.title, "CONTEST UNAVAILABLE");
  assert.match(button.props.accessibilityLabel, /unavailable/); assert.match(button.props.accessibilityHint, /not currently available/);
  assert.ok(all.some(n => n.props.accessibilityRole === "alert")); button.props.onPress(); assert.equal(h.entries(), 0);
  const text = JSON.stringify(h.tree); assert.match(text, /RECORDED/); assert.match(text, /200/); assert.match(text, /LOCAL MILESTONE/);
  const fireButton = read("src/components/fire/FireButton.tsx");
  assert.match(fireButton, /accessibilityState=\{\{ disabled: inactive, busy: loading \}\}/);
  assert.match(fireButton, /disabled=\{inactive\}/);
});
test("supported tournament panel retains an enabled play action", () => {
  const h = panel(null, catalog.TOURNAMENT_CATALOG[0]); const button = nodes(h.tree).find(n => n.type === "FireButton");
  assert.equal(button.props.disabled, false); assert.equal(button.props.title, "ENTER TOURNAMENT");
  button.props.onPress(); assert.equal(h.entries(), 1);
});
test("Contests wires loaded server availability and preserves tournament occurrence ID", () => {
  const source = read("app/(tabs)/contests.tsx");
  assert.match(source, /setContests\(parseContests\(contestResult.value\)\)/);
  assert.match(source, /entryUnavailableReason=\{hasError[\s\S]*contests.some\(\(contest\) => contest.id === activeTournament.entryContestId\)/);
  assert.match(source, /enterContest\(activeTournament.entryContestId, \{ tournamentOccurrenceId: activeTournament.occurrenceId \}\)/);
});
test("unavailable tournament definitions and legacy saved history remain readable without writes", async () => {
  assert.deepEqual(catalog.TOURNAMENT_CATALOG.map(t => t.entryContestId), [ids[5], ids[2], ids[1], "taco-tower-challenge", "ramen-rumble", ids[0]]);
  const saved = { version: 1, tournaments: [{ occurrenceId: "ramen-rumble:2026", tournamentId: "ramen-rumble", matchesEntered: 2, bestScore: 120, wins: 1, highestCombo: 3, finalPlacement: 2, claimedRewardIds: ["ramen_rumble_entry"], claimedCoins: 40, claimedXp: 40, processedMatchIds: ["historical-match"] }] };
  const serialized = JSON.stringify(saved);
  const tracker = load("src/tournaments/TournamentProgress.ts", {
    "../utils/storage": { storage: { getItem: async key => { assert.equal(key, "fire_feast_tournament_progress_v1"); return serialized; }, setItem: () => assert.fail("Navigation must not write history") } },
    "./TournamentCatalog": catalog,
  });
  const state = await tracker.loadTournamentProgress(); assert.deepEqual(state, saved);
  assert.deepEqual(tracker.getTournamentPlayerProgress(state, saved.tournaments[0].occurrenceId), saved.tournaments[0]);
});
test("direct legacy route is inert until an explicit safe exit, without a UUID play route or redirect loop", () => {
  const routes = [];
  const Screen = load("app/matchmaking.tsx", {
    react: React, "react-native": native, "expo-router": { useRouter: () => ({ replace: route => routes.push(route) }) },
    "react-native-safe-area-context": { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    "../src/game/FireArenaBackground": "Background", "../src/components/fire/FireButton": "FireButton", "../src/components/fire/FirePanel": "FirePanel",
  }).default;
  const tree = Screen(); assert.deepEqual(routes, []);
  assert.match(JSON.stringify(tree), /Random matchmaking is not available/);
  const button = nodes(tree).find(n => n.type === "FireButton"); assert.ok(button.props.accessibilityLabel);
  button.props.onPress(); assert.deepEqual(routes, ["/(tabs)/contests"]);
  assert.doesNotMatch(read("app/matchmaking.tsx"), /matchmakingJoin|matchmakingStatus|matchmakingLeave|\/play\/|setInterval|setTimeout/);
  assert.doesNotMatch(read("app/(tabs)/contests.tsx"), /["']\/matchmaking/);
});
test("working friend challenge keeps authoritative contest ID separate from PvP match ID", () => {
  const source = read("app/pvp/match/[matchId].tsx");
  assert.match(source, /api.startPvpAttempt\(match.match_id\)/);
  assert.match(source, /\/play\/\$\{encodeURIComponent\(attempt.contest.id\)\}\?pvpMatch=\$\{encodeURIComponent\(match.match_id\)\}/);
  const play = read("app/play/[contestId].tsx");
  assert.match(play, /if \(!selectedContest\) throw new Error\("Contest was not found"\)/);
  assert.match(play, /isPvp \? await api.startPvpAttempt\(pvpMatchId\) : entry!\.match/);
  assert.match(play, /const entry = isPvp \? null : await resolveMatchEntry/);
});
