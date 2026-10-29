// Compile-time architecture guards, checked by project TypeScript validation.
import type { AvatarV5Appearance } from "../src/avatar-v5/loadout";
import type { AvatarV5BodyId, AvatarV5Presentation, AvatarV5CatalogItem, AvatarV5EquipmentVisualInput } from "../src/avatar-v5/types";
type Assert<T extends true> = T;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
export type SchemaVersion = Assert<Equal<AvatarV5Appearance["schemaVersion"], 5>>;
export type Presentations = Assert<Equal<AvatarV5Presentation, "male" | "female" | "non_binary">>;
export type Bodies = Assert<Equal<AvatarV5BodyId, "standard" | "broad">>;
export type SeparateBody = Assert<Equal<AvatarV5Appearance["bodyId"], AvatarV5BodyId>>;
export type NoEquipmentAuthority = Assert<Equal<Extract<keyof AvatarV5Appearance, "performanceGear" | "equippedGear" | "stats" | "modifiers">, never>>;
export type NoPresentationRestriction = Assert<Equal<Extract<keyof AvatarV5CatalogItem, "compatiblePresentations" | "gameplay">, never>>;
export type ExistingEquipmentSlots = Assert<Equal<keyof AvatarV5EquipmentVisualInput["equippedGearSlots"], "hat" | "apron" | "outfit">>;
