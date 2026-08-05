import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { uuid } from "expo-modules-core";
import { joinApiPath, resolveApiBase } from "./apiBase";
import { applyPlayerBalanceResponse, clearPlayerBalance } from "./playerBalance";
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

// 🔥 DEBUG LOGS (A.0 sanity check)
if (__DEV__) {
  console.log("Fire Feast API base:", BASE);
}

const INSTALLATION_KEY = "firefeast_installation_id";
const CREDENTIALS_KEY = "firefeast_guest_credentials_v1";
const BOOTSTRAP_RECOVERY_NONCE_KEY = "firefeast_bootstrap_recovery_nonce_v1";
const BOOTSTRAP_RECOVERY_TOKEN_KEY = "firefeast_bootstrap_recovery_token_v1";
const BOOTSTRAP_COMPLETION_PENDING_KEY = "firefeast_bootstrap_completion_pending_v1";
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
let requestSequence = 0;
let coinMutationGeneration = 0;

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

export class AuthenticationError extends Error {
  localCredentialsCleared: boolean;
  requestId: string | null;

  constructor(
    message = "Guest authentication failed.",
    localCredentialsCleared = false,
    requestId: string | null = null,
  ) {
    super(message);
    this.name = "AuthenticationError";
    this.localCredentialsCleared = localCredentialsCleared;
    this.requestId = requestId;
  }
}

export function isAuthenticationError(error: unknown): error is AuthenticationError {
  return error instanceof AuthenticationError;
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
  const stored = await storage.secureGet(BOOTSTRAP_RECOVERY_TOKEN_KEY, null);
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
      throw new AuthenticationError(
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

async function readStoredCredentials(): Promise<GuestCredentials | null> {
  if (credentialsCache) return credentialsCache;

  const storedBundle = await storage.secureGet(CREDENTIALS_KEY, null);
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
    await Promise.all([
      storage.secureRemove(CREDENTIALS_KEY),
      AsyncStorage.multiRemove([CREDENTIALS_KEY, PLAYER_ID_KEY, AUTH_TOKEN_KEY]),
    ]);
    console.warn("Fire Feast auth storage contained an invalid credential bundle; cleared it.");
    return null;
  }

  // One-time migration from the former two-key format. Persisting the pair as
  // one JSON record prevents a player ID from one write being paired with a
  // token from another write after interruption or storage restoration.
  const values = await AsyncStorage.multiGet([PLAYER_ID_KEY, AUTH_TOKEN_KEY]);
  const playerId = values[0]?.[1]?.trim() || "";
  const authToken = values[1]?.[1]?.trim() || "";
  if (playerId && authToken) {
    const credentials = { playerId, authToken };
    await storeCredentials(credentials);
    return credentials;
  }
  if (playerId || authToken) {
    await AsyncStorage.multiRemove([PLAYER_ID_KEY, AUTH_TOKEN_KEY]);
    console.warn("Fire Feast auth storage contained an incomplete legacy pair; cleared it.");
  }
  return null;
}

async function storeCredentials(credentials: GuestCredentials): Promise<void> {
  const record: StoredGuestCredentials = {
    version: 1,
    player_id: credentials.playerId,
    auth_token: credentials.authToken,
  };
  const stored = await storage.secureSet(CREDENTIALS_KEY, JSON.stringify(record));
  if (!stored) {
    throw new AuthenticationError("Guest credentials could not be stored securely.");
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
): Promise<GuestCredentials> {
  const credentials = { playerId: playerId.trim(), authToken: authToken.trim() };
  if (!credentials.playerId || !credentials.authToken) {
    throw new AuthenticationError("The guest account response was invalid.");
  }
  await storeCredentials(credentials);
  await AsyncStorage.setItem(BOOTSTRAP_COMPLETION_PENDING_KEY, "true");
  await clearBootstrapRecoveryState();
  cacheBootstrapPlayer(player);
  await finishBootstrapRecovery(credentials);
  return credentials;
}

async function resolvePendingRecoverySession(authToken: string): Promise<GuestCredentials | null> {
  try {
    const response = await req("/auth/session", {
      headers: { Authorization: `Bearer ${authToken}` },
    }, false, false) as { player_id?: unknown; player?: unknown };
    if (typeof response.player_id !== "string" || !response.player_id.trim()) {
      throw new AuthenticationError("The guest recovery session response was invalid.");
    }
    return persistRecoveredCredentials(response.player_id, authToken, response.player);
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 401) return null;
    throw error;
  }
}

async function loadOrBootstrapCredentials(): Promise<GuestCredentials> {
  const stored = await readStoredCredentials();
  if (stored) {
    if (await AsyncStorage.getItem(BOOTSTRAP_COMPLETION_PENDING_KEY)) {
      await finishBootstrapRecovery(stored);
    }
    return stored;
  }
  const legacyPlayerId = await AsyncStorage.getItem(LEGACY_PLAYER_ID_KEY);
  if (legacyPlayerId) {
    throw new AuthenticationError(
      "A legacy guest profile was found. Its server progress is preserved, but it cannot be claimed securely from the formerly public player ID. Keep local data intact while a controlled recovery path is prepared; reinstalling creates a new guest account.",
    );
  }

  const installationId = await getInstallationId();
  const recovery = await getOrCreateBootstrapRecovery();
  const recoveredSession = await resolvePendingRecoverySession(recovery.authToken);
  if (recoveredSession) return recoveredSession;
  try {
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
      throw new AuthenticationError("The guest account response was invalid.");
    }
    const credentials = await persistRecoveredCredentials(
      response.player_id,
      response.auth_token,
      response.player,
    );
    if (__DEV__) {
      console.info("Fire Feast guest credentials created", {
        playerId: credentials.playerId,
        tokenLength: credentials.authToken.length,
      });
    }
    return credentials;
  } catch (error) {
    if (error instanceof AuthenticationError) throw error;
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
          throw new AuthenticationError("The guest recovery response was invalid.");
        }
        return persistRecoveredCredentials(
          recovered.player_id,
          recovery.authToken,
          recovered.player,
        );
      } catch (recoveryError) {
        if (
          recoveryError instanceof ApiRequestError
          && recoveryError.code === "GUEST_RECOVERY_EXPIRED"
        ) {
          throw new AuthenticationError(
            "Guest account recovery expired before credentials were saved. Clear Fire Feast app data to create a new guest account, or contact support if progress must be preserved.",
          );
        }
        if (
          recoveryError instanceof ApiRequestError
          && recoveryError.code === "GUEST_RECOVERY_USED"
        ) {
          const recoveredAfterLostResponse = await resolvePendingRecoverySession(recovery.authToken);
          if (recoveredAfterLostResponse) return recoveredAfterLostResponse;
        }
        throw recoveryError;
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
  credentialsPromise = loadOrBootstrapCredentials().finally(() => {
    credentialsPromise = null;
  });
  return credentialsPromise;
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

  recoveryPromise = (async () => {
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
        throw new AuthenticationError(
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
        throw new AuthenticationError(
          "The authentication recovery response was invalid.",
          false,
          requestId,
        );
      }
      const recovered = { playerId, authToken: rejected.authToken };
      await storeCredentials(recovered);
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
      throw new AuthenticationError(
        `Authentication recovery was unavailable (HTTP ${response.status}).`,
        false,
        requestId,
      );
    }

    console.warn("Fire Feast bearer token is invalid; clearing local guest state and re-bootstrapping.");
    await clearLocalGuestData();
    return ensureGuestCredentials();
  })().finally(() => {
    recoveryPromise = null;
  });

  return recoveryPromise;
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
      if (res.status === 401) {
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
        );
      }
      const detail = data && typeof data === "object"
        ? (data as { detail?: unknown }).detail
        : null;
      const code = detail && typeof detail === "object" && typeof (detail as { code?: unknown }).code === "string"
        ? (detail as { code: string }).code
        : null;
      throw new ApiRequestError(
        res.status,
        `HTTP ${res.status}: ${JSON.stringify(data)}`,
        code,
        requestId,
      );
    }

    if (authenticated && requestPath !== "/player/account") {
      await AsyncStorage.removeItem(DELETION_PENDING_KEY);
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

export const api = {
  // =========================
  // PLAYER
  // =========================
  getPlayer: async () => {
    const id = await getDeviceId();
    return req(`/player/${encodeURIComponent(id)}`);
  },

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
