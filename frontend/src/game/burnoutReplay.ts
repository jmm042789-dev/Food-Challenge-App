import { COOLING_DELAY_MS, coolHeartburn, MAX_HEARTBURN, OVERHEAT_PENALTY_MS, OVERHEAT_RESET_HEAT, OVERHEAT_WARNING_DURATION_MS } from "./heartburn";
import type { MatchInputEvent } from "./inputLog";
import { antacidHeatReduction, HEAT_SHIELD_DURATION_MS } from "./matchModifiers";

// Validation-v3 burnout state, advanced only by accepted input events. UI frames
// and recovery wall-clock origins cannot move these match-relative boundaries.
export function replayBurnoutGate(events: readonly MatchInputEvent[], t_ms: number, biteHeat: number, heatGeneration: number) {
  let heat = 0, warningUntil = 0, penaltyUntil = 0, shieldUntil = 0, coolingAt = 0;
  let lastBite: number | null = null;
  let previous = 0;
  const advance = (time: number) => {
    if (warningUntil > 0 && time >= warningUntil) {
      heat = OVERHEAT_RESET_HEAT;
      coolingAt = warningUntil;
      penaltyUntil = warningUntil + OVERHEAT_PENALTY_MS;
      shieldUntil = Math.max(shieldUntil, penaltyUntil);
      warningUntil = 0;
    }
    if (penaltyUntil > 0 && time < penaltyUntil) return false;
    if (penaltyUntil > 0) penaltyUntil = 0;
    if (lastBite !== null && warningUntil === 0 && heat > 0) {
      const from = Math.max(coolingAt, lastBite + COOLING_DELAY_MS);
      if (time > from) {
        heat = coolHeartburn(heat, time - from);
        coolingAt = time;
      }
    }
    return true;
  };
  let validHistory = true;
  for (const event of events) {
    if (event.t_ms < previous || !advance(event.t_ms)) { validHistory = false; break; }
    previous = event.t_ms;
    if (event.type === "ANTACID") {
      heat = Math.max(0, heat - antacidHeatReduction(heat));
      shieldUntil = event.t_ms + HEAT_SHIELD_DURATION_MS;
      warningUntil = 0;
    } else {
      if (event.t_ms >= shieldUntil && warningUntil === 0) {
        heat = Math.min(MAX_HEARTBURN, heat + biteHeat * heatGeneration);
        if (heat >= MAX_HEARTBURN) warningUntil = event.t_ms + OVERHEAT_WARNING_DURATION_MS;
      }
      lastBite = event.t_ms;
      coolingAt = event.t_ms;
    }
  }
  const canAccept = validHistory && Number.isInteger(t_ms) && t_ms >= previous && advance(t_ms);
  return Object.freeze({ t_ms, canAccept, validHistory, heat, warningUntil, penaltyUntil });
}
