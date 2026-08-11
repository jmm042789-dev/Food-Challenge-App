export const AUTH_DIAGNOSTIC_CODES = [
  "AUTH_LEGACY_STATE",
  "AUTH_SECURESTORE_MISSING",
  "AUTH_SECURESTORE_UNAVAILABLE",
  "AUTH_BEARER_REJECTED",
  "AUTH_RECOVERY_INVALID",
  "AUTH_RECOVERY_EXPIRED",
  "AUTH_RECOVERY_USED",
  "AUTH_BOOTSTRAP_CONFLICT",
  "AUTH_BOOTSTRAP_REJECTED",
  "AUTH_NETWORK",
  "AUTH_INVALID_RESPONSE",
  "AUTH_LOCAL_RESET_FAILED",
  "AUTH_RESET_INTERRUPTED",
  "AUTH_INSTALLATION_CREATE_FAILED",
  "AUTH_CREDENTIAL_PERSIST_FAILED",
  "AUTH_SESSION_VERIFY_FAILED",
  "AUTH_UNKNOWN",
] as const;

export type AuthDiagnosticCode = typeof AUTH_DIAGNOSTIC_CODES[number];

export type GuestAuthStorageState =
  | "VALID_CURRENT_CREDENTIALS"
  | "CLEAN_INSTALL"
  | "LEGACY_STATE"
  | "INSTALLATION_WITHOUT_CREDENTIALS"
  | "SECURESTORE_UNAVAILABLE"
  | "PENDING_RECOVERY_READY"
  | "PENDING_RECOVERY_TOKEN_MISSING";

export type GuestAuthStorageSnapshot = {
  credentialsPresent: boolean;
  installationPresent: boolean;
  legacyPresent: boolean;
  recoveryNoncePresent: boolean;
  recoveryTokenPresent: boolean;
  secureStoreAvailable: boolean;
};

export function classifyGuestAuthStorage(snapshot: GuestAuthStorageSnapshot): GuestAuthStorageState {
  if (!snapshot.secureStoreAvailable) return "SECURESTORE_UNAVAILABLE";
  if (snapshot.credentialsPresent) return "VALID_CURRENT_CREDENTIALS";
  if (snapshot.legacyPresent) return "LEGACY_STATE";
  if (snapshot.recoveryNoncePresent && snapshot.recoveryTokenPresent) return "PENDING_RECOVERY_READY";
  if (snapshot.recoveryNoncePresent && !snapshot.recoveryTokenPresent) return "PENDING_RECOVERY_TOKEN_MISSING";
  if (snapshot.installationPresent) return "INSTALLATION_WITHOUT_CREDENTIALS";
  return "CLEAN_INSTALL";
}

export function diagnosticMessage(code: AuthDiagnosticCode): string {
  switch (code) {
    case "AUTH_LEGACY_STATE":
      return "An older guest profile is stored on this device, but it cannot be verified securely.";
    case "AUTH_SECURESTORE_MISSING":
      return "This installation was restored without its protected guest credential.";
    case "AUTH_SECURESTORE_UNAVAILABLE":
      return "Protected credential storage is unavailable on this device.";
    case "AUTH_BEARER_REJECTED":
      return "The saved guest credential is no longer accepted by the server.";
    case "AUTH_RECOVERY_INVALID":
      return "The saved guest recovery credential is invalid.";
    case "AUTH_RECOVERY_EXPIRED":
      return "The saved guest recovery window has expired.";
    case "AUTH_RECOVERY_USED":
      return "The saved guest recovery credential has already been used.";
    case "AUTH_BOOTSTRAP_CONFLICT":
      return "A guest already exists for this installation and could not be recovered safely.";
    case "AUTH_BOOTSTRAP_REJECTED":
      return "The guest service rejected new-account bootstrap before credentials were issued.";
    case "AUTH_NETWORK":
      return "Fire Feast could not reach the guest service. Check your connection and retry.";
    case "AUTH_INVALID_RESPONSE":
      return "The guest service returned an invalid response.";
    case "AUTH_LOCAL_RESET_FAILED":
      return "Fire Feast could not safely clear the local guest credentials.";
    case "AUTH_RESET_INTERRUPTED":
      return "A previously confirmed guest reset did not finish. Retry or start the new guest again.";
    case "AUTH_INSTALLATION_CREATE_FAILED":
      return "Fire Feast could not create a fresh local installation identity.";
    case "AUTH_CREDENTIAL_PERSIST_FAILED":
      return "The new guest was created, but its protected credentials could not be saved.";
    case "AUTH_SESSION_VERIFY_FAILED":
      return "The new guest credentials were saved, but the authenticated session could not be verified.";
    default:
      return "Fire Feast could not verify this guest account.";
  }
}

export function diagnosticCodeForHttp401(
  path: string,
  authenticated: boolean,
): AuthDiagnosticCode {
  if (authenticated) return "AUTH_BEARER_REJECTED";
  if (path === "/auth/guest") return "AUTH_BOOTSTRAP_REJECTED";
  return "AUTH_UNKNOWN";
}

export function isResetEligibleAuthCode(code: AuthDiagnosticCode): boolean {
  return new Set<AuthDiagnosticCode>([
    "AUTH_LEGACY_STATE",
    "AUTH_SECURESTORE_MISSING",
    "AUTH_BEARER_REJECTED",
    "AUTH_RECOVERY_INVALID",
    "AUTH_RECOVERY_EXPIRED",
    "AUTH_RECOVERY_USED",
    "AUTH_BOOTSTRAP_CONFLICT",
    "AUTH_RESET_INTERRUPTED",
    "AUTH_INSTALLATION_CREATE_FAILED",
    "AUTH_CREDENTIAL_PERSIST_FAILED",
    "AUTH_SESSION_VERIFY_FAILED",
  ]).has(code);
}

export function diagnosticCodeForUnknown(error: unknown): AuthDiagnosticCode {
  if (error && typeof error === "object" && "code" in error) {
    const code = error.code;
    if (typeof code === "string" && AUTH_DIAGNOSTIC_CODES.includes(code as AuthDiagnosticCode)) {
      return code as AuthDiagnosticCode;
    }
  }
  if (
    error
    && typeof error === "object"
    && "status" in error
    && typeof error.status === "number"
    && (error.status >= 500 || error.status === 408 || error.status === 429)
  ) return "AUTH_NETWORK";
  if (
    error instanceof TypeError
    || (error instanceof Error && /network|timed out|fetch/i.test(error.message))
  ) return "AUTH_NETWORK";
  return "AUTH_UNKNOWN";
}

export function safeAuthRequestId(error: unknown): string | null {
  if (
    error
    && typeof error === "object"
    && "requestId" in error
    && typeof error.requestId === "string"
    && /^[a-f0-9]{16,64}$/.test(error.requestId)
  ) return error.requestId;
  return null;
}
