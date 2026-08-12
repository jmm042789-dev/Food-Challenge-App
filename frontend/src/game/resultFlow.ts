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
  officialResult: T | null;
  error: unknown | null;
};

export type ResultFlowEvent<T> =
  | { type: "RESET" }
  | { type: "FINISH" }
  | { type: "SUBMIT" }
  | { type: "ACCEPT"; result: T }
  | { type: "SHOW_RESULT" }
  | { type: "REJECT"; error: unknown }
  | { type: "RETRY" };

export const initialResultFlow = <T>(): ResultFlowState<T> => ({
  phase: "PLAYING",
  attempt: 0,
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
        ? { ...state, phase: "SUBMITTING_RESULT", attempt: state.attempt + 1, error: null }
        : state;
    case "ACCEPT":
      return state.phase === "SUBMITTING_RESULT"
        ? { ...state, phase: "OFFICIAL_RESULT_RECEIVED", officialResult: event.result, error: null }
        : state;
    case "SHOW_RESULT":
      if (state.phase === "OFFICIAL_RESULT_RECEIVED") return { ...state, phase: "NAVIGATING_RESULT" };
      if (state.phase === "NAVIGATING_RESULT") return { ...state, phase: "RESULT_SCREEN" };
      return state;
    case "REJECT":
      return state.phase === "SUBMITTING_RESULT" ? { ...state, phase: "RESULT_ERROR", error: event.error } : state;
    case "RETRY":
      return state.phase === "RESULT_ERROR"
        ? { ...state, phase: "FINISHED", error: null }
        : state;
  }
}
