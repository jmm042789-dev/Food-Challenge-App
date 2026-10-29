import { storage } from "../utils/storage";

export type AvatarCategory = "base" | "hair" | "eyes" | "facialHair" | "glasses" | "headwear" | "clothing" | "apron" | "outfitColor" | "accessory" | "background";
export type AvatarPresentation = "male" | "female" | "non_binary";
export type AvatarOption = { id: string; label: string; preview: string; color?: string; secondaryColor?: string };
export type AvatarConfiguration = Record<AvatarCategory, string> & { presentation: AvatarPresentation; skinToneValue: number; hairColorValue: number };
export type PlayerIdentity = { version: 4; gamerName: string; avatar: AvatarConfiguration };
export type AvatarPreset = { id: string; name: string; tagline: string; avatar: AvatarConfiguration };
const STORAGE_KEY = "fire_feast_player_identity_v1";
const option = (value: string): AvatarOption => { const [id, label] = value.split(":"); return { id, label, preview: label }; };
const color = (id: string, label: string, primary: string, secondary: string): AvatarOption => ({ id, label, preview: "COLOR", color: primary, secondaryColor: secondary });

export const AVATAR_OPTIONS: Record<AvatarCategory, readonly AvatarOption[]> = {
  base: ["round:Round", "angular:Angular", "soft:Soft", "oval:Oval", "square:Square"].map(option),
  hair: ["short:Clean Cut", "spiked:Flame Spike", "curls:Arena Curls", "long:Long Flow", "shaved:Close Buzz", "mohawk:Heat Hawk", "fade:Precision Fade", "waves:Victory Waves", "braids:Feast Braids", "ponytail:Power Ponytail"].map(option),
  eyes: ["bright:Bright", "focused:Focused", "happy:Joyful", "bold:Confident", "wink:Playful", "intense:Intense"].map(option),
  facialHair: ["none:Clean Shaven", "stubble:Stubble", "mustache:Mustache", "goatee:Goatee", "beard:Short Beard", "full_beard:Full Beard"].map(option),
  glasses: ["none:None", "round:Round Glasses", "square:Square Glasses", "arcade:Arcade Frames", "shades:Tinted Shades", "sport:Sport Shades"].map(option),
  headwear: ["none:None", "cap:Arena Cap", "back_cap:Backwards Cap", "chef:Chef Toque", "bandana:Bandana", "visor:Service Visor", "flame:Flame Band", "crown:Champion Crown"].map(option),
  clothing: ["shirt:Fire Feast Tee", "hoodie:Arena Hoodie", "jacket:Victory Jacket", "chefcoat:Chef Coat", "classic:Classic Uniform", "street:Street Food Cook", "grill:Grill Master", "champion:Championship Coat"].map(option),
  apron: ["none:No Apron", "classic:Classic Bib", "waist:Waist Apron", "competition:Competition Apron", "grill:Heavy Grill Apron", "trimmed:Premium Trim", "tester:Tester Apron"].map(option),
  outfitColor: [color("inferno", "Inferno", "#A43A18", "#F08332"), color("charcoal", "Charcoal", "#30282B", "#806A69"), color("gold", "Champion Gold", "#A66B18", "#F1BD4B"), color("cream", "Chef Cream", "#DED0BB", "#FFF1DC"), color("emerald", "Emerald", "#176052", "#42A98B"), color("royal", "Royal", "#47306E", "#A17AD6"), color("ocean", "Ocean", "#235B7B", "#6BB5DB"), color("berry", "Berry", "#713B60", "#D27FB1")],
  accessory: ["none:None", "earring:Gold Stud", "hoops:Arena Hoops", "necklace:Feast Chain", "scarf:Chef Scarf", "badge:Competitor Badge", "medal:Champion Medal", "bandage:Victory Mark", "wristband:Heat Band"].map(option),
  background: [color("inferno", "Inferno", "#5E170F", "#D74A1E"), color("sunset", "Sunset", "#71301D", "#E99138"), color("midnight", "Midnight", "#171525", "#62568E"), color("emerald", "Emerald", "#12372F", "#3B9A78"), color("royal", "Royal", "#2E1A50", "#8C5BC3"), color("steel", "Steel", "#24282E", "#7B8994"), color("ocean", "Ocean", "#112F45", "#3A8DB8"), color("champion", "Champion", "#4C3210", "#E4B542")],
};

export const PRESENTATION_OPTIONS: readonly { id: AvatarPresentation; label: string }[] = [{ id: "male", label: "Male" }, { id: "female", label: "Female" }, { id: "non_binary", label: "Non-binary" }];
const SKIN_STOPS = ["#F6DCCB", "#E8BE9D", "#D39A70", "#B6754F", "#8B563B", "#603A2D", "#3F2722"] as const;
const HAIR_STOPS = ["#171419", "#4A2B24", "#8A4A2B", "#D6A04A", "#D94B28", "#D7D2C8", "#426FA8", "#724A99", "#2F8A68", "#E36C28"] as const;
const LEGACY_SKIN: Record<string, number> = { porcelain: 5, warm: 23, bronze: 45, deep: 72, rich: 92 };
const LEGACY_HAIR: Record<string, number> = { midnight: 2, ember: 18, gold: 35, fire: 48, silver: 57, plum: 76 };
const LEGACY_ACCESSORY_APRON: Record<string, string> = { apron: "classic", competition_apron: "competition" };
export const clampAvatarSlider = (value: unknown, fallback: number) => Math.round(Math.min(100, Math.max(0, Number.isFinite(Number(value)) ? Number(value) : fallback)));
const channels = (value: string) => [1, 3, 5].map((index) => parseInt(value.slice(index, index + 2), 16));
const interpolate = (stops: readonly string[], value: number) => { const position = clampAvatarSlider(value, 0) / 100 * (stops.length - 1); const low = Math.floor(position); const high = Math.min(stops.length - 1, low + 1); const amount = position - low; const a = channels(stops[low]); const b = channels(stops[high]); return `#${a.map((channel, index) => Math.round(channel + (b[index] - channel) * amount).toString(16).padStart(2, "0")).join("")}`; };
export const resolveSkinTone = (value: number) => interpolate(SKIN_STOPS, value);
export const resolveHairColor = (value: number) => ({ color: interpolate(HAIR_STOPS, value), secondaryColor: interpolate(HAIR_STOPS, Math.min(100, value + 5)) });
export const skinToneLabel = (value: number) => ["Light", "Light-medium", "Medium", "Medium-deep", "Deep"][Math.min(4, Math.floor(clampAvatarSlider(value, 23) / 21))];
export const hairColorLabel = (value: number) => ["Black", "Dark brown", "Brown", "Blonde", "Red", "Silver", "Blue", "Purple", "Green", "Fire orange"][Math.min(9, Math.floor(clampAvatarSlider(value, 18) / 11))];

export const DEFAULT_AVATAR: AvatarConfiguration = { presentation: "non_binary", skinToneValue: 23, hairColorValue: 18, base: "angular", hair: "spiked", eyes: "focused", facialHair: "none", glasses: "none", headwear: "none", clothing: "shirt", apron: "classic", outfitColor: "inferno", accessory: "none", background: "inferno" };
export const DEFAULT_IDENTITY: PlayerIdentity = { version: 4, gamerName: "Hungry Hero", avatar: DEFAULT_AVATAR };
const preset = (id: string, name: string, tagline: string, values: Partial<AvatarConfiguration>): AvatarPreset => ({ id, name, tagline, avatar: { ...DEFAULT_AVATAR, ...values } });
export const AVATAR_PRESETS: readonly AvatarPreset[] = [
  preset("ember_ace", "Ember Ace", "Born for the spotlight", { presentation: "non_binary", skinToneValue: 25, hairColorValue: 48, hair: "spiked", eyes: "focused", clothing: "champion", apron: "competition", outfitColor: "inferno", background: "sunset" }),
  preset("midnight_pro", "Midnight Pro", "Cool under pressure", { presentation: "female", skinToneValue: 72, hairColorValue: 2, base: "soft", hair: "waves", eyes: "bright", glasses: "arcade", clothing: "hoodie", apron: "waist", outfitColor: "royal", background: "midnight" }),
  preset("golden_grill", "Golden Grill", "Arena champion energy", { presentation: "male", skinToneValue: 45, hairColorValue: 35, base: "square", hair: "mohawk", eyes: "bold", facialHair: "goatee", headwear: "crown", clothing: "grill", apron: "grill", outfitColor: "gold", background: "champion" }),
  preset("emerald_chef", "Emerald Chef", "Precision with personality", { presentation: "female", skinToneValue: 92, hairColorValue: 57, base: "oval", hair: "braids", eyes: "happy", headwear: "chef", clothing: "chefcoat", apron: "trimmed", outfitColor: "cream", background: "emerald" }),
  preset("royal_heat", "Royal Heat", "Fearless feast royalty", { presentation: "non_binary", skinToneValue: 5, hairColorValue: 76, hair: "ponytail", eyes: "wink", glasses: "round", clothing: "jacket", apron: "tester", outfitColor: "royal", accessory: "medal", background: "royal" }),
];

export function validateGamerName(value: string): { valid: boolean; normalized: string; error?: string } { const normalized = value.trim().replace(/\s+/g, " "); if (!normalized) return { valid: false, normalized, error: "Enter a gamer name." }; if (normalized.length < 3) return { valid: false, normalized, error: "Gamer names must be at least 3 characters." }; if (normalized.length > 20) return { valid: false, normalized, error: "Gamer names cannot exceed 20 characters." }; if (!/^[A-Za-z0-9_ ]+$/.test(normalized)) return { valid: false, normalized, error: "Use only letters, numbers, spaces, and underscores." }; return { valid: true, normalized }; }
const validOption = (category: AvatarCategory, id: unknown) => AVATAR_OPTIONS[category].some((item) => item.id === id);
export function sanitizeAvatar(value: Record<string, unknown> | null | undefined): AvatarConfiguration {
  const avatar = { ...DEFAULT_AVATAR };
  (Object.keys(AVATAR_OPTIONS) as AvatarCategory[]).forEach((category) => { if (validOption(category, value?.[category])) avatar[category] = value![category] as string; });
  if (!validOption("apron", value?.apron)) avatar.apron = LEGACY_ACCESSORY_APRON[String(value?.accessory)] ?? DEFAULT_AVATAR.apron;
  avatar.presentation = PRESENTATION_OPTIONS.some((item) => item.id === value?.presentation) ? value!.presentation as AvatarPresentation : DEFAULT_AVATAR.presentation;
  avatar.skinToneValue = clampAvatarSlider(value?.skinToneValue, LEGACY_SKIN[String(value?.skinTone)] ?? DEFAULT_AVATAR.skinToneValue);
  avatar.hairColorValue = clampAvatarSlider(value?.hairColorValue, LEGACY_HAIR[String(value?.hairColor)] ?? DEFAULT_AVATAR.hairColorValue);
  return avatar;
}
export function updateAvatarDraft(current: AvatarConfiguration, category: AvatarCategory, optionId: string): AvatarConfiguration { return validOption(category, optionId) ? { ...current, [category]: optionId } : current; }
export async function loadPlayerIdentity(): Promise<PlayerIdentity> { const serialized = await storage.getItem(STORAGE_KEY, ""); if (!serialized) return DEFAULT_IDENTITY; try { const stored = JSON.parse(serialized) as { gamerName?: unknown; avatar?: Record<string, unknown> }; const name = validateGamerName(typeof stored.gamerName === "string" ? stored.gamerName : ""); return { version: 4, gamerName: name.valid ? name.normalized : DEFAULT_IDENTITY.gamerName, avatar: sanitizeAvatar(stored.avatar) }; } catch { return DEFAULT_IDENTITY; } }
export async function savePlayerIdentity(identity: PlayerIdentity) { const name = validateGamerName(identity.gamerName); if (!name.valid) return { ok: false as const, error: name.error }; const next: PlayerIdentity = { version: 4, gamerName: name.normalized, avatar: sanitizeAvatar(identity.avatar) }; const saved = await storage.setItem(STORAGE_KEY, JSON.stringify(next)); return saved ? { ok: true as const, identity: next } : { ok: false as const, error: "Unable to save your profile." }; }
