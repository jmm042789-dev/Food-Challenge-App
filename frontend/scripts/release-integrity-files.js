const path = require("node:path");

const { findPngs } = require("./check-png-integrity");

const CRITICAL_RELEASE_FILES = [
  "app/play/[contestId].tsx",
  "src/api.ts",
  "src/apiBase.ts",
  "src/game/activeMatchInputLog.d.ts",
  "src/game/activeMatchInputLog.js",
  "src/game/burnoutPolicy.d.ts",
  "src/game/burnoutPolicy.js",
  "src/game/heartburn.ts",
  "src/game/inputContract.ts",
  "src/game/inputLog.d.ts",
  "src/game/inputLog.js",
  "src/game/resultSubmission.d.ts",
  "src/game/resultSubmission.js",
  "src/game/resultVerification.ts",
  "src/game/ui/FoodArena.tsx",
  "src/game/ui/GameplayActionZone.tsx",
  "src/game/ui/RapidActionControl.tsx",
  "src/game/ui/TapActionControl.tsx",
  "src/game/useGameLoop.ts",
  "tests/api-base.test.js",
  "tests/input-hitbox-contract.test.js",
  "tests/match-completion-pipeline.test.js",
  "tests/match-input-log.test.js",
  "tests/rapid-tap-burnout.test.js",
];

const CONFIG_FILES = ["app.json", "eas.json", "package-lock.json", "package.json"];

function releaseIntegrityFiles(projectRoot) {
  const pngs = [path.join(projectRoot, "src", "assets"), path.join(projectRoot, "assets")]
    .flatMap(findPngs)
    .map((file) => path.relative(projectRoot, file).replaceAll(path.sep, "/"));
  return [...new Set([...CRITICAL_RELEASE_FILES, ...CONFIG_FILES, ...pngs])].sort();
}

module.exports = { CONFIG_FILES, CRITICAL_RELEASE_FILES, releaseIntegrityFiles };