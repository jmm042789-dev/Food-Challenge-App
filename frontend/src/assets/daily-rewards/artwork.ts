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
  hasBakedBackground: true,
  canvas: { width: 1536, height: 1024 },
  contentBounds: { x: 337, y: 75, width: 869, height: 846 },
};

const pointer: TransparentArtwork = {
  source: require("./pointer/chef-knife-pointer.png"),
  hasAlphaChannel: true,
  hasBakedBackground: true,
  canvas: { width: 1536, height: 1024 },
  contentBounds: { x: 702, y: 34, width: 109, height: 864 },
};

const hub: TransparentArtwork = {
  source: require("./hub/fire-feast-hub.png"),
  hasAlphaChannel: false,
  hasBakedBackground: true,
  canvas: { width: 1254, height: 1254 },
  contentBounds: { x: 0, y: 0, width: 1254, height: 1254 },
};

const transparentArtworkIsUsable = (artwork: TransparentArtwork) =>
  artwork.hasAlphaChannel && !artwork.hasBakedBackground;

export const DAILY_REWARD_ARTWORK = {
  background: require("./background/restaurant-table.png"),
  wheel,
  pointer,
  hub,
  // All four current decorations and the glow have generated rectangular
  // backdrops. Keep them absent rather than compositing boxes over the table.
  decorations: [],
  winnerGlow: null,
} as const;

export const DAILY_REWARD_ARTWORK_VALIDITY = {
  wheel: transparentArtworkIsUsable(wheel),
  pointer: transparentArtworkIsUsable(pointer),
  hub: transparentArtworkIsUsable(hub),
  decorations: false,
  winnerGlow: false,
} as const;
