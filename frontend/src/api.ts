import AsyncStorage from "@react-native-async-storage/async-storage";

const configuredBase = process.env.EXPO_PUBLIC_BACKEND_URL?.trim().replace(/\/$/, "") || "";

if (!__DEV__ && (!configuredBase || !configuredBase.startsWith("https://"))) {
  throw new Error(
    "Fire Feast production builds require EXPO_PUBLIC_BACKEND_URL to be configured with an HTTPS URL.",
  );
}

const BASE = configuredBase;
const API = `${BASE}/api`;
const REQUEST_TIMEOUT_MS = 8000;

// 🔥 DEBUG LOGS (A.0 sanity check)
if (__DEV__) {
  console.log("Fire Feast API base:", BASE || "same-origin");
}

const INSTALLATION_KEY = "firefeast_installation_id";
const PLAYER_ID_KEY = "firefeast_player_id";
const AUTH_TOKEN_KEY = "firefeast_auth_token";
const LEGACY_PLAYER_ID_KEY = "chompchamps_device_id";
let bootstrapPlayerCache: unknown | undefined;
let credentialsPromise: Promise<GuestCredentials> | null = null;

type GuestCredentials = {
  playerId: string;
  authToken: string;
};

type GuestBootstrapResponse = {
  player: unknown;
  player_id: string;
  auth_token: string;
  migrated: boolean;
};

export class AuthenticationError extends Error {
  constructor(message = "Guest authentication failed.") {
    super(message);
    this.name = "AuthenticationError";
  }
}

class ApiRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
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
  bite_mechanic?: string;
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

  console.error("Contest response had an unexpected shape", {
    url: `${API}/contests`,
    status: 200,
    responseBody: response,
  });
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

async function readStoredCredentials(): Promise<GuestCredentials | null> {
  const values = await AsyncStorage.multiGet([PLAYER_ID_KEY, AUTH_TOKEN_KEY]);
  const playerId = values[0]?.[1]?.trim() || "";
  const authToken = values[1]?.[1]?.trim() || "";
  if (playerId && authToken) return { playerId, authToken };
  if (playerId || authToken) {
    throw new AuthenticationError(
      "Guest credentials are incomplete. Retry after restoring this app's local data.",
    );
  }
  return null;
}

async function ensureGuestCredentials(): Promise<GuestCredentials> {
  const stored = await readStoredCredentials();
  if (stored) return stored;
  if (credentialsPromise) return credentialsPromise;

  const legacyPlayerId = await AsyncStorage.getItem(LEGACY_PLAYER_ID_KEY);
  if (legacyPlayerId) {
    throw new AuthenticationError(
      "A legacy guest profile was found. Its server progress is preserved, but it cannot be claimed securely from the formerly public player ID. Keep local data intact while a controlled recovery path is prepared; reinstalling creates a new guest account.",
    );
  }

  credentialsPromise = (async () => {
    const installationId = await getInstallationId();
    try {
      const response = await req(
        "/auth/guest",
        {
          method: "POST",
          body: JSON.stringify({ installation_id: installationId }),
        },
        false,
      ) as GuestBootstrapResponse;
      if (
        !response?.player_id
        || !response?.auth_token
        || typeof response.player_id !== "string"
        || typeof response.auth_token !== "string"
      ) {
        throw new AuthenticationError("The guest account response was invalid.");
      }
      const credentials = {
        playerId: response.player_id,
        authToken: response.auth_token,
      };
      await AsyncStorage.multiSet([
        [PLAYER_ID_KEY, credentials.playerId],
        [AUTH_TOKEN_KEY, credentials.authToken],
      ]);
      cacheBootstrapPlayer(response.player);
      return credentials;
    } catch (error) {
      if (error instanceof AuthenticationError) throw error;
      if (error instanceof ApiRequestError && error.status === 409) {
        throw new AuthenticationError(
          "Guest credentials were already issued but are not available on this installation. Local data must be restored or the app reinstalled to create a new guest.",
        );
      }
      throw error;
    }
  })().finally(() => {
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
async function req(path: string, opts: RequestInit = {}, authenticated = true) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const url = `${API}${path}`;
  let status: number | "not received" = "not received";
  let responseBody: unknown = "No response received";

  try {
    const credentials = authenticated ? await ensureGuestCredentials() : null;
    const res = await fetch(url, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(opts.headers as Record<string, string> | undefined),
        ...(credentials
          ? { Authorization: `Bearer ${credentials.authToken}` }
          : {}),
      },
      signal: controller.signal,
    });

    status = res.status;
    const text = await res.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    responseBody = data;

    if (!res.ok) {
      if (res.status === 401) {
        throw new AuthenticationError(
          "This guest account could not be authenticated. Retry without clearing local app data.",
        );
      }
      throw new ApiRequestError(
        res.status,
        `HTTP ${res.status}: ${JSON.stringify(data)}`,
      );
    }

    return data;
  } catch (err: any) {
    if (path === "/contests") {
      console.error("Contest request failed", {
        url,
        status,
        responseBody,
      });
    }

    if (err?.name === "AbortError") {
      const timeoutError = new Error(
        `Request timed out after ${REQUEST_TIMEOUT_MS}ms for ${path}`
      );
      console.error(`API timeout: ${path}`);
      throw timeoutError;
    }

    console.error(`API error: ${path}`, err?.message || err);
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
    contest_id: string;
    score: number;
    duration_sec: number;
    won: boolean;
    opponent_id: string;
    tums_used: number;
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
