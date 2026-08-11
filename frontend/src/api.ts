import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { uuid } from "expo-modules-core";
import { joinApiPath, resolveApiBase } from "./apiBase";
import { applyPlayerBalanceResponse, clearPlayerBalance } from "./playerBalance";
import {
  type AuthDiagnosticCode,
  classifyGuestAuthStorage,
  diagnosticCodeForHttp401,
  diagnosticCodeForUnknown,
  diagnosticMessage,
  isResetEligibleAuthCode,
  safeAuthRequestId,
} from "./guestAuthDiagnostics";
import { performLocalGuestReset } from "./guestAuthReset";
import { pendingSessionDisposition, shouldProbePendingRecovery } from "./guestAuthStartupPolicy";
import {
  ApiRequestError,
  readResponseRequestId,
  requestIdForError,
} from "./requestDiagnostics";
import { storage } from "./utils/storage";

export { ApiRequestError, readResponseRequestId } from "./requestDiagnostics";

type ExpoDevelopmentMetadata = {
  debuggerHost?: string;
  hostUri?: string;
};

const expoGoConfig = Constants.expoGoConfig as ExpoDevelopmentMetadata | null;
const classicManifest = Constants.manifest as ExpoDevelopmentMetadata | null;
const BASE = resolveApiBase({
  explicitUrl: process.env.EXPO_PUBLIC_BACKEND_URL,
  isDevelopment: __DEV__,
  expoHostUris: [
    Constants.expoConfig?.hostUri,
    expoGoConfig?.debuggerHost,
    classicManifest?.hostUri,
    classicManifest?.debuggerHost,
    Constants.linkingUri,
    Constants.experienceUrl,
  ],
});
const API = joinApiPath(BASE, "/api");
const REQUEST_TIMEOUT_MS = 8000;
export const AUTH_IMPLEMENTATION_VERSION = "guest-auth-state-v6";

// 🔥 DEBUG LOGS (A.0 sanity check)
if (__DEV__) {
  console.log("Fire Feast API base:", BASE);
}

const INSTALLATION_KEY = "firefeast_installation_id";
const CREDENTIALS_KEY = "firefeast_guest_credentials_v1";
const BOOTSTRAP_RECOVERY_NONCE_KEY = "firefeast_bootstrap_recovery_nonce_v1";
const BOOTSTRAP_RECOVERY_TOKEN_KEY = "firefeast_bootstrap_recovery_token_v1";
const BOOTSTRAP_COMPLETION_PENDING_KEY = "firefeast_bootstrap_completion_pending_v1";
const GUEST_RESET_PENDING_KEY = "firefeast_guest_reset_pending_v1";
const PLAYER_ID_KEY = "firefeast_player_id";
const AUTH_TOKEN_KEY = "firefeast_auth_token";
const LEGACY_PLAYER_ID_KEY = "chompchamps_device_id";
const DELETION_PENDING_KEY = "firefeast_account_deletion_pending";
const PLAYER_DATA_KEYS = [
  "fire_feast_achievements_v1",
  "fire_feast_daily_missions_v1",
  "fire_feast_restaurant_progress_v1",
  "fire_feast_title_progress_v1",
  "fire_feast_tournament_progress_v1",
];
let bootstrapPlayerCache: unknown | undefined;
let credentialsCache: GuestCredentials | null = null;
let credentialsPromise: Promise<GuestCredentials> | null = null;
let recoveryPromise: Promise<GuestCredentials> | null = null;
let resetPromise: Promise<unknown> | null = null;
let authStateGeneration = 0;
let confirmedResetBootstrapActive = false;
let requestSequence = 0;
let coinMutationGeneration = 0;
let authDiagnosticStage = "AUTH_STAGE_UNINITIALIZED";

function markAuthStage(stage: string): void {
  authDiagnosticStage = stage;
  console.info("Fire Feast auth stage", { stage });
}

type GuestCredentials = {
  playerId: string;
  authToken: string;
};

type StoredGuestCredentials = {
  version: 1;
  player_id: string;
  auth_token: string;
};

type GuestBootstrapResponse = {
  player: unknown;
  player_id: string;
  auth_token: string;
  migrated: boolean;
};

type GuestRecoveryResponse = {
  player: unknown;
  player_id: string;
  recovered: true;
};

type PendingRecoveryToken = {
  version: 1;
  auth_token: string;
};

type GuestResetJournal = {
  version: 1;
  stage: "confirmed" | "installation_created" | "credentials_persisted";
};

class AuthOperationSupersededError extends Error {
  constructor() {
    super("Guest authentication operation was superseded by a confirmed local reset.");
    this.name = "AuthOperationSupersededError";
  }
}

function assertCurrentAuthGeneration(generation: number): void {
  if (generation !== authStateGeneration) throw new AuthOperationSupersededError();
}

async function readResetJournal(): Promise<GuestResetJournal | null> {
  const raw = await AsyncStorage.getItem(GUEST_RESET_PENDING_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<GuestResetJournal>;
    if (
      parsed.version === 1
      && ["confirmed", "installation_created", "credentials_persisted"].includes(parsed.stage ?? "")
    ) return parsed as GuestResetJournal;
  } catch {
    // A malformed marker is still proof that a confirmed reset was interrupted.
  }
  return { version: 1, stage: "confirmed" };
}

export class AuthenticationError extends Error {
  code: AuthDiagnosticCode;
  localCredentialsCleared: boolean;
  requestId: string | null;
  stage: string;
  httpStatus: number | null;
  backendCode: string | null;

  constructor(
    message = "Guest authentication failed.",
    localCredentialsCleared = false,
    requestId: string | null = null,
    code: AuthDiagnosticCode = "AUTH_UNKNOWN",
    stage = authDiagnosticStage,
    httpStatus: number | null = null,
    backendCode: string | null = null,
  ) {
    super(message);
    this.name = "AuthenticationError";
    this.code = code;
    this.localCredentialsCleared = localCredentialsCleared;
    this.requestId = requestId;
    this.stage = stage;
    this.httpStatus = httpStatus;
    this.backendCode = backendCode;
  }
}

function authenticationError(
  code: AuthDiagnosticCode,
  message: string,
  requestId: string | null = null,
): AuthenticationError {
  return new AuthenticationError(message, false, requestId, code);
}

export function isAuthenticationError(error: unknown): error is AuthenticationError {
  return error instanceof AuthenticationError;
}

export function describeAuthenticationFailure(error: unknown): {
  code: AuthDiagnosticCode;
  message: string;
  requestId: string | null;
  canStartNewGuest: boolean;
  stage: string;
  httpStatus: number | null;
  backendCode: string | null;
  routeClass: string;
} {
  const code = error instanceof AuthenticationError
    ? error.code
    : diagnosticCodeForUnknown(error);
  return {
    code,
    message: diagnosticMessage(code),
    requestId: safeAuthRequestId(error),
    canStartNewGuest: isResetEligibleAuthCode(code),
    stage: error instanceof AuthenticationError ? error.stage : authDiagnosticStage,
    httpStatus: error instanceof AuthenticationError
      ? error.httpStatus
      : error instanceof ApiRequestError ? error.status : null,
    backendCode: error instanceof AuthenticationError
      ? error.backendCode
      : error instanceof ApiRequestError ? error.code : null,
    routeClass: authDiagnosticStage.includes("BOOTSTRAP")
      ? "POST /api/auth/guest"
      : authDiagnosticStage.includes("SESSION")
        ? "GET /api/auth/session"
        : authDiagnosticStage.includes("PLAYER")
          ? "GET /api/player/:playerId"
          : "startup authentication",
  };
}

export function publicAuthRuntimeDiagnostics(): {
  authImplementation: string;
  backendHost: string;
  stage: string;
} {
  let backendHost = "invalid";
  try { backendHost = new URL(BASE).host; } catch { /* Public diagnostic only. */ }
  return { authImplementation: AUTH_IMPLEMENTATION_VERSION, backendHost, stage: authDiagnosticStage };
}

export function cacheBootstrapPlayer(player: unknown): void {
  bootstrapPlayerCache = player;
}

export function consumeBootstrapPlayer(): unknown | undefined {
  const player = bootstrapPlayerCache;
  bootstrapPlayerCache = undefined;
  return player;
}

export function peekBootstrapPlayer(): unknown | undefined {
  return bootstrapPlayerCache;
}

async function clearLocalGuestData(): Promise<void> {
  await Promise.all([
    storage.secureRemove(CREDENTIALS_KEY),
    AsyncStorage.multiRemove([
      INSTALLATION_KEY,
      CREDENTIALS_KEY,
      PLAYER_ID_KEY,
      AUTH_TOKEN_KEY,
      LEGACY_PLAYER_ID_KEY,
      DELETION_PENDING_KEY,
      BOOTSTRAP_RECOVERY_NONCE_KEY,
      BOOTSTRAP_COMPLETION_PENDING_KEY,
      ...PLAYER_DATA_KEYS,
    ]),
  ]);
  await storage.secureRemove(BOOTSTRAP_RECOVERY_TOKEN_KEY);
  bootstrapPlayerCache = undefined;
  credentialsCache = null;
  clearPlayerBalance();
  credentialsPromise = null;
}

async function recoverPendingDeletionAfterUnauthorized(): Promise<boolean> {
  const pending = await AsyncStorage.getItem(DELETION_PENDING_KEY);
  if (!pending) return false;
  await clearLocalGuestData();
  return true;
}

export type BiteMechanic = "tap" | "rapid" | "swipe" | "hold_release";

export type Contest = {
  id: string;
  name: string;
  location: string;
  food: string;
  food_emoji: string;
  entry_fee: number;
  prize_pool: number;
  difficulty: string;
  duration_sec: number;
  image?: string;
  image_url?: string;
  bite_mechanic?: BiteMechanic;
  heartburn_per_bite?: number;
  color?: string;
  difficulty_color?: string;
  category?: string;
  artwork?: string;
  restaurant_name?: string;
  restaurant_logo_url?: string;
  restaurant_logo_asset?: string;
  restaurant_website_url?: string;
  menu_url?: string;
  address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  challenge_rules?: string;
  challenge_history?: string;
  sponsor_name?: string;
  sponsor_logo_url?: string;
  sponsor_message?: string;
  sponsored?: boolean;
  verified?: boolean;
  source_url?: string;
};

type ContestResponse = {
  contests?: Contest[];
  data?: Contest[];
};

export function parseContests(response: ContestResponse | Contest[]): Contest[] {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.contests)) {
    return response.contests;
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  if (__DEV__) {
    console.error("Contest response had an unexpected shape", {
      path: "/contests",
      status: 200,
      error: "unexpected response shape",
    });
  }
  return [];
}

/**
 * Get or create persistent device ID
 */
async function getInstallationId(): Promise<string> {
  let id = await AsyncStorage.getItem(INSTALLATION_KEY);

  if (!id) {
    // This value is only a private bootstrap idempotency key, never an
    // authentication credential. The server creates the cryptographic token.
    id = `install_${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
    await AsyncStorage.setItem(INSTALLATION_KEY, id);
  }

  return id;
}

function cryptographicSecret(): string {
  try {
    return `${uuid.v4()}${uuid.v4()}`.replace(/-/g, "");
  } catch {
    throw new AuthenticationError("Secure guest credential generation is unavailable on this device.");
  }
}

async function readPendingRecoveryToken(): Promise<string | null> {
  const result = await storage.secureRead<string>(BOOTSTRAP_RECOVERY_TOKEN_KEY);
  if (result.status === "unavailable") {
    throw authenticationError("AUTH_SECURESTORE_UNAVAILABLE", "Protected guest recovery storage is unavailable.");
  }
  const stored = result.value;
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored) as Partial<PendingRecoveryToken>;
    return parsed.version === 1 && typeof parsed.auth_token === "string" && parsed.auth_token
      ? parsed.auth_token
      : null;
  } catch {
    return null;
  }
}

async function getOrCreateBootstrapRecovery(): Promise<{ nonce: string; authToken: string }> {
  let nonce = await AsyncStorage.getItem(BOOTSTRAP_RECOVERY_NONCE_KEY);
  let authToken = await readPendingRecoveryToken();
  if (!nonce) {
    nonce = cryptographicSecret();
    await AsyncStorage.setItem(BOOTSTRAP_RECOVERY_NONCE_KEY, nonce);
    if (authToken) {
      await storage.secureRemove(BOOTSTRAP_RECOVERY_TOKEN_KEY);
      authToken = null;
    }
  }
  if (!authToken) {
    authToken = cryptographicSecret();
    const stored = await storage.secureSet(
      BOOTSTRAP_RECOVERY_TOKEN_KEY,
      JSON.stringify({ version: 1, auth_token: authToken } satisfies PendingRecoveryToken),
    );
    if (!stored) {
      throw authenticationError(
        "AUTH_SECURESTORE_UNAVAILABLE",
        "Guest recovery credentials could not be stored securely. No account was created; retry when secure storage is available.",
      );
    }
  }
  return { nonce, authToken };
}

async function clearBootstrapRecoveryState(): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(BOOTSTRAP_RECOVERY_NONCE_KEY),
    storage.secureRemove(BOOTSTRAP_RECOVERY_TOKEN_KEY),
  ]);
}

async function readStoredCredentials(generation = authStateGeneration): Promise<GuestCredentials | null> {
  assertCurrentAuthGeneration(generation);
  if (credentialsCache) return credentialsCache;

  const result = await storage.secureRead<string>(CREDENTIALS_KEY);
  assertCurrentAuthGeneration(generation);
  if (result.status === "unavailable") {
    throw authenticationError("AUTH_SECURESTORE_UNAVAILABLE", "Protected guest credential storage is unavailable.");
  }
  const storedBundle = result.value;
  if (storedBundle) {
    try {
      const parsed = JSON.parse(storedBundle) as Partial<StoredGuestCredentials>;
      const playerId = typeof parsed.player_id === "string" ? parsed.player_id.trim() : "";
      const authToken = typeof parsed.auth_token === "string" ? parsed.auth_token.trim() : "";
      if (parsed.version === 1 && playerId && authToken) {
        credentialsCache = { playerId, authToken };
        return credentialsCache;
      }
    } catch {
      // Invalid local authentication state is cleared below and re-bootstrapped.
    }
    throw authenticationError("AUTH_INVALID_RESPONSE", "The protected guest credential bundle is malformed.");
  }

  // One-time migration from the former two-key format. Persisting the pair as
  // one JSON record prevents a player ID from one write being paired with a
  // token from another write after interruption or storage restoration.
  const values = await AsyncStorage.multiGet([PLAYER_ID_KEY, AUTH_TOKEN_KEY]);
  const playerId = values[0]?.[1]?.trim() || "";
  const authToken = values[1]?.[1]?.trim() || "";
  if (playerId && authToken) {
    const credentials = { playerId, authToken };
    await storeCredentials(credentials, generation);
    return credentials;
  }
  if (playerId || authToken) {
    await AsyncStorage.multiRemove([PLAYER_ID_KEY, AUTH_TOKEN_KEY]);
    console.warn("Fire Feast auth storage contained an incomplete legacy pair; cleared it.");
  }
  return null;
}

async function storeCredentials(
  credentials: GuestCredentials,
  generation = authStateGeneration,
): Promise<void> {
  assertCurrentAuthGeneration(generation);
  const record: StoredGuestCredentials = {
    version: 1,
    player_id: credentials.playerId,
    auth_token: credentials.authToken,
  };
  const stored = await storage.secureSet(CREDENTIALS_KEY, JSON.stringify(record));
  assertCurrentAuthGeneration(generation);
  if (!stored) {
    throw authenticationError("AUTH_SECURESTORE_UNAVAILABLE", "Guest credentials could not be stored securely.");
  }
  await AsyncStorage.multiRemove([PLAYER_ID_KEY, AUTH_TOKEN_KEY]);
  credentialsCache = credentials;
}

async function finishBootstrapRecovery(credentials: GuestCredentials): Promise<void> {
  try {
    await req("/auth/guest/complete", {
      method: "POST",
      headers: { Authorization: `Bearer ${credentials.authToken}` },
    }, false, false);
    await AsyncStorage.removeItem(BOOTSTRAP_COMPLETION_PENDING_KEY);
  } catch {
    // Durable bearer credentials remain valid. Retry server cleanup next launch.
  }
}

async function persistRecoveredCredentials(
  playerId: string,
  authToken: string,
  player: unknown,
  generation = authStateGeneration,
): Promise<GuestCredentials> {
  const credentials = { playerId: playerId.trim(), authToken: authToken.trim() };
  if (!credentials.playerId || !credentials.authToken) {
    throw authenticationError("AUTH_INVALID_RESPONSE", "The guest account response was invalid.");
  }
  await storeCredentials(credentials, generation);
  assertCurrentAuthGeneration(generation);
  await AsyncStorage.setItem(BOOTSTRAP_COMPLETION_PENDING_KEY, "true");
  await clearBootstrapRecoveryState();
  cacheBootstrapPlayer(player);
  await finishBootstrapRecovery(credentials);
  return credentials;
}

async function verifyFreshBootstrapSession(
  credentials: GuestCredentials,
): Promise<GuestCredentials> {
  markAuthStage(confirmedResetBootstrapActive
    ? "RESET_STAGE_SESSION_VERIFY"
    : "AUTH_STAGE_FRESH_SESSION_VERIFY");
  try {
    const session = await req("/auth/session", {}, true, false) as { player_id?: unknown };
    if (session.player_id !== credentials.playerId) {
      throw authenticationError(
        "AUTH_SESSION_VERIFY_FAILED",
        "The newly issued guest session did not match the created player.",
      );
    }
    return credentials;
  } catch (error) {
    if (error instanceof AuthenticationError && error.code === "AUTH_SESSION_VERIFY_FAILED") {
      throw error;
    }
    throw authenticationError(
      diagnosticCodeForUnknown(error) === "AUTH_NETWORK"
        ? "AUTH_NETWORK"
        : "AUTH_SESSION_VERIFY_FAILED",
      "The newly issued guest credential could not be verified.",
      safeAuthRequestId(error),
    );
  }
}

async function resolvePendingRecoverySession(
  authToken: string,
  generation = authStateGeneration,
): Promise<GuestCredentials | null> {
  try {
    const response = await req("/auth/session", {
      headers: { Authorization: `Bearer ${authToken}` },
    }, false, false) as { player_id?: unknown; player?: unknown };
    if (typeof response.player_id !== "string" || !response.player_id.trim()) {
      throw authenticationError("AUTH_INVALID_RESPONSE", "The guest recovery session response was invalid.");
    }
    return persistRecoveredCredentials(response.player_id, authToken, response.player, generation);
  } catch (error) {
    if (
      error instanceof ApiRequestError
      && pendingSessionDisposition({ authenticated: false, httpStatus: error.status }) === "CONTINUE_BOOTSTRAP"
    ) return null;
    if (
      error instanceof AuthenticationError
      && pendingSessionDisposition({ authenticated: false, httpStatus: error.httpStatus }) === "CONTINUE_BOOTSTRAP"
      && error.stage === "AUTH_STAGE_PENDING_SESSION_CHECK"
    ) return null;
    throw error;
  }
}

async function loadOrBootstrapCredentials(generation: number): Promise<GuestCredentials> {
  markAuthStage("AUTH_STAGE_LOADING_LOCAL");
  assertCurrentAuthGeneration(generation);
  const resetJournal = confirmedResetBootstrapActive ? null : await readResetJournal();
  if (resetJournal?.stage === "confirmed") {
    throw authenticationError(
      "AUTH_RESET_INTERRUPTED",
      "A previously confirmed local guest reset did not finish.",
    );
  }
  const stored = await readStoredCredentials(generation);
  assertCurrentAuthGeneration(generation);
  if (stored) {
    markAuthStage("AUTH_STAGE_LOCAL_CREDENTIALS");
    if (await AsyncStorage.getItem(BOOTSTRAP_COMPLETION_PENDING_KEY)) {
      await finishBootstrapRecovery(stored);
    }
    return stored;
  }
  const [legacyPlayerId, existingInstallationId, existingRecoveryNonce] = await Promise.all([
    AsyncStorage.getItem(LEGACY_PLAYER_ID_KEY),
    AsyncStorage.getItem(INSTALLATION_KEY),
    AsyncStorage.getItem(BOOTSTRAP_RECOVERY_NONCE_KEY),
  ]);
  const existingRecoveryToken = await readPendingRecoveryToken();
  const storageState = classifyGuestAuthStorage({
    credentialsPresent: false,
    installationPresent: Boolean(existingInstallationId),
    legacyPresent: Boolean(legacyPlayerId),
    recoveryNoncePresent: Boolean(existingRecoveryNonce),
    recoveryTokenPresent: Boolean(existingRecoveryToken),
    secureStoreAvailable: true,
  });
  if (legacyPlayerId) {
    throw authenticationError(
      "AUTH_LEGACY_STATE",
      "A legacy guest profile was found. Its server progress is preserved, but it cannot be claimed securely from the formerly public player ID. Keep local data intact while a controlled recovery path is prepared; reinstalling creates a new guest account.",
    );
  }

  const installationId = await getInstallationId();
  const hadPendingRecovery = shouldProbePendingRecovery({
    recoveryNoncePresent: Boolean(existingRecoveryNonce),
    recoveryTokenPresent: Boolean(existingRecoveryToken),
  });
  const recovery = await getOrCreateBootstrapRecovery();
  // A pending token is client-generated recovery material, not authentication.
  // It can be a bearer only after /auth/guest/recover atomically rotates the
  // server token and its response is lost. Probe only that interrupted state;
  // a brand-new token must proceed directly to guest bootstrap.
  if (hadPendingRecovery) {
    markAuthStage("AUTH_STAGE_PENDING_SESSION_CHECK");
    const recoveredSession = await resolvePendingRecoverySession(recovery.authToken, generation);
    if (recoveredSession) return recoveredSession;
  }
  try {
    markAuthStage("AUTH_STAGE_BOOTSTRAP_SENT");
    const response = await req(
      "/auth/guest",
      {
        method: "POST",
        body: JSON.stringify({
          installation_id: installationId,
          recovery_nonce: recovery.nonce,
        }),
      },
      false,
    ) as GuestBootstrapResponse;
    if (
      !response?.player_id
      || !response?.auth_token
      || typeof response.player_id !== "string"
      || typeof response.auth_token !== "string"
      || (
        response.player
        && typeof response.player === "object"
        && "player_id" in response.player
        && (response.player as { player_id?: unknown }).player_id !== response.player_id
      )
    ) {
      throw authenticationError("AUTH_INVALID_RESPONSE", "The guest account response was invalid.");
    }
    markAuthStage(confirmedResetBootstrapActive ? "RESET_STAGE_BOOTSTRAP_OK" : "AUTH_STAGE_BOOTSTRAP_OK");
    const credentials = await persistRecoveredCredentials(
      response.player_id,
      response.auth_token,
      response.player,
      generation,
    );
    markAuthStage(confirmedResetBootstrapActive
      ? "RESET_STAGE_CREDENTIALS_WRITTEN"
      : "AUTH_STAGE_BOOTSTRAP_CREDENTIALS_SAVED");
    if (__DEV__) {
      console.info("Fire Feast guest credentials created", {
        playerId: credentials.playerId,
        tokenLength: credentials.authToken.length,
      });
    }
    return verifyFreshBootstrapSession(credentials);
  } catch (error) {
    if (error instanceof AuthenticationError) throw error;
    if (error instanceof ApiRequestError && error.status === 401) {
      throw authenticationError(
        "AUTH_BOOTSTRAP_REJECTED",
        "New guest bootstrap was rejected before credentials were issued.",
        error.requestId,
      );
    }
    if (error instanceof ApiRequestError && error.code === "GUEST_BOOTSTRAP_EXISTS") {
      try {
        const recovered = await req("/auth/guest/recover", {
          method: "POST",
          body: JSON.stringify({
            installation_id: installationId,
            recovery_nonce: recovery.nonce,
            new_auth_token: recovery.authToken,
          }),
        }, false, false) as GuestRecoveryResponse;
        if (typeof recovered.player_id !== "string" || !recovered.player_id.trim()) {
          throw authenticationError("AUTH_INVALID_RESPONSE", "The guest recovery response was invalid.");
        }
        const recoveredCredentials = await persistRecoveredCredentials(
          recovered.player_id,
          recovery.authToken,
          recovered.player,
          generation,
        );
        return verifyFreshBootstrapSession(recoveredCredentials);
      } catch (recoveryError) {
        if (
          recoveryError instanceof ApiRequestError
          && recoveryError.code === "GUEST_RECOVERY_EXPIRED"
        ) {
          throw authenticationError(
            "AUTH_RECOVERY_EXPIRED",
            "Guest account recovery expired before credentials were saved. Clear Fire Feast app data to create a new guest account, or contact support if progress must be preserved.",
            recoveryError.requestId,
          );
        }
        if (
          recoveryError instanceof ApiRequestError
          && recoveryError.code === "GUEST_RECOVERY_USED"
        ) {
          const recoveredAfterLostResponse = await resolvePendingRecoverySession(recovery.authToken, generation);
          if (recoveredAfterLostResponse) return recoveredAfterLostResponse;
          throw authenticationError(
            "AUTH_RECOVERY_USED",
            "Guest account recovery was already used and no valid session remains.",
            recoveryError.requestId,
          );
        }
        if (recoveryError instanceof ApiRequestError) {
          if (recoveryError.code === "GUEST_RECOVERY_INVALID") {
            throw authenticationError(
              "AUTH_RECOVERY_INVALID",
              "The guest recovery credential is invalid.",
              recoveryError.requestId,
            );
          }
          if (recoveryError.status >= 500) throw recoveryError;
        }
        throw authenticationError(
          storageState === "INSTALLATION_WITHOUT_CREDENTIALS"
            ? "AUTH_SECURESTORE_MISSING"
            : "AUTH_BOOTSTRAP_CONFLICT",
          "A guest already exists for this installation and could not be recovered safely.",
          safeAuthRequestId(recoveryError),
        );
      }
    }
    throw error;
  }
}

async function ensureGuestCredentials(): Promise<GuestCredentials> {
  if (credentialsCache) return credentialsCache;
  if (credentialsPromise) return credentialsPromise;

  // Assign before the first asynchronous storage read so every concurrent
  // caller in this JavaScript runtime shares the exact same bootstrap.
  const generation = authStateGeneration;
  const pending = loadOrBootstrapCredentials(generation).finally(() => {
    if (credentialsPromise === pending) credentialsPromise = null;
  });
  credentialsPromise = pending;
  return pending;
}

export async function getDeviceId(): Promise<string> {
  return (await ensureGuestCredentials()).playerId;
}

/**
 * Safe request wrapper
 */
function diagnosticRequestPath(path: string): string {
  if (/^\/player\/[^/]+$/.test(path)) return "/player/:playerId";
  if (/^\/matchmaking\/status\/[^/]+$/.test(path)) {
    return "/matchmaking/status/:playerId";
  }
  return path;
}

function rewriteRequestForRecoveredPlayer(
  path: string,
  opts: RequestInit,
  previousPlayerId: string,
  recoveredPlayerId: string,
): { path: string; opts: RequestInit } {
  const rewrittenPath = path.replace(
    encodeURIComponent(previousPlayerId),
    encodeURIComponent(recoveredPlayerId),
  );
  if (typeof opts.body !== "string" || !opts.body) {
    return { path: rewrittenPath, opts };
  }
  try {
    const body = JSON.parse(opts.body) as Record<string, unknown>;
    for (const key of ["device_id", "player_id"]) {
      if (body[key] === previousPlayerId) body[key] = recoveredPlayerId;
    }
    return {
      path: rewrittenPath,
      opts: { ...opts, body: JSON.stringify(body) },
    };
  } catch {
    return { path: rewrittenPath, opts };
  }
}

function alignRequestWithCredentials(
  path: string,
  opts: RequestInit,
  credentials: GuestCredentials,
): { path: string; opts: RequestInit } {
  const playerPath = /^\/player\/guest_[a-f0-9]{32}$/i.test(path)
    ? `/player/${encodeURIComponent(credentials.playerId)}`
    : path;
  const rewrittenPath = playerPath.replace(
    /^\/(daily\/status|matchmaking\/status)\/[^/]+$/,
    (_match, route: string) => `/${route}/${encodeURIComponent(credentials.playerId)}`,
  );
  if (typeof opts.body !== "string" || !opts.body) {
    return { path: rewrittenPath, opts };
  }
  try {
    const body = JSON.parse(opts.body) as Record<string, unknown>;
    for (const key of ["device_id", "player_id"]) {
      if (typeof body[key] === "string") body[key] = credentials.playerId;
    }
    return {
      path: rewrittenPath,
      opts: { ...opts, body: JSON.stringify(body) },
    };
  } catch {
    return { path: rewrittenPath, opts };
  }
}

async function recoverCredentialsAfterUnauthorized(
  rejected: GuestCredentials,
): Promise<GuestCredentials> {
  if (recoveryPromise) return recoveryPromise;

  const generation = authStateGeneration;
  const pendingRecovery = (async () => {
    if (__DEV__) {
      console.warn("Fire Feast authentication rejected; attempting session recovery", {
        requestedPlayerId: rejected.playerId,
        tokenLength: rejected.authToken.length,
      });
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(`${API}/auth/session`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${rejected.authToken}`,
        },
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw authenticationError(
          "AUTH_NETWORK",
          `Authentication recovery timed out after ${REQUEST_TIMEOUT_MS}ms.`,
        );
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }

    const requestId = readResponseRequestId(response);

    if (response.ok) {
      const data = await response.json() as {
        player_id?: unknown;
        player?: unknown;
      };
      const playerId = typeof data.player_id === "string" ? data.player_id.trim() : "";
      if (!playerId) {
        throw authenticationError(
          "AUTH_INVALID_RESPONSE",
          "The authentication recovery response was invalid.",
          requestId,
        );
      }
      const recovered = { playerId, authToken: rejected.authToken };
      await storeCredentials(recovered, generation);
      if (data.player) cacheBootstrapPlayer(data.player);
      if (__DEV__) {
        console.info("Fire Feast authentication session repaired", {
          previousPlayerId: rejected.playerId,
          authenticatedPlayerId: recovered.playerId,
        });
      }
      return recovered;
    }

    if (response.status !== 401) {
      throw authenticationError(
        response.status >= 500 ? "AUTH_NETWORK" : "AUTH_UNKNOWN",
        `Authentication recovery was unavailable (HTTP ${response.status}).`,
        requestId,
      );
    }

    throw authenticationError(
      "AUTH_BEARER_REJECTED",
      "The saved guest bearer credential was rejected.",
      requestId,
    );
  })().finally(() => {
    if (recoveryPromise === pendingRecovery) recoveryPromise = null;
  });
  recoveryPromise = pendingRecovery;
  return pendingRecovery;
}

async function req(
  path: string,
  opts: RequestInit = {},
  authenticated = true,
  allowAuthenticationRecovery = true,
) {
  const sequence = ++requestSequence;
  const method = (opts.method ?? "GET").toUpperCase();
  const isMutation = authenticated && method !== "GET";
  if (isMutation) coinMutationGeneration += 1;
  const mutationGenerationAtStart = coinMutationGeneration;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let url = `${API}${path}`;
  let requestPath = path;
  let status: number | "not received" = "not received";
  let requestId: string | null = null;

  try {
    const credentials = authenticated ? await ensureGuestCredentials() : null;
    const aligned = credentials
      ? alignRequestWithCredentials(path, opts, credentials)
      : { path, opts };
    requestPath = aligned.path;
    url = `${API}${requestPath}`;
    const res = await fetch(url, {
      ...aligned.opts,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(aligned.opts.headers as Record<string, string> | undefined),
        ...(credentials
          ? { Authorization: `Bearer ${credentials.authToken}` }
          : {}),
      },
      signal: controller.signal,
    });

    status = res.status;
    requestId = readResponseRequestId(res);
    const text = await res.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    if (!res.ok) {
      const detail = data && typeof data === "object"
        ? (data as { detail?: unknown }).detail
        : null;
      const code = detail && typeof detail === "object" && typeof (detail as { code?: unknown }).code === "string"
        ? (detail as { code: string }).code
        : null;
      if (res.status === 401) {
        if (!authenticated) {
          throw new AuthenticationError(
            "An unauthenticated authentication request was rejected.",
            false,
            requestId,
            diagnosticCodeForHttp401(requestPath, false),
            authDiagnosticStage,
            res.status,
            code,
          );
        }
        const recoveredDeletion = await recoverPendingDeletionAfterUnauthorized();
        if (!recoveredDeletion && authenticated && credentials && allowAuthenticationRecovery) {
          const recovered = await recoverCredentialsAfterUnauthorized(credentials);
          const rewritten = rewriteRequestForRecoveredPlayer(
            requestPath,
            aligned.opts,
            credentials.playerId,
            recovered.playerId,
          );
          return req(rewritten.path, rewritten.opts, true, false);
        }
        throw new AuthenticationError(
          recoveredDeletion
            ? "The deleted guest account was cleared from this device. Restart to create a new guest."
            : "This guest account could not be authenticated. Retry without clearing local app data.",
          recoveredDeletion,
          requestId,
          recoveredDeletion ? "AUTH_UNKNOWN" : "AUTH_BEARER_REJECTED",
        );
      }
      throw new ApiRequestError(
        res.status,
        `HTTP ${res.status}: ${JSON.stringify(data)}`,
        code,
        requestId,
      );
    }

    if (authenticated && requestPath !== "/player/account") {
      await AsyncStorage.removeItem(DELETION_PENDING_KEY);
      if (!resetPromise) await AsyncStorage.removeItem(GUEST_RESET_PENDING_KEY);
    }
    if (isMutation) {
      coinMutationGeneration += 1;
      applyPlayerBalanceResponse(data, sequence, true);
    } else if (mutationGenerationAtStart === coinMutationGeneration) {
      applyPlayerBalanceResponse(data, sequence);
    }
    if (__DEV__) {
      const response = data && typeof data === "object" ? data as Record<string, unknown> : {};
      const nestedPlayer = response.player && typeof response.player === "object"
        ? response.player as Record<string, unknown>
        : {};
      const responseCoins = response.new_coins
        ?? response.player_coins
        ?? response.coins
        ?? nestedPlayer.coins;
      if (responseCoins !== undefined) {
        console.log("Fire Feast coin response", {
          playerId: credentials?.playerId,
          path: diagnosticRequestPath(requestPath),
          coins: responseCoins,
          reward: response.coin_reward
            ?? (response.reward && typeof response.reward === "object"
              ? (response.reward as Record<string, unknown>).coins
              : undefined),
        });
      }
    }
    return data;
  } catch (err: any) {
    const diagnosticPath = diagnosticRequestPath(requestPath);

    if (err?.name === "AbortError") {
      const timeoutError = new Error(
        `Request timed out after ${REQUEST_TIMEOUT_MS}ms for ${diagnosticPath}`
      );
      if (__DEV__) {
        console.error("API request timed out", {
          method,
          path: diagnosticPath,
          requestId: null,
        });
      }
      throw timeoutError;
    }

    if (__DEV__) {
      console.error("API request failed", {
        method,
        path: diagnosticPath,
        status,
        requestId: requestIdForError(err, requestId),
        error: err instanceof AuthenticationError ? err.name : "request error",
      });
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function clearLocalGuestAuthenticationForReset(): Promise<void> {
  const previousCredentialPromise = credentialsPromise;
  const previousRecoveryPromise = recoveryPromise;
  authStateGeneration += 1;
  credentialsCache = null;
  credentialsPromise = null;
  recoveryPromise = null;
  bootstrapPlayerCache = undefined;
  clearPlayerBalance();

  // Dropping a promise reference does not cancel its work. Wait for every old
  // operation after invalidating its generation so it cannot repopulate
  // SecureStore or the in-memory cache after reset verification.
  await Promise.allSettled([
    previousCredentialPromise,
    previousRecoveryPromise,
  ].filter((value): value is Promise<GuestCredentials> => value !== null));

  const asyncKeys = [
      INSTALLATION_KEY,
      CREDENTIALS_KEY,
      PLAYER_ID_KEY,
      AUTH_TOKEN_KEY,
      LEGACY_PLAYER_ID_KEY,
      DELETION_PENDING_KEY,
      BOOTSTRAP_RECOVERY_NONCE_KEY,
      BOOTSTRAP_COMPLETION_PENDING_KEY,
      ...PLAYER_DATA_KEYS,
  ];
  try {
    await performLocalGuestReset({
      clearAsyncKeys: async () => {
        try { await AsyncStorage.multiRemove(asyncKeys); return true; } catch { return false; }
      },
      clearSecureCredentials: () => storage.secureRemove(CREDENTIALS_KEY),
      clearSecureRecovery: () => storage.secureRemove(BOOTSTRAP_RECOVERY_TOKEN_KEY),
      asyncKeysAreClear: async () => {
        try {
          const remaining = await AsyncStorage.multiGet(asyncKeys);
          return remaining.every(([, value]) => value === null);
        } catch { return false; }
      },
      secureCredentialsAreClear: async () => {
        const result = await storage.secureRead<string>(CREDENTIALS_KEY);
        return result.status === "available" && result.value === null;
      },
      secureRecoveryIsClear: async () => {
        const result = await storage.secureRead<string>(BOOTSTRAP_RECOVERY_TOKEN_KEY);
        return result.status === "available" && result.value === null;
      },
    });
  } catch {
    throw authenticationError(
      "AUTH_LOCAL_RESET_FAILED",
      "Local guest state could not be cleared completely; no new account was created.",
    );
  }
}

async function writeResetJournal(stage: GuestResetJournal["stage"]): Promise<void> {
  try {
    await AsyncStorage.setItem(
      GUEST_RESET_PENDING_KEY,
      JSON.stringify({ version: 1, stage } satisfies GuestResetJournal),
    );
  } catch {
    throw authenticationError(
      "AUTH_LOCAL_RESET_FAILED",
      "The confirmed guest reset could not be recorded safely.",
    );
  }
}

async function createFreshInstallationIdentity(): Promise<string> {
  const installationId = `install_${cryptographicSecret()}`;
  try {
    await AsyncStorage.setItem(INSTALLATION_KEY, installationId);
    const persisted = await AsyncStorage.getItem(INSTALLATION_KEY);
    if (persisted !== installationId) throw new Error("installation identity verification failed");
    return installationId;
  } catch {
    throw authenticationError(
      "AUTH_INSTALLATION_CREATE_FAILED",
      "A fresh installation identity could not be persisted.",
    );
  }
}

async function performConfirmedNewGuestReset(): Promise<unknown> {
  markAuthStage("RESET_STAGE_CONFIRMED");
  await writeResetJournal("confirmed");
  await clearLocalGuestAuthenticationForReset();
  markAuthStage("RESET_STAGE_STORAGE_CLEARED");
  await createFreshInstallationIdentity();
  markAuthStage("RESET_STAGE_INSTALL_CREATED");
  await writeResetJournal("installation_created");

  let credentials: GuestCredentials;
  confirmedResetBootstrapActive = true;
  try {
    credentials = await ensureGuestCredentials();
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof ApiRequestError) throw error;
    throw authenticationError(
      diagnosticCodeForUnknown(error),
      "The fresh guest bootstrap failed.",
      safeAuthRequestId(error),
    );
  } finally {
    confirmedResetBootstrapActive = false;
  }

  // Force subsequent verification to reload the exact persisted bundle. This
  // proves the new account does not depend on a stale module-level credential.
  credentialsCache = null;
  markAuthStage("RESET_STAGE_CREDENTIALS_RELOADED");
  const persisted = await readStoredCredentials(authStateGeneration);
  if (
    !persisted
    || persisted.playerId !== credentials.playerId
    || persisted.authToken !== credentials.authToken
  ) {
    throw authenticationError(
      "AUTH_CREDENTIAL_PERSIST_FAILED",
      "The fresh guest credentials were not persisted consistently.",
    );
  }
  await writeResetJournal("credentials_persisted");

  let session: { player_id?: unknown };
  try {
    markAuthStage("RESET_STAGE_SESSION_VERIFY");
    session = await req("/auth/session", {}, true, false) as { player_id?: unknown };
  } catch (error) {
    throw authenticationError(
      diagnosticCodeForUnknown(error) === "AUTH_NETWORK"
        ? "AUTH_NETWORK"
        : "AUTH_SESSION_VERIFY_FAILED",
      "The fresh guest session could not be verified.",
      safeAuthRequestId(error),
    );
  }
  if (session.player_id !== credentials.playerId) {
    throw authenticationError("AUTH_SESSION_VERIFY_FAILED", "The fresh guest session did not match the created player.");
  }

  let player: unknown;
  try {
    markAuthStage("RESET_STAGE_PLAYER_VERIFY");
    player = await req(`/player/${encodeURIComponent(credentials.playerId)}`, {}, true, false);
  } catch (error) {
    throw authenticationError(
      diagnosticCodeForUnknown(error) === "AUTH_NETWORK"
        ? "AUTH_NETWORK"
        : "AUTH_SESSION_VERIFY_FAILED",
      "The fresh guest player could not be verified.",
      safeAuthRequestId(error),
    );
  }
  await AsyncStorage.removeItem(GUEST_RESET_PENDING_KEY);
  markAuthStage("RESET_STAGE_COMPLETE");
  return player;
}

async function startNewGuestAccount(): Promise<unknown> {
  if (resetPromise) return resetPromise;
  const pendingReset = performConfirmedNewGuestReset().finally(() => {
    if (resetPromise === pendingReset) resetPromise = null;
  });
  resetPromise = pendingReset;
  return pendingReset;
}

export const api = {
  // =========================
  // PLAYER
  // =========================
  getPlayer: async () => {
    markAuthStage("AUTH_STAGE_PLAYER_VERIFY");
    const id = await getDeviceId();
    const player = await req(`/player/${encodeURIComponent(id)}`);
    markAuthStage("AUTH_STAGE_AUTHENTICATED");
    return player;
  },

  startNewGuestAccount,

  updatePlayer: async (data: {
    username?: string;
    country?: string;
    avatar_emoji?: string;
  }) => {
    const id = await getDeviceId();
    return req(`/player/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  equipGear: async (gear_id: string | null) => {
    const id = await getDeviceId();
    return req(`/player/equip`, {
      method: "POST",
      body: JSON.stringify({ device_id: id, gear_id }),
    });
  },

  markTutorialDone: async () => {
    const id = await getDeviceId();
    return req(`/player/tutorial_done`, {
      method: "POST",
      body: JSON.stringify({ device_id: id }),
    });
  },

  deleteAccount: async (): Promise<{ deleted: true }> => {
    await AsyncStorage.setItem(DELETION_PENDING_KEY, "true");
    let response: { deleted?: unknown };
    try {
      response = await req("/player/account", {
        method: "DELETE",
        body: JSON.stringify({ confirmation: "DELETE" }),
      }) as { deleted?: unknown };
    } catch (error) {
      if (
        error instanceof AuthenticationError
        && error.localCredentialsCleared
      ) {
        return { deleted: true };
      }
      throw error;
    }
    if (response?.deleted !== true) {
      throw new Error("The account deletion response was invalid.");
    }
    await clearLocalGuestData();
    return { deleted: true };
  },

  claimWelcomeReward: async () => {
    const id = await getDeviceId();
    return req(`/player/welcome_reward`, {
      method: "POST",
      body: JSON.stringify({ device_id: id }),
    });
  },

  // =========================
  // GAME DATA
  // =========================
  listContests: () => req(`/contests`, {}, false),

  startMatch: async (contest_id: string) => {
    const id = await getDeviceId();
    return req(`/match/start`, {
      method: "POST",
      body: JSON.stringify({ device_id: id, contest_id }),
    });
  },

  submitResult: async (payload: {
    match_id: string;
    contest_id: string;
    score: number;
    opponent_score: number;
    duration_sec: number;
    accepted_taps: number;
    completed_progress: number;
    maximum_combo: number;
    opponent_id: string;
    tums_used: number;
    completion_reason: "timer_completed" | "challenge_completed" | "player_exited" | "other";
    is_tournament?: boolean;
  }) => {
    const id = await getDeviceId();
    return req(`/match/result`, {
      method: "POST",
      body: JSON.stringify({
        device_id: id,
        is_tournament: false,
        ...payload,
      }),
    });
  },

  activeMatch: () => req(`/match/active`) as Promise<{
    status: "resumable" | "expired" | "cancelled" | "rejected" | "settled" | "absent";
    match_id?: string;
    contest_id?: string;
    started_at?: string;
  }>,

  abandonMatch: () => req(`/match/abandon`, { method: "POST" }) as Promise<{
    status: "cancelled" | "expired" | "rejected" | "settled" | "absent";
  }>,

  leaderboard: () => req(`/leaderboard`, {}, false),

  shop: () => req(`/shop`, {}, false),
  gear: () => req(`/gear`, {}, false),

  purchase: async (item_id: string) => {
    const id = await getDeviceId();
    return req(`/purchase`, {
      method: "POST",
      body: JSON.stringify({ device_id: id, item_id }),
    });
  },

  trashTalk: (body: {
    opponent_id: string;
    contest_id: string;
    event: string;
    player_score?: number;
    opponent_score?: number;
  }) =>
    req(`/trashtalk`, {
      method: "POST",
      body: JSON.stringify(body),
    }, false),

  dailyStatus: async () => {
    const id = await getDeviceId();
    return req(`/daily/status/${id}`);
  },

  dailyClaim: async () => {
    const id = await getDeviceId();
    return req(`/daily/claim`, {
      method: "POST",
      body: JSON.stringify({ device_id: id }),
    });
  },

  tournament: () => req(`/tournament`, {}, false),

  // =========================
  // 🧠 MATCHMAKING (A.5)
  // =========================
  matchmakingJoin: async () => {
    const id = await getDeviceId();
    return req(`/matchmaking/join`, {
      method: "POST",
      body: JSON.stringify({ device_id: id }),
    });
  },

  matchmakingStatus: async () => {
    const id = await getDeviceId();
    return req(`/matchmaking/status/${id}`);
  },

  matchmakingLeave: async () => {
    const id = await getDeviceId();
    return req(`/matchmaking/leave`, {
      method: "POST",
      body: JSON.stringify({ device_id: id }),
    });
  },
};
