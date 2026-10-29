export type MatchInputType = "BITE" | "SLICE" | "ANTACID";
export type MatchInputEvent = Readonly<{ seq: number; t_ms: number; type: MatchInputType; source?: "CONTROL" | "FOOD"; x?: number; y?: number; start_x?: number; start_y?: number; end_x?: number; end_y?: number; duration_ms?: number }>;
export type InputLogBuffer = {
  start(maximumElapsedMs?: number, originTimestamp?: number | null): void;
  restore(snapshot: InputLogSnapshot, authoritativeElapsedMs: number, maximumElapsedMs: number, originTimestamp?: number | null): boolean;
  canRecord(): boolean;
  eventTimeFor(timestamp: number): number;
  events(): readonly MatchInputEvent[];
  recordAtElapsed(type: MatchInputType, evidence: import("./inputContract").GameplayInputEvidence | undefined, t_ms: number): boolean;
  getDiagnostics(timestamp: number): Readonly<{
    startedAt: number | null;
    elapsedBase: number;
    recovered: boolean;
    authoritativeElapsedMs: number | null;
    nextSequence: number;
    event_t_ms: number;
  }>;
  record(type: MatchInputType, evidence?: import("./inputContract").GameplayInputEvidence, occurredAt?: number | null): boolean;
  finish(): readonly MatchInputEvent[];
  elapsed(): number;
  snapshot(): InputLogSnapshot;
  clear(): void;
};
export type InputLogSnapshot = Readonly<{
  validation_version: 3;
  next_sequence: number;
  elapsed_ms: number;
  finalized: boolean;
  events: readonly MatchInputEvent[];
}>;
export const MAX_INPUT_EVENTS: number;
export const VALIDATION_VERSION: 3;
export function createInputLogBuffer(clock?: () => number, options?: { requireExplicitTimestamps?: boolean }): InputLogBuffer;
export function hasValidInputEvidence(event: Partial<MatchInputEvent> & { type: MatchInputType }, mechanic?: string, contestId?: string): boolean;
