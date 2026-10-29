import type { AvatarV5GearVisibility } from "./loadout";
import type { AvatarV5EquipmentVisualInput } from "./types";

export type AvatarV5EquipmentMapping = Readonly<{
  backendId: string;
  slot: "hat" | "apron" | "outfit";
  kind: "performance" | "cosmetic";
  // null is explicitly pending art, not a fake visual catalog ID.
  visualItemId: string | null;
}>;
export const AVATAR_V5_EQUIPMENT_MAPPINGS: readonly AvatarV5EquipmentMapping[] = Object.freeze([
  Object.freeze({ backendId: "shannon_hat", slot: "hat", kind: "performance", visualItemId: null }),
  Object.freeze({ backendId: "shannon_apron", slot: "apron", kind: "performance", visualItemId: null }),
  Object.freeze({ backendId: "shannon_outfit", slot: "outfit", kind: "performance", visualItemId: null }),
  Object.freeze({ backendId: "gold_apron", slot: "apron", kind: "cosmetic", visualItemId: null }),
]);

// Ordered visual candidates only; absent artwork leaves the previous wardrobe layer visible.
// Cosmetics follow gear and may cover it. This NEVER modifies the source equipment.
export function avatarV5EquipmentVisualCandidates(
  equipment: AvatarV5EquipmentVisualInput,
  visibility: AvatarV5GearVisibility,
  mappings: readonly AvatarV5EquipmentMapping[] = AVATAR_V5_EQUIPMENT_MAPPINGS,
): readonly AvatarV5EquipmentMapping[] {
  const performanceIds = Object.values(equipment.equippedGearSlots).filter(Boolean);
  const hasSlottedGear = performanceIds.length > 0;
  return mappings.filter((mapping) => {
    if (mapping.visualItemId === null) return false;
    if (mapping.kind === "cosmetic") return equipment.equippedCosmetic === mapping.backendId;
    if (!visibility[mapping.slot]) return false;
    return hasSlottedGear
      ? equipment.equippedGearSlots[mapping.slot] === mapping.backendId
      : equipment.equippedGear === mapping.backendId;
  }).sort((a, b) => Number(a.kind === "cosmetic") - Number(b.kind === "cosmetic"));
}
