const REQUEST_ID_PATTERN = /^[a-f0-9]{16,64}$/;

export function readResponseRequestId(response: Pick<Response, "headers">): string | null {
  try {
    const value = response.headers.get("X-Request-ID");
    return value && REQUEST_ID_PATTERN.test(value) ? value : null;
  } catch {
    return null;
  }
}

export class ApiRequestError extends Error {
  status: number;
  code: string | null;
  requestId: string | null;

  constructor(
    status: number,
    message: string,
    code: string | null = null,
    requestId: string | null = null,
  ) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

export function requestIdForError(error: unknown, fallback: string | null): string | null {
  if (
    error
    && typeof error === "object"
    && "requestId" in error
    && typeof error.requestId === "string"
    && REQUEST_ID_PATTERN.test(error.requestId)
  ) {
    return error.requestId;
  }
  return fallback && REQUEST_ID_PATTERN.test(fallback) ? fallback : null;
}
