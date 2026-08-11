export type PendingSessionDisposition = "RECOVERED" | "CONTINUE_BOOTSTRAP" | "RETRY";

export function shouldProbePendingRecovery(input: {
  recoveryNoncePresent: boolean;
  recoveryTokenPresent: boolean;
}): boolean {
  return input.recoveryNoncePresent && input.recoveryTokenPresent;
}

export function pendingSessionDisposition(input: {
  authenticated: boolean;
  httpStatus: number | null;
}): PendingSessionDisposition {
  if (input.authenticated) return "RECOVERED";
  if (input.httpStatus === 401) return "CONTINUE_BOOTSTRAP";
  return "RETRY";
}
