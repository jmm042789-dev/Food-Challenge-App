/* global __dirname */
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const backendRoot = path.resolve(__dirname, "../../../backend");

function python(script, payload) {
  return JSON.parse(execFileSync("python", ["-B", "-c", `
import json, sys
sys.path.insert(0, r"${backendRoot}")
from services.match_validation import replay_input_log, InputReplayError, trusted_heat_per_tap
${script}
`, JSON.stringify(payload)], { encoding: "utf8" }));
}

function productionContests() {
  return python(`
from data.contests import CONTESTS
print(json.dumps([{**c, "heat_per_tap": trusted_heat_per_tap(c)} for c in CONTESTS]))
`, null);
}

function runBackend(active, events) {
  return python(`
payload = json.loads(sys.argv[1])
try:
    result = replay_input_log(payload["active"], payload["events"], 3)
    print(json.dumps({"accepted": True, "result": result}))
except InputReplayError as error:
    print(json.dumps({"accepted": False, "reason": error.reason, "details": error.details}))
`, { active, events });
}

function activeFor(contest, duration = contest.duration_sec) {
  return {
    allowed_duration_sec: duration,
    challenge_config: { ...contest, contest_id: contest.id },
    perk_modifiers: { tap_power: 1, combo_window_ms: 700, score_multiplier: 1, heat_generation_multiplier: 1 },
    starting_antacid: 3,
  };
}

module.exports = { productionContests, runBackend, activeFor };
