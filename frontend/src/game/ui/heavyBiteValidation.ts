export type HeavyBiteCompletionState = { completed: boolean };

export function normalizeHeavyBiteDuration(duration?: number): number {
  return Math.round(Math.min(700, Math.max(250, duration ?? 450)));
}

export function claimHeavyBiteCompletion(
  state: HeavyBiteCompletionState,
  heldDurationMs: number,
  requiredDurationMs: number,
  cancelled = false,
): boolean {
  if (cancelled || state.completed || heldDurationMs < requiredDurationMs) return false;
  state.completed = true;
  return true;
}
