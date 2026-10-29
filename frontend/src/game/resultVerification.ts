export const RESULT_VERIFICATION_TIMEOUT_MS = 15_000;
export const RESULT_VERIFICATION_UI_TOLERANCE_MS = 1_500;

export class ResultVerificationUnavailableError extends Error {
  readonly code = "MATCH_CONTEXT_MISSING";
  readonly routeClass = "/match/result";
  constructor() {
    super("We couldn't verify the official result yet. Check your connection and try again.");
    this.name = "ResultVerificationUnavailableError";
  }
}

export const remainingResultDeadlineMs = (deadlineAt: number, now = Date.now()) => Math.max(0, deadlineAt - now);

export class ResultVerificationTimeoutError extends Error {
  readonly code = "RESULT_REQUEST_TIMEOUT";
  readonly routeClass = "/match/result";
  readonly elapsedMs: number;

  constructor(elapsedMs: number) {
    super("We couldn't verify the official result yet. Check your connection and try again.");
    this.name = "ResultVerificationTimeoutError";
    this.elapsedMs = elapsedMs;
  }
}

export class ResultResponseInvalidError extends Error {
  readonly code = "RESULT_RESPONSE_INVALID";
  readonly routeClass = "/match/result";

  constructor() {
    super("The arena returned an invalid result. Please try again.");
    this.name = "ResultResponseInvalidError";
  }
}

export type ResultFailureCode =
  | "MATCH_CONTEXT_MISSING"
  | "RESULT_REQUEST_TIMEOUT"
  | "RESULT_NETWORK_ERROR"
  | "RESULT_AUTH_FAILURE"
  | "RESULT_MATCH_NOT_FOUND"
  | "RESULT_INPUT_REJECTED"
  | "RESULT_SCHEMA_INVALID"
  | "RESULT_RESPONSE_INVALID"
  | "RESULT_HTTP_4XX"
  | "RESULT_HTTP_5XX"
  | "RESULT_SETTLEMENT_ERROR";

export type PublicResultDiagnosticCode =
  | "RESULT-NETWORK"
  | "RESULT-TIMEOUT"
  | "RESULT-AUTH"
  | "RESULT-NOT-FOUND"
  | "RESULT-REJECTED"
  | "RESULT-SCHEMA"
  | "RESULT-SERVER"
  | "RESULT-INVALID-RESPONSE"
  | "RESULT-CONTEXT"
  | "RESULT-UNKNOWN";

export function classifyResultFailure(error: unknown): ResultFailureCode {
  if (error instanceof ResultVerificationUnavailableError) return error.code;
  if (error instanceof ResultVerificationTimeoutError || (error instanceof Error && error.name === "RequestTimeoutError")) {
    return "RESULT_REQUEST_TIMEOUT";
  }
  if (error instanceof ResultResponseInvalidError) return error.code;

  const candidate = error && typeof error === "object"
    ? error as { status?: unknown; code?: unknown; message?: unknown }
    : null;
  const status = typeof candidate?.status === "number" ? candidate.status : null;
  const backendCode = typeof candidate?.code === "string" ? candidate.code : "";
  const message = typeof candidate?.message === "string" ? candidate.message : "";

  if (status === 401 || status === 403) return "RESULT_AUTH_FAILURE";
  if (status === 404 || backendCode === "MATCH_NOT_ACTIVE" || backendCode === "MATCH_EXPIRED") return "RESULT_MATCH_NOT_FOUND";
  if (status === 422 || /extra_forbidden|validation_version|input_events/i.test(message)) return "RESULT_SCHEMA_INVALID";
  if (backendCode === "MATCH_RESULT_REJECTED") return "RESULT_INPUT_REJECTED";
  if (status !== null && status >= 500) return "RESULT_HTTP_5XX";
  if (status !== null && status >= 400) return "RESULT_HTTP_4XX";
  if (error instanceof TypeError || /network|fetch|connection/i.test(message)) return "RESULT_NETWORK_ERROR";
  return "RESULT_SETTLEMENT_ERROR";
}

export function publicResultDiagnosticCode(error: unknown): PublicResultDiagnosticCode {
  switch (classifyResultFailure(error)) {
    case "MATCH_CONTEXT_MISSING": return "RESULT-CONTEXT";
    case "RESULT_REQUEST_TIMEOUT": return "RESULT-TIMEOUT";
    case "RESULT_NETWORK_ERROR": return "RESULT-NETWORK";
    case "RESULT_AUTH_FAILURE": return "RESULT-AUTH";
    case "RESULT_MATCH_NOT_FOUND": return "RESULT-NOT-FOUND";
    case "RESULT_INPUT_REJECTED": return "RESULT-REJECTED";
    case "RESULT_SCHEMA_INVALID": return "RESULT-SCHEMA";
    case "RESULT_HTTP_5XX": return "RESULT-SERVER";
    case "RESULT_RESPONSE_INVALID": return "RESULT-INVALID-RESPONSE";
    default: return "RESULT-UNKNOWN";
  }
}

const SAFE_RESULT_BACKEND_CODES = new Set([
  "MATCH_RESULT_REJECTED",
  "MATCH_NOT_ACTIVE",
  "MATCH_EXPIRED",
]);

export function safeResultBackendCode(error: unknown): string | null {
  if (!error || typeof error !== "object" || !("code" in error)) return null;
  const code = error.code;
  return typeof code === "string" && SAFE_RESULT_BACKEND_CODES.has(code) ? code : null;
}

export async function verifyResultWithTimeout<T>(
  submit: (signal: AbortSignal) => Promise<T>,
  timeoutMs = RESULT_VERIFICATION_TIMEOUT_MS,
  controller = new AbortController(),
): Promise<T> {
  const startedAt = Date.now();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new ResultVerificationTimeoutError(Date.now() - startedAt));
    }, timeoutMs);
  });

  try {
    return await Promise.race([submit(controller.signal), timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
