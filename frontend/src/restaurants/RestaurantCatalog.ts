import type { RestaurantAtmosphereConfig, RestaurantDefinition } from "./RestaurantTypes";

const THEME_ATMOSPHERES: Record<string, RestaurantAtmosphereConfig> = {
  "Classic Diner": { accentPrimary: "#F3B55A", accentSecondary: "#D66A38", callouts: ["NICE!", "KEEP EATING!", "WHAT A BITE!"], crowdEnergyMultiplier: 0.92, ambientEffect: "spotlight" },
  "Retro Arcade": { accentPrimary: "#FF5C8A", accentSecondary: "#56D8FF", callouts: ["HIGH SCORE!", "WHAT A COMBO!", "BONUS ROUND!"], crowdEnergyMultiplier: 1.08, ambientEffect: "neon" },
  "Food Truck Plaza": { accentPrimary: "#FFD05A", accentSecondary: "#4FC58B", callouts: ["NICE!", "SHELL YEAH!", "SO CLOSE!"], crowdEnergyMultiplier: 1, ambientEffect: "confetti" },
  "Neon Boardwalk": { accentPrimary: "#FF6B9D", accentSecondary: "#57C7FF", callouts: ["PERFECT SLICE!", "UNBELIEVABLE!", "WHAT A COMBO!"], crowdEnergyMultiplier: 1.05, ambientEffect: "neon" },
  "Roadside Grill": { accentPrimary: "#E89645", accentSecondary: "#D94A2C", callouts: ["HE'S HEATING UP!", "FULL SPEED!", "NICE!"], crowdEnergyMultiplier: 1, ambientEffect: "embers" },
  "Asian Street Market": { accentPrimary: "#E94C45", accentSecondary: "#F4C35B", callouts: ["SLURP!", "AMAZING!", "SO CLOSE!"], crowdEnergyMultiplier: 0.98, ambientEffect: "spotlight" },
  "BBQ Smokehouse": { accentPrimary: "#D76B35", accentSecondary: "#AFA06C", callouts: ["SMOKIN'!", "WHAT A BITE!", "KEEP GOING!"], crowdEnergyMultiplier: 0.95, ambientEffect: "smoke" },
  "Volcano Grill": { accentPrimary: "#FF4B24", accentSecondary: "#FFB52E", callouts: ["ON FIRE!", "HE'S HEATING UP!", "UNBELIEVABLE!"], crowdEnergyMultiplier: 1.15, ambientEffect: "embers" },
  "Championship Sports Bar": { accentPrimary: "#F4C253", accentSecondary: "#D94A32", callouts: ["WHAT A COMBO!", "SO CLOSE!", "WHAT A FINISH!"], crowdEnergyMultiplier: 1.12, ambientEffect: "confetti" },
  "Mythic Flame Coliseum": { accentPrimary: "#FF3E22", accentSecondary: "#E77CFF", callouts: ["FEAST LEGEND!", "UNBELIEVABLE!", "WHAT A FINISH!"], crowdEnergyMultiplier: 1.2, ambientEffect: "embers" },
};

const BASE_RESTAURANT_CATALOG: readonly RestaurantDefinition[] = [
  {
    id: "hungry-diner", displayName: "The Hungry Diner", description: "A welcoming first stop where every feast begins.", theme: "Classic Diner",
    unlockRequirement: { type: "XP", value: 0 }, difficulty: "Easy", foodsAvailable: ["burger", "hot-dog"], opponentsAvailable: ["burger-billy"], artworkPlaceholder: "HD", backgroundPlaceholder: "classic-diner",
  },
  {
    id: "patty-palace", displayName: "Patty Palace", description: "A royal grill stacked high with heavyweight burgers.", theme: "Retro Arcade",
    unlockRequirement: { type: "XP", value: 100 }, difficulty: "Easy", foodsAvailable: ["burger"], opponentsAvailable: ["burger-billy", "bacon-becky"], artworkPlaceholder: "PP", backgroundPlaceholder: "burger-arcade",
  },
  {
    id: "taco-tower", displayName: "Taco Tower", description: "A rooftop taqueria where steady hands rule the skyline.", theme: "Food Truck Plaza",
    unlockRequirement: { type: "XP", value: 250 }, difficulty: "Medium", foodsAvailable: ["taco"], opponentsAvailable: ["taco-tina"], artworkPlaceholder: "TT", backgroundPlaceholder: "taco-rooftop",
  },
  {
    id: "pizza-port", displayName: "Pizza Port", description: "A neon harbor serving slices with legendary cheese pulls.", theme: "Neon Boardwalk",
    unlockRequirement: { type: "XP", value: 500 }, difficulty: "Medium", foodsAvailable: ["pizza"], opponentsAvailable: ["pizza-pete"], artworkPlaceholder: "PZ", backgroundPlaceholder: "neon-boardwalk",
  },
  {
    id: "grill-junction", displayName: "Grill Junction", description: "Fast lanes and faster plates meet at this roadside grill.", theme: "Roadside Grill",
    unlockRequirement: { type: "XP", value: 800 }, difficulty: "Medium", foodsAvailable: ["burger", "hot-dog", "wings"], opponentsAvailable: ["hotdog-hank", "fry-frank"], artworkPlaceholder: "GJ", backgroundPlaceholder: "roadside-grill",
  },
  {
    id: "dragon-noodle-house", displayName: "Dragon Noodle House", description: "Steam, lanterns, and precision slurps fill a midnight market.", theme: "Asian Street Market",
    unlockRequirement: { type: "XP", value: 1200 }, difficulty: "Hard", foodsAvailable: ["ramen"], opponentsAvailable: ["inferno-ivan"], artworkPlaceholder: "DN", backgroundPlaceholder: "lantern-market",
  },
  {
    id: "smokehouse-station", displayName: "Smokehouse Station", description: "Slow smoke and big portions arrive right on schedule.", theme: "BBQ Smokehouse",
    unlockRequirement: { type: "XP", value: 1800 }, difficulty: "Hard", foodsAvailable: ["wings", "burger"], opponentsAvailable: ["burrito-bob", "bacon-becky"], artworkPlaceholder: "SS", backgroundPlaceholder: "smokehouse-station",
  },
  {
    id: "wing-inferno", displayName: "Wing Inferno", description: "A volcanic sports bar built for the hottest wing challengers.", theme: "Volcano Grill",
    unlockRequirement: { type: "XP", value: 2600 }, difficulty: "Elite", foodsAvailable: ["wings"], opponentsAvailable: ["wing-wizard", "inferno-ivan"], artworkPlaceholder: "WI", backgroundPlaceholder: "volcano-grill",
  },
  {
    id: "fire-feast-arena", displayName: "Fire Feast Arena", description: "The premier televised arena for elite food fighters.", theme: "Championship Sports Bar",
    unlockRequirement: { type: "XP", value: 3800 }, difficulty: "Elite", foodsAvailable: ["burger", "pizza", "taco", "ramen", "hot-dog", "wings"], opponentsAvailable: ["fry-frank", "donut-dave", "wing-wizard"], artworkPlaceholder: "FF", backgroundPlaceholder: "championship-arena",
  },
  {
    id: "inferno-coliseum", displayName: "Inferno Coliseum", description: "The final furnace where Fire Feast legends are forged.", theme: "Mythic Flame Coliseum",
    unlockRequirement: { type: "XP", value: 5000 }, difficulty: "Legendary", foodsAvailable: ["burger", "pizza", "taco", "ramen", "hot-dog", "wings"], opponentsAvailable: ["inferno-ivan", "fry-frank"], artworkPlaceholder: "IC", backgroundPlaceholder: "inferno-coliseum",
  },
] as const;

export const RESTAURANT_CATALOG: readonly RestaurantDefinition[] = BASE_RESTAURANT_CATALOG.map((restaurant) => ({
  ...restaurant,
  arenaAtmosphere: THEME_ATMOSPHERES[restaurant.theme],
  audioTheme: { musicStyle: restaurant.theme, crowdStyle: restaurant.theme },
}));

export const RESTAURANT_BY_ID = new Map(RESTAURANT_CATALOG.map((restaurant) => [restaurant.id, restaurant]));
