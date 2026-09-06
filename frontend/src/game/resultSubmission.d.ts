export type CompletedMatchPayload = {
  match_id: string; contest_id: string; score: number; opponent_score: number;
  duration_sec: number; accepted_taps: number; completed_progress: number;
  maximum_combo: number; opponent_id: string; tums_used: number;
  completion_reason: "timer_completed" | "challenge_completed" | "player_exited" | "other";
  is_tournament?: boolean;
  validation_version: 3;
  input_events: readonly import("./inputLog").MatchInputEvent[];
};
export type ResultSubmissionCoordinator<T> = { preserve(payload: CompletedMatchPayload): CompletedMatchPayload; clear(): void; hasPayload(): boolean; submit(signal?: AbortSignal): Promise<T>; };
export function createResultSubmissionCoordinator<T>(submitResult: (payload: CompletedMatchPayload, signal?: AbortSignal) => Promise<T>): ResultSubmissionCoordinator<T>;
