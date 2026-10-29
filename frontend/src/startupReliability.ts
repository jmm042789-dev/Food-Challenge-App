export type StartupFailureKind = "OFFLINE" | "TIMEOUT" | "SERVER" | "AUTH" | "CLIENT" | "INVALID_RESPONSE" | "UNKNOWN";
export type StartupFailureClassification = { kind: StartupFailureKind; transient: boolean; status: number | null; message: string };
export type StartupOperation = "PLAYER_FETCH" | "ACTIVE_MATCH" | "ACTIVE_PVP" | "IDENTITY_INIT";
export type StartupDiagnosticCode =
  | "API_CONFIG"
  | "GUEST_CREATE_NETWORK"
  | "GUEST_CREATE_HTTP"
  | "GUEST_CREATE_PARSE"
  | "CREDENTIAL_SAVE"
  | "PLAYER_FETCH_NETWORK"
  | "PLAYER_FETCH_HTTP"
  | "PLAYER_FETCH_PARSE"
  | "PLAYER_SCHEMA"
  | "ACTIVE_MATCH_NETWORK"
  | "ACTIVE_MATCH_HTTP"
  | "ACTIVE_MATCH_PARSE"
  | "ACTIVE_PVP_NETWORK"
  | "ACTIVE_PVP_HTTP"
  | "ACTIVE_PVP_PARSE"
  | "IDENTITY_INIT"
  | "STARTUP_UNKNOWN";

export type BootstrapPlayer = Record<string, unknown> & {
  player_id?: string;
  device_id?: string;
  tutorial_done: boolean;
  welcome_reward_claimed: boolean;
};

export class PlayerSchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlayerSchemaError";
  }
}

const statusOf = (error: unknown) => error && typeof error === "object" && "status" in error && typeof error.status === "number" ? error.status : null;
const codeOf = (error: unknown) => error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : null;

export function classifyStartupFailure(error: unknown): StartupFailureClassification {
  const status = statusOf(error);
  const code = codeOf(error);
  const name = error instanceof Error ? error.name : "";
  const text = error instanceof Error ? error.message : "";
  if (name === "RequestTimeoutError" || /timed out/i.test(text)) return { kind: "TIMEOUT", transient: true, status, message: "Fire Feast couldn't reach the game server. Try again in a moment." };
  if (error instanceof TypeError || /network request failed|failed to fetch|connection reset|dns|internet/i.test(text)) return { kind: "OFFLINE", transient: true, status, message: "Check your internet connection and try again." };
  if (status === 502 || status === 503 || status === 504 || status === 408) return { kind: "SERVER", transient: true, status, message: "Fire Feast couldn't reach the game server. Try again in a moment." };
  if (status !== null && status >= 500) return { kind: "SERVER", transient: false, status, message: "The Arena is temporarily unavailable. Try again in a moment." };
  if (code === "AUTH_INVALID_RESPONSE" || /invalid response|unexpected response|json/i.test(text)) return { kind: "INVALID_RESPONSE", transient: false, status, message: "Player data could not be loaded. Retry or restart the app." };
  if (code === "AUTH_NETWORK") return { kind: /timed out/i.test(text) ? "TIMEOUT" : "OFFLINE", transient: true, status, message: /timed out/i.test(text) ? "Fire Feast couldn't reach the game server. Try again in a moment." : "Check your internet connection and try again." };
  if (code?.startsWith("AUTH_") || status === 401 || status === 403) return { kind: "AUTH", transient: false, status, message: "Player data could not be loaded. Retry or restart the app." };
  if (status !== null && status >= 400 && status < 500) return { kind: "CLIENT", transient: false, status, message: "Player data could not be loaded. Retry or restart the app." };
  return { kind: "UNKNOWN", transient: false, status, message: "Player data could not be loaded. Retry or restart the app." };
}

export function validateBootstrapPlayer(value: unknown): BootstrapPlayer {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PlayerSchemaError("The player response was not a JSON object.");
  }
  const player = value as Record<string, unknown>;
  const playerId = typeof player.player_id === "string" && player.player_id.trim()
    ? player.player_id.trim()
    : typeof player.device_id === "string" && player.device_id.trim()
      ? player.device_id.trim()
      : "";
  if (!playerId) throw new PlayerSchemaError("The player response did not contain a core identity.");
  if (typeof player.tutorial_done !== "boolean") {
    throw new PlayerSchemaError("The player response did not contain a valid tutorial state.");
  }
  return {
    ...player,
    tutorial_done: player.tutorial_done,
    // Older valid players may predate this optional reward flag. Treat only an
    // explicit true as claimed; the claim endpoint remains authoritative.
    welcome_reward_claimed: player.welcome_reward_claimed === true,
  };
}

export function isOptionalStartupRouteMissing(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "status" in error && error.status === 404);
}

export function startupDiagnosticCode(
  error: unknown,
  operation: StartupOperation,
  authStage = "",
): StartupDiagnosticCode {
  if (error instanceof PlayerSchemaError) return "PLAYER_SCHEMA";
  const classification = classifyStartupFailure(error);
  if (operation === "IDENTITY_INIT") return "IDENTITY_INIT";
  if (operation === "PLAYER_FETCH" && authStage.includes("BOOTSTRAP")) {
    if (["AUTH_SECURESTORE_UNAVAILABLE", "AUTH_CREDENTIAL_PERSIST_FAILED", "AUTH_SESSION_VERIFY_FAILED"].includes(codeOf(error) ?? "")) return "CREDENTIAL_SAVE";
    if (classification.kind === "OFFLINE" || classification.kind === "TIMEOUT" || classification.kind === "SERVER") return "GUEST_CREATE_NETWORK";
    if (classification.kind === "INVALID_RESPONSE") return "GUEST_CREATE_PARSE";
    if (authStage.includes("CREDENTIAL") || authStage.includes("SESSION_VERIFY")) return "CREDENTIAL_SAVE";
    return "GUEST_CREATE_HTTP";
  }
  const prefix = operation === "PLAYER_FETCH" ? "PLAYER_FETCH" : operation;
  if (classification.kind === "OFFLINE" || classification.kind === "TIMEOUT" || classification.kind === "SERVER") return `${prefix}_NETWORK` as StartupDiagnosticCode;
  if (classification.kind === "INVALID_RESPONSE") return `${prefix}_PARSE` as StartupDiagnosticCode;
  if (classification.status !== null) return `${prefix}_HTTP` as StartupDiagnosticCode;
  return "STARTUP_UNKNOWN";
}

export async function withTransientStartupRetry<T>(
  operation: () => Promise<T>,
  options: { operationName: string; maxAttempts?: number; baseDelayMs?: number; isCurrent?: () => boolean; sleep?: (ms: number) => Promise<void>; manual?: boolean },
): Promise<T> {
  const maxAttempts = Math.max(1, Math.min(3, options.maxAttempts ?? 3));
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const startedAt = Date.now();
    try {
      const value = await operation();
      if (typeof __DEV__ !== "undefined" && __DEV__) console.info("Startup operation succeeded", { operation: options.operationName, attempt, elapsedMs: Date.now() - startedAt, manual: Boolean(options.manual) });
      return value;
    } catch (error) {
      lastError = error;
      const classification = classifyStartupFailure(error);
      if (typeof __DEV__ !== "undefined" && __DEV__) console.info("Startup operation failed", { operation: options.operationName, attempt, elapsedMs: Date.now() - startedAt, kind: classification.kind, status: classification.status, transient: classification.transient, manual: Boolean(options.manual) });
      if (!classification.transient || attempt >= maxAttempts || options.isCurrent?.() === false) throw error;
      const jitter = Math.floor(Math.random() * 151);
      await sleep((options.baseDelayMs ?? 650) * attempt + jitter);
      if (options.isCurrent?.() === false) throw error;
    }
  }
  throw lastError;
}
