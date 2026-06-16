import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "";
const API = `${BASE}/api`;

const DEVICE_KEY = "chompchamps_device_id";

export async function getDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    await AsyncStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

async function req(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

export const api = {
  getPlayer: async () => {
    const id = await getDeviceId();
    return req(`/player`, { method: "POST", body: JSON.stringify({ device_id: id }) });
  },
  updatePlayer: async (data: { username?: string; country?: string; avatar_emoji?: string }) => {
    const id = await getDeviceId();
    return req(`/player/${id}`, { method: "PATCH", body: JSON.stringify(data) });
  },
  equipGear: async (gear_id: string | null) => {
    const id = await getDeviceId();
    return req(`/player/equip`, { method: "POST", body: JSON.stringify({ device_id: id, gear_id }) });
  },
  markTutorialDone: async () => {
    const id = await getDeviceId();
    return req(`/player/tutorial_done`, { method: "POST", body: JSON.stringify({ device_id: id }) });
  },
  listContests: () => req(`/contests`),
  startMatch: async (contest_id: string) => {
    const id = await getDeviceId();
    return req(`/match/start`, { method: "POST", body: JSON.stringify({ device_id: id, contest_id }) });
  },
  submitResult: async (payload: { contest_id: string; score: number; duration_sec: number; won: boolean; opponent_id: string; tums_used: number; is_tournament?: boolean }) => {
    const id = await getDeviceId();
    return req(`/match/result`, { method: "POST", body: JSON.stringify({ device_id: id, is_tournament: false, ...payload }) });
  },
  leaderboard: () => req(`/leaderboard`),
  shop: () => req(`/shop`),
  gear: () => req(`/gear`),
  purchase: async (item_id: string) => {
    const id = await getDeviceId();
    return req(`/purchase`, { method: "POST", body: JSON.stringify({ device_id: id, item_id }) });
  },
  trashTalk: (body: { opponent_id: string; contest_id: string; event: string; player_score?: number; opponent_score?: number }) =>
    req(`/trashtalk`, { method: "POST", body: JSON.stringify(body) }),
  dailyStatus: async () => {
    const id = await getDeviceId();
    return req(`/daily/status/${id}`);
  },
  dailyClaim: async () => {
    const id = await getDeviceId();
    return req(`/daily/claim`, { method: "POST", body: JSON.stringify({ device_id: id }) });
  },
  tournament: () => req(`/tournament`),
};
