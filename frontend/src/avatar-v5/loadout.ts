import type { AvatarV5BodyId, AvatarV5Presentation } from "./types";
export type AvatarV5PaletteSelection = Readonly<{ paletteId: string; value: number }>;
export type AvatarV5GearVisibility = Readonly<{ hat: boolean; apron: boolean; outfit: boolean }>;
export interface AvatarV5Appearance {
  readonly schemaVersion: 5;
  readonly presentation: AvatarV5Presentation;
  readonly bodyId: AvatarV5BodyId;
  readonly skinTone: AvatarV5PaletteSelection;
  readonly faceId: string;
  readonly eyeColorId: string;
  readonly hairId: string | null;
  readonly hairColor: AvatarV5PaletteSelection;
  readonly facialHairId: string | null;
  readonly wardrobe: Readonly<{
    topId: string; bottomId: string; shoesId: string;
    socksId: string | null; apronId: string | null; headwearId: string | null;
    eyewearId: string | null; neckAccessoryId: string | null;
    wristAccessoryId: string | null; miscAccessoryId: string | null;
  }>;
  readonly itemColorways: Readonly<Record<string, string>>;
  readonly effectId: string | null;
  readonly backgroundId: string;
  readonly gearVisibility: AvatarV5GearVisibility;
}
// Infrastructure sentinel, NOT a catalog item, palette, or production default.
export const AVATAR_V5_UNASSIGNED = "__unassigned__";
export const EMPTY_AVATAR_V5_LOADOUT: AvatarV5Appearance = Object.freeze({
  schemaVersion: 5, presentation: "non_binary", bodyId: "standard",
  skinTone: Object.freeze({ paletteId: AVATAR_V5_UNASSIGNED, value: 23 }),
  faceId: AVATAR_V5_UNASSIGNED, eyeColorId: AVATAR_V5_UNASSIGNED, hairId: null,
  hairColor: Object.freeze({ paletteId: AVATAR_V5_UNASSIGNED, value: 18 }),
  facialHairId: null,
  wardrobe: Object.freeze({
    topId: AVATAR_V5_UNASSIGNED, bottomId: AVATAR_V5_UNASSIGNED, shoesId: AVATAR_V5_UNASSIGNED,
    socksId: null, apronId: null, headwearId: null, eyewearId: null,
    neckAccessoryId: null, wristAccessoryId: null, miscAccessoryId: null,
  }),
  itemColorways: Object.freeze({}), effectId: null, backgroundId: AVATAR_V5_UNASSIGNED,
  gearVisibility: Object.freeze({ hat: true, apron: true, outfit: true }),
});
