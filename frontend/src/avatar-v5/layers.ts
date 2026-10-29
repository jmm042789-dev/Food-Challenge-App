// Named parts only: catalog entries cannot supply arbitrary numeric z-index values.
export const AVATAR_V5_LAYER_ORDER = Object.freeze([
  "background", "rearEffects", "rearGarmentAccessory", "rearHair", "bodySkin",
  "modestyUnderlayer", "socks", "bottoms", "shoes", "topsSleeves", "rearApronWaist",
  "outerGarmentFront", "apronFront", "rearNeckAccessory", "longHairFront",
  "faceSkinDetail", "facialFeatures", "facialHair", "frontHair", "eyewearRear",
  "headwear", "eyewearFront", "exposedHandsForearms", "wristAccessory",
  "foregroundNeckMisc", "heldAccessoryFront", "foregroundEffects",
] as const);
export type AvatarV5Layer = typeof AVATAR_V5_LAYER_ORDER[number];
const PASS_ORDER = Object.freeze(["fill", "shading", "highlight", "detail"] as const);
const compareIds = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
// Pure ordering. Unknown parts/passes are omitted, never assigned a fallback z-index.
export function sortAvatarV5Parts<T extends { id: string; layer: AvatarV5Layer }>(parts: readonly T[]): T[] {
  return parts.filter((part) => AVATAR_V5_LAYER_ORDER.includes(part.layer)).sort((a, b) =>
    AVATAR_V5_LAYER_ORDER.indexOf(a.layer) - AVATAR_V5_LAYER_ORDER.indexOf(b.layer)
    || compareIds(a.id, b.id));
}
export function sortAvatarV5Passes<T extends { id: string; treatment: typeof PASS_ORDER[number] }>(passes: readonly T[]): T[] {
  return passes.filter((pass) => PASS_ORDER.includes(pass.treatment)).sort((a, b) =>
    PASS_ORDER.indexOf(a.treatment) - PASS_ORDER.indexOf(b.treatment) || compareIds(a.id, b.id));
}
