import { storage } from "../utils/storage";

export type AvatarCategory = "base" | "hair" | "hairColor" | "eyes" | "skinTone" | "facialHair" | "glasses" | "headwear" | "clothing" | "accessory" | "background";
export type AvatarOption = { id: string; label: string; preview: string; color?: string };
export type AvatarConfiguration = Record<AvatarCategory, string>;
export type PlayerIdentity = { version: 1; gamerName: string; avatar: AvatarConfiguration };

const STORAGE_KEY = "fire_feast_player_identity_v1";

export const AVATAR_OPTIONS: Record<AvatarCategory, readonly AvatarOption[]> = {
  base: [{ id: "male", label: "Male", preview: "M" }, { id: "female", label: "Female", preview: "F" }, { id: "neutral", label: "Neutral", preview: "N" }],
  hair: [{ id: "short", label: "Short", preview: "▰" }, { id: "spiked", label: "Spiked", preview: "♠" }, { id: "curls", label: "Curls", preview: "〰" }, { id: "long", label: "Long", preview: "▥" }, { id: "shaved", label: "Shaved", preview: "·" }],
  hairColor: [{ id: "ember", label: "Ember", preview: "●", color: "#7B301F" }, { id: "midnight", label: "Midnight", preview: "●", color: "#211B20" }, { id: "gold", label: "Gold", preview: "●", color: "#D99A35" }, { id: "silver", label: "Silver", preview: "●", color: "#A9A7AA" }, { id: "fire", label: "Fire", preview: "●", color: "#E14B24" }],
  eyes: [{ id: "bright", label: "Bright", preview: "• •" }, { id: "focused", label: "Focused", preview: "› ‹" }, { id: "happy", label: "Happy", preview: "⌒ ⌒" }, { id: "bold", label: "Bold", preview: "● ●" }],
  skinTone: [{ id: "porcelain", label: "Porcelain", preview: "●", color: "#F4D2BD" }, { id: "warm", label: "Warm", preview: "●", color: "#DDA77D" }, { id: "bronze", label: "Bronze", preview: "●", color: "#B97852" }, { id: "deep", label: "Deep", preview: "●", color: "#754832" }, { id: "rich", label: "Rich", preview: "●", color: "#4B2D24" }],
  facialHair: [{ id: "none", label: "None", preview: "—" }, { id: "stubble", label: "Stubble", preview: "···" }, { id: "mustache", label: "Mustache", preview: "⌁" }, { id: "beard", label: "Beard", preview: "▼" }],
  glasses: [{ id: "none", label: "None", preview: "—" }, { id: "round", label: "Round", preview: "○-○" }, { id: "arcade", label: "Arcade", preview: "□-□" }, { id: "shades", label: "Shades", preview: "■ ■" }],
  headwear: [{ id: "none", label: "None", preview: "—" }, { id: "cap", label: "Cap", preview: "⌒" }, { id: "chef", label: "Chef Hat", preview: "♨" }, { id: "flame", label: "Flame Hat", preview: "🔥" }],
  clothing: [{ id: "shirt", label: "Fire Shirt", preview: "T", color: "#A43A18" }, { id: "hoodie", label: "Hoodie", preview: "H", color: "#3A2928" }, { id: "jacket", label: "Jacket", preview: "J", color: "#8B5A24" }, { id: "chefcoat", label: "Chef Coat", preview: "C", color: "#E6D8C6" }],
  accessory: [{ id: "none", label: "None", preview: "—" }, { id: "earring", label: "Earring", preview: "◇" }, { id: "necklace", label: "Necklace", preview: "⌄" }, { id: "wristband", label: "Wristband", preview: "▮" }],
  background: [{ id: "inferno", label: "Inferno", preview: "●", color: "#6E1D13" }, { id: "sunset", label: "Sunset", preview: "●", color: "#8B4A22" }, { id: "midnight", label: "Midnight", preview: "●", color: "#19172C" }, { id: "emerald", label: "Emerald", preview: "●", color: "#173E34" }, { id: "royal", label: "Royal", preview: "●", color: "#35205C" }],
};

export const DEFAULT_AVATAR: AvatarConfiguration = {
  base: "neutral", hair: "spiked", hairColor: "ember", eyes: "bright", skinTone: "warm",
  facialHair: "none", glasses: "none", headwear: "none", clothing: "shirt", accessory: "none", background: "inferno",
};
export const DEFAULT_IDENTITY: PlayerIdentity = { version: 1, gamerName: "Hungry Hero", avatar: DEFAULT_AVATAR };

export function validateGamerName(value: string): { valid: boolean; normalized: string; error?: string } {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) return { valid: false, normalized, error: "Enter a gamer name." };
  if (normalized.length < 3) return { valid: false, normalized, error: "Gamer names must be at least 3 characters." };
  if (normalized.length > 20) return { valid: false, normalized, error: "Gamer names cannot exceed 20 characters." };
  if (!/^[A-Za-z0-9_ ]+$/.test(normalized)) return { valid: false, normalized, error: "Use only letters, numbers, spaces, and underscores." };
  return { valid: true, normalized };
}

function validOption(category: AvatarCategory, id: unknown) {
  return AVATAR_OPTIONS[category].some((option) => option.id === id);
}

export async function loadPlayerIdentity(): Promise<PlayerIdentity> {
  const serialized = await storage.getItem(STORAGE_KEY, "");
  if (!serialized) return DEFAULT_IDENTITY;
  try {
    const stored = JSON.parse(serialized) as Partial<PlayerIdentity>;
    const avatar = { ...DEFAULT_AVATAR };
    (Object.keys(avatar) as AvatarCategory[]).forEach((category) => {
      const id = stored.avatar?.[category];
      if (validOption(category, id)) avatar[category] = id!;
    });
    const name = validateGamerName(stored.gamerName ?? "");
    return { version: 1, gamerName: name.valid ? name.normalized : DEFAULT_IDENTITY.gamerName, avatar };
  } catch {
    return DEFAULT_IDENTITY;
  }
}

export async function savePlayerIdentity(identity: PlayerIdentity) {
  const name = validateGamerName(identity.gamerName);
  if (!name.valid) return { ok: false as const, error: name.error };
  const next = { ...identity, version: 1 as const, gamerName: name.normalized };
  const saved = await storage.setItem(STORAGE_KEY, JSON.stringify(next));
  return saved ? { ok: true as const, identity: next } : { ok: false as const, error: "Unable to save your profile." };
}
