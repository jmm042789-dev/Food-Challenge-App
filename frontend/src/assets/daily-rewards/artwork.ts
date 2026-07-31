import type { ImageSourcePropType } from "react-native";

type MetroAssetContext = {
  (path: string): ImageSourcePropType;
  keys(): string[];
};

// Metro expands this context at bundle time. Unlike individual static
// requires, an empty context is valid; adding a named file makes it available
// on the next bundle without changing application code.
const dailyRewardAssets = require.context(".", true, /\.(?:png|jpe?g)$/i) as MetroAssetContext;
const availableAssets = new Set(dailyRewardAssets.keys());

function optionalAsset(path: string): ImageSourcePropType | null {
  return availableAssets.has(path) ? dailyRewardAssets(path) : null;
}

export const DAILY_REWARD_ARTWORK = {
  background: optionalAsset("./background/restaurant-table.jpg"),
  wheel: optionalAsset("./wheel/charcuterie-wheel.png"),
  pointer: optionalAsset("./pointer/chef-knife-pointer.png"),
  hub: optionalAsset("./hub/fire-feast-hub.png"),
  decorations: {
    grapesTopLeft: optionalAsset("./decorations/grapes-top-left.png"),
    salamiTopRight: optionalAsset("./decorations/salami-top-right.png"),
    olivesBottomLeft: optionalAsset("./decorations/olives-bottom-left.png"),
    cheeseBottomRight: optionalAsset("./decorations/cheese-bottom-right.png"),
  },
  winnerGlow: optionalAsset("./effects/winner-glow.png"),
} as const;
