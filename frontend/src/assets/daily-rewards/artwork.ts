export type ArtworkBounds = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

type TransparentArtwork = Readonly<{
  source: number;
  hasAlphaChannel: boolean;
  hasBakedBackground: boolean;
  contentBounds: ArtworkBounds;
  canvas: Readonly<{ width: number; height: number }>;
}>;

// These flags are generated from scripts/audit-daily-reward-artwork.js and are
// deliberately explicit: React Native cannot inspect bundled PNG alpha pixels.
const wheel: TransparentArtwork = {
  source: require("./wheel/charcuterie-wheel.png"),
  hasAlphaChannel: true,
  hasBakedBackground: false,
  canvas: { width: 1254, height: 1254 },
  contentBounds: { x: 63, y: 64, width: 1129, height: 1127 },
};

const pointer: TransparentArtwork = {
  source: require("./pointer/chef-knife-pointer.png"),
  hasAlphaChannel: true,
  hasBakedBackground: false,
  canvas: { width: 500, height: 500 },
  contentBounds: { x: 216, y: 16, width: 68, height: 467 },
};

const hub: TransparentArtwork = {
  source: require("./hub/fire-feast-hub.png"),
  hasAlphaChannel: true,
  hasBakedBackground: false,
  canvas: { width: 500, height: 500 },
  contentBounds: { x: 54, y: 52, width: 393, height: 396 },
};

const decorations = {
  grapesTopLeft: require("./decorations/grapes-top-left.png"),
  salamiTopRight: require("./decorations/salami-top-right.png"),
  olivesBottomLeft: require("./decorations/olives-bottom-left.png"),
  cheeseBottomRight: require("./decorations/cheese-bottom-right.png"),
} as const;

const winnerGlow = require("./effects/winner-glow.png");

const transparentArtworkIsUsable = (artwork: TransparentArtwork) =>
  artwork.hasAlphaChannel && !artwork.hasBakedBackground;

export const DAILY_REWARD_ARTWORK = {
  background: require("./background/restaurant-table.png"),
  wheel,
  pointer,
  hub,
  decorations,
  winnerGlow,
} as const;

export const DAILY_REWARD_ARTWORK_VALIDITY = {
  wheel: transparentArtworkIsUsable(wheel),
  pointer: transparentArtworkIsUsable(pointer),
  hub: transparentArtworkIsUsable(hub),
  decorations: true,
  winnerGlow: true,
} as const;
