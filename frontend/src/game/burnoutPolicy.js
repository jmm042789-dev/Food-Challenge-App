const BURNOUT_DURATION_MS = 1500;

function authoritativeBurnoutUntil(warningUntil, burnoutUntil) {
  return burnoutUntil > 0 ? burnoutUntil : warningUntil > 0 ? warningUntil + BURNOUT_DURATION_MS : 0;
}

function canAcceptScoringInput(status, burnoutUntil, now, warningUntil = 0) {
  if (status !== "PLAYING") return false;
  // Inputs remain valid during the warning/save window. Once its exact
  // deadline is reached, treat burnout as active even if a busy JS thread has
  // not delivered the transition timer yet.
  if (warningUntil > 0 && now >= warningUntil) {
    return now >= authoritativeBurnoutUntil(warningUntil, burnoutUntil);
  }
  return burnoutUntil <= now;
}

module.exports = { BURNOUT_DURATION_MS, authoritativeBurnoutUntil, canAcceptScoringInput };
