export const AVATAR_BOARD_SIZE = 132;
export type AvatarRenderMode = "compact" | "medium" | "detailed";
export type AvatarAnchorName = "head_center" | "head_top" | "forehead" | "eyes" | "nose" | "mouth" | "jaw" | "left_ear" | "right_ear" | "neck" | "chest" | "torso_center" | "left_shoulder" | "right_shoulder" | "waist";
export type AvatarAnchor = { x: number; y: number };
export const AVATAR_ANCHORS: Readonly<Record<AvatarAnchorName, AvatarAnchor>> = Object.freeze({ head_center: { x: 66, y: 58 }, head_top: { x: 66, y: 23 }, forehead: { x: 66, y: 38 }, eyes: { x: 66, y: 54 }, nose: { x: 66, y: 65 }, mouth: { x: 66, y: 76 }, jaw: { x: 66, y: 88 }, left_ear: { x: 32, y: 61 }, right_ear: { x: 100, y: 61 }, neck: { x: 66, y: 95 }, chest: { x: 66, y: 108 }, torso_center: { x: 66, y: 116 }, left_shoulder: { x: 22, y: 108 }, right_shoulder: { x: 110, y: 108 }, waist: { x: 66, y: 130 } });
export const renderModeForSize = (size: number): AvatarRenderMode => size < 58 ? "compact" : size < 108 ? "medium" : "detailed";
export const scaledAnchor = (name: AvatarAnchorName, size: number): AvatarAnchor => ({ x: AVATAR_ANCHORS[name].x * size / AVATAR_BOARD_SIZE, y: AVATAR_ANCHORS[name].y * size / AVATAR_BOARD_SIZE });
export const anchoredBox = (name: AvatarAnchorName, width: number, height: number) => ({ left: AVATAR_ANCHORS[name].x - width / 2, top: AVATAR_ANCHORS[name].y - height / 2, width, height });
export const AVATAR_LAYER_ORDER = ["background", "back_hair", "outfit", "neck", "ears", "head", "face", "front_hair", "facial_hair", "glasses", "headwear", "apron", "accessory", "frame"] as const;
