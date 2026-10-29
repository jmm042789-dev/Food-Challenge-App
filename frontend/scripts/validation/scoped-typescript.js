const path = require("node:path");
const ts = require("typescript");
const root = path.resolve(__dirname, "../..");
const roots = [
  "src/api.ts", "app/(tabs)/home.tsx", "app/(tabs)/profile.tsx", "app/(tabs)/contests.tsx",
  "app/career.tsx", "app/missions.tsx", "app/achievements.tsx", "app/matchmaking.tsx",
  "src/game/useContestEntry.ts", "src/tournaments/components/TournamentPanel.tsx",
  "src/tournaments/useTournamentProgress.ts", "src/missions/MissionTracker.ts",
  "src/missions/MissionTypes.ts", "src/missions/useDailyMissions.ts", "src/ranks.ts",
  "src/achievements/useAchievements.ts", "src/achievements/components/AchievementCard.tsx",
  "src/components/fire/DailyMissionCard.tsx", "src/components/fire/FireHeader.tsx",
  "tests/avatar-v5-contract.ts", "tests/avatar-v5-render-contract.ts", "tests/avatar-v5-appearance-contract.ts",
  "tools/avatar-v5-preview/Preview.tsx",
];
const config = ts.readConfigFile(path.join(root, "tsconfig.json"), ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config || {}, ts.sys, root);
const program = ts.createProgram(roots.map(file => path.join(root, file)), { ...parsed.options, noEmit: true, incremental: false, tsBuildInfoFile: undefined });
const errors = [...(config.error ? [config.error] : []), ...parsed.errors, ...ts.getPreEmitDiagnostics(program)];
console.log("Scope (roots plus transitive imports):\n" + roots.join("\n"));
console.log(ts.formatDiagnostics(errors, { getCanonicalFileName: file => file, getCurrentDirectory: () => root, getNewLine: () => "\n" }));
console.log("TypeScript diagnostics: " + errors.length + "; no files emitted.");
process.exitCode = errors.length ? 1 : 0;
