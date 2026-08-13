export const RESULT_VERIFICATION_TIMEOUT_MS = 15_000;
export const RESULT_VERIFICATION_UI_TOLERANCE_MS = 1_500;

export class ResultVerificationUnavailableError extends Error {
  readonly code = "RESULT_VERIFICATION_CONTEXT_MISSING";
  readonly routeClass = "/match/result";
  constructor() {
    super("We couldn't verify the official result yet. Check your connection and try again.");
    this.name = "ResultVerificationUnavailableError";
  }
}

export const remainingResultDeadlineMs = (deadlineAt: number, now = Date.now()) => Math.max(0, deadlineAt - now);

export class ResultVerificationTimeoutError extends Error {
  readonly code = "RESULT_VERIFICATION_TIMEOUT";
  readonly routeClass = "/match/result";
  readonly elapsedMs: number;

  constructor(elapsedMs: number) {
    super("We couldn't verify the official result yet. Check your connection and try again.");
    this.name = "ResultVerificationTimeoutError";
    this.elapsedMs = elapsedMs;
  }
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
