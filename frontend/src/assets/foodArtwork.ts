import type { ImageSourcePropType } from "react-native";

export type FoodArtwork = {
  source: ImageSourcePropType;
  scale: number;
};

export const FOOD_ARTWORK: Record<string, FoodArtwork> = {
  "nathans-hotdogs": { source: require("./food/hot-dog.png"), scale: 0.94 },
  "wing-bowl": { source: require("./food/wings.png"), scale: 0.9 },
  "pizza-hut-stuffed": { source: require("./food/pizza-pepperoni.png"), scale: 0.96 },
  "katz-pastrami": { source: require("./food/pastrami-sandwich.png"), scale: 0.92 },
  "ben-jerry-icecream": { source: require("./food/dessert.png"), scale: 0.92 },
  "in-n-out-burgers": { source: require("./food/burger-deluxe.png"), scale: 0.96 },
} as const;

const DEFAULT_FOOD_ARTWORK: FoodArtwork = {
  source: require("./food/burger-deluxe.png"),
  scale: 0.96,
};

export function getFoodArtwork(id: string): FoodArtwork {
  return FOOD_ARTWORK[id] ?? DEFAULT_FOOD_ARTWORK;
}
