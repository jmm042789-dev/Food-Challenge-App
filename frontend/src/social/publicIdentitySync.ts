import { api } from "../api";
import type { PlayerIdentity } from "../profile/PlayerIdentity";
import { storage } from "../utils/storage";

const PENDING_SOCIAL_SYNC_KEY = "fire_feast_pending_social_identity_v1";
let syncInFlight: Promise<boolean> | null = null;
let pendingIdentity: PlayerIdentity | null = null;

async function performSync(identity: PlayerIdentity): Promise<boolean> {
  const safe = { version: 4 as const, gamerName: identity.gamerName, avatar: identity.avatar };
  await storage.setItem(PENDING_SOCIAL_SYNC_KEY, JSON.stringify(safe));
  try {
    await api.updatePublicProfile({ display_name: safe.gamerName, avatar: safe.avatar });
    await storage.removeItem(PENDING_SOCIAL_SYNC_KEY);
    return true;
  } catch {
    return false;
  }
}

export function syncPublicIdentity(identity: PlayerIdentity): Promise<boolean> {
  pendingIdentity = identity;
  if (syncInFlight) return syncInFlight;
  const current = (async () => {
    let succeeded = true;
    while (pendingIdentity) {
      const next = pendingIdentity;
      pendingIdentity = null;
      succeeded = await performSync(next);
    }
    return succeeded;
  })().finally(() => { syncInFlight = null; });
  syncInFlight = current;
  return current;
}

export async function retryPendingPublicIdentitySync(): Promise<boolean> {
  const raw = await storage.getItem(PENDING_SOCIAL_SYNC_KEY, "");
  if (!raw) return true;
  try {
    return syncPublicIdentity(JSON.parse(raw) as PlayerIdentity);
  } catch {
    await storage.removeItem(PENDING_SOCIAL_SYNC_KEY);
    return false;
  }
}

export { PENDING_SOCIAL_SYNC_KEY };
