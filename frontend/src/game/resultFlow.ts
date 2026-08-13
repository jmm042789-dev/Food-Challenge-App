export type ResultFlowPhase =
  | "PLAYING"
  | "FINISHED"
  | "SUBMITTING_RESULT"
  | "OFFICIAL_RESULT_RECEIVED"
  | "NAVIGATING_RESULT"
  | "RESULT_SCREEN"
  | "RESULT_ERROR";

export type ResultFlowState<T> = {
  phase: ResultFlowPhase;
  attempt: number;
  generation: number;
  startedAt: number | null;
  deadlineAt: number | null;
  terminalReason: string | null;
  uiFailsafeFired: boolean;
  officialResult: T | null;
  error: unknown | null;
};

export type ResultFlowEvent<T> =
  | { type: "RESET" }
  | { type: "FINISH" }
  | { type: "SUBMIT"; startedAt: number; timeoutMs: number }
  | { type: "ACCEPT"; result: T; generation: number }
  | { type: "SHOW_RESULT" }
  | { type: "REJECT"; error: unknown; generation: number; reason?: string; uiFailsafe?: boolean }
  | { type: "RETRY" };

export const initialResultFlow = <T>(): ResultFlowState<T> => ({
  phase: "PLAYING",
  attempt: 0,
  generation: 0,
  startedAt: null,
  deadlineAt: null,
  terminalReason: null,
  uiFailsafeFired: false,
  officialResult: null,
  error: null,
});

export function transitionResultFlow<T>(state: ResultFlowState<T>, event: ResultFlowEvent<T>): ResultFlowState<T> {
  switch (event.type) {
    case "RESET":
      return initialResultFlow<T>();
    case "FINISH":
      return state.phase === "PLAYING" ? { ...state, phase: "FINISHED" } : state;
    case "SUBMIT":
      return state.phase === "FINISHED"
        ? { ...state, phase: "SUBMITTING_RESULT", attempt: state.attempt + 1, generation: state.generation + 1, startedAt: event.startedAt, deadlineAt: event.startedAt + event.timeoutMs, terminalReason: null, uiFailsafeFired: false, error: null }
        : state;
    case "ACCEPT":
      return state.phase === "SUBMITTING_RESULT" && event.generation === state.generation
        ? { ...state, phase: "OFFICIAL_RESULT_RECEIVED", officialResult: event.result, terminalReason: "ACCEPTED", error: null }
        : state;
    case "SHOW_RESULT":
      if (state.phase === "OFFICIAL_RESULT_RECEIVED") return { ...state, phase: "NAVIGATING_RESULT" };
      if (state.phase === "NAVIGATING_RESULT") return { ...state, phase: "RESULT_SCREEN" };
      return state;
    case "REJECT":
      return state.phase === "SUBMITTING_RESULT" && event.generation === state.generation ? { ...state, phase: "RESULT_ERROR", terminalReason: event.reason ?? "REQUEST_FAILED", uiFailsafeFired: Boolean(event.uiFailsafe), error: event.error } : state;
    case "RETRY":
      return state.phase === "RESULT_ERROR"
        ? { ...state, phase: "FINISHED", error: null }
        : state;
  }
}
