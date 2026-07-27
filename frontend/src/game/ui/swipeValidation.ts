export const SWIPE_CONFIG = {
  minDistancePx: 72,
  minDurationMs: 70,
  maxDurationMs: 700,
  maxOffAxisRatio: 0.75,
  feedbackDurationMs: 450,
  maxIndicatorTravelPx: 110,
} as const;

export type SwipeValidationReason =
  | "CANCELLED"
  | "INACTIVE"
  | "TOO_FAST"
  | "TOO_SLOW"
  | "TOO_SHORT"
  | "OFF_AXIS"
  | "VALID";

export type SwipeValidationResult = {
  valid: boolean;
  reason: SwipeValidationReason;
  direction: "LEFT" | "RIGHT" | null;
  distance: number;
  duration: number;
};

export type SwipeValidationInput = {
  active: boolean;
  cancelled: boolean;
  dx: number;
  dy: number;
  duration: number;
};

export type SwipeSubmissionState = { submitted: boolean };

export function claimSwipeSubmission(state: SwipeSubmissionState): boolean {
  if (state.submitted) return false;
  state.submitted = true;
  return true;
}

export function validateSwipe({ active, cancelled, dx, dy, duration }: SwipeValidationInput): SwipeValidationResult {
  const distance = Math.abs(dx);
  const direction = dx < 0 ? "LEFT" : dx > 0 ? "RIGHT" : null;
  if (cancelled) return { valid: false, reason: "CANCELLED", direction, distance, duration };
  if (!active) return { valid: false, reason: "INACTIVE", direction, distance, duration };
  if (duration < SWIPE_CONFIG.minDurationMs) return { valid: false, reason: "TOO_FAST", direction, distance, duration };
  if (duration > SWIPE_CONFIG.maxDurationMs) return { valid: false, reason: "TOO_SLOW", direction, distance, duration };
  if (distance < SWIPE_CONFIG.minDistancePx) return { valid: false, reason: "TOO_SHORT", direction, distance, duration };
  if (Math.abs(dy) / Math.max(1, distance) > SWIPE_CONFIG.maxOffAxisRatio) {
    return { valid: false, reason: "OFF_AXIS", direction, distance, duration };
  }
  return { valid: true, reason: "VALID", direction, distance, duration };
}
