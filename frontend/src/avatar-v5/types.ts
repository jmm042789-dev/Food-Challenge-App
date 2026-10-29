import type { ImageSourcePropType } from "react-native";
import type { AvatarV5Layer } from "./layers";

export const AVATAR_V5_PRESENTATIONS = Object.freeze(["male", "female", "non_binary"] as const);
export const AVATAR_V5_BODY_IDS = Object.freeze(["standard", "broad"] as const);
export type AvatarV5Presentation = typeof AVATAR_V5_PRESENTATIONS[number];
export type AvatarV5BodyId = typeof AVATAR_V5_BODY_IDS[number];
export type AvatarV5Slot = "body" | "face" | "hair" | "facialHair" | "top" | "bottom"
  | "shoes" | "socks" | "apron" | "headwear" | "eyewear" | "neckAccessory"
  | "wristAccessory" | "miscAccessory" | "effect" | "background";
export type AvatarV5Acquisition = "starter" | "purchasedCosmetic" | "earnedCosmetic" | "performanceGearVisual";
// Preview state is not an entitlement. Purchases/unlocks remain backend-authoritative.
export type AvatarV5SelectionState = "available" | "owned" | "lockedPreview";
export type AvatarV5HeadwearFit = "open-band" | "brimmed-cap" | "full-cover";
export type AvatarV5TintChannel = "skin" | "hair" | "eye";

export type AvatarV5Pass = Readonly<{
  id: string;
  treatment: "fill" | "shading" | "highlight" | "detail";
  // Only fill passes may be tinted. Other passes retain authored colors.
  tint?: AvatarV5TintChannel;
  source: ImageSourcePropType;
  derivatives?: Readonly<Partial<Record<"512" | "256" | "128", ImageSourcePropType>>>;
}>;
export type AvatarV5Part = Readonly<{
  id: string;
  layer: AvatarV5Layer;
  passes: readonly AvatarV5Pass[];
  // Mutually exclusive alternatives, not additional layers.
  authoredColorways?: Readonly<Record<string, readonly AvatarV5Pass[]>>;
}>;
export type AvatarV5Variant = Readonly<{
  parts: readonly AvatarV5Part[];
  headwearAlternatives?: Readonly<Partial<Record<AvatarV5HeadwearFit, readonly AvatarV5Part[]>>>;
}>;
export interface AvatarV5CatalogItem {
  readonly id: string;
  readonly visibleName: string;
  readonly slot: AvatarV5Slot;
  readonly acquisition: AvatarV5Acquisition;
  readonly contentRevision: number;
  // Geometry determines fit; presentation is deliberately absent.
  readonly variants: Readonly<Partial<Record<AvatarV5BodyId, AvatarV5Variant>>>;
  readonly compatibility: Readonly<{
    headFit: "shared_v1";
    headwearFit?: AvatarV5HeadwearFit;
    hidesHair?: boolean;
    covers?: readonly AvatarV5Layer[];
    incompatibleItemIds?: readonly string[];
  }>;
  readonly facePreset?: Readonly<{
    features: readonly ("eyes" | "brows" | "nose" | "mouth" | "shaping")[];
    supportsEyeColor: boolean;
  }>;
}
export type AvatarV5Catalog = Readonly<Record<string, AvatarV5CatalogItem>>;
// Read-only visual input. Never equipment writes or match modifiers.
export type AvatarV5EquipmentVisualInput = Readonly<{
  equippedGear: string | null;
  equippedGearSlots: Readonly<{ hat?: string; apron?: string; outfit?: string }>;
  equippedCosmetic: string | null;
}>;
