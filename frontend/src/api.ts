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

const DEVICE_KEY = "chompchamps_device_id";

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
export async function getDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(DEVICE_KEY);

  if (!id) {
    id = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    await AsyncStorage.setItem(DEVICE_KEY, id);
  }

  return id;
}

/**
 * Safe request wrapper
 */
async function req(path: string, opts: RequestInit = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const url = `${API}${path}`;
  let status: number | "not received" = "not received";
  let responseBody: unknown = "No response received";

  try {
    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      signal: controller.signal,
      ...opts,
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
      throw new Error(`HTTP ${res.status}: ${JSON.stringify(data)}`);
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
    return req(`/player`, {
      method: "POST",
      body: JSON.stringify({ device_id: id }),
    });
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
  listContests: () => req(`/contests`),

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

  leaderboard: () => req(`/leaderboard`),

  shop: () => req(`/shop`),
  gear: () => req(`/gear`),

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
    }),

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

  tournament: () => req(`/tournament`),

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
