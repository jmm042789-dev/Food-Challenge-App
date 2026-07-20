import type { TournamentDefinition, TournamentReward } from "./TournamentTypes";

const rewards = (prefix: string): TournamentReward[] => [
  { id: `${prefix}_entry`, label: "ENTRY REWARD", minimumScore: 0, coins: 40, xp: 40 },
  { id: `${prefix}_contender`, label: "CONTENDER", minimumScore: 50, coins: 125, xp: 100 },
  { id: `${prefix}_champion`, label: "CHAMPION", minimumScore: 100, coins: 300, xp: 250 },
];

export const TOURNAMENT_CATALOG: readonly TournamentDefinition[] = [
  { id: "burger-bash", name: "Burger Bash", description: "Heavy bites headline a week of stacked competition.", featuredRestaurantId: "patty-palace", featuredFoods: ["burger"], featuredOpponents: ["burger-billy", "bacon-becky"], rewardTable: rewards("burger_bash"), artworkPlaceholder: "BB", bannerPlaceholder: "burger-bash-banner", difficulty: "Easy", entryContestId: "in-n-out-burgers" },
  { id: "pizza-panic", name: "Pizza Panic", description: "Master the cheese pull and chase a scorching slice score.", featuredRestaurantId: "pizza-port", featuredFoods: ["pizza"], featuredOpponents: ["pizza-pete"], rewardTable: rewards("pizza_panic"), artworkPlaceholder: "PZ", bannerPlaceholder: "pizza-panic-banner", difficulty: "Medium", entryContestId: "pizza-hut-stuffed" },
  { id: "wing-wars", name: "Wing Wars", description: "Eat through the Heat Rush in a blazing wing showdown.", featuredRestaurantId: "wing-inferno", featuredFoods: ["wings"], featuredOpponents: ["wing-wizard", "inferno-ivan"], rewardTable: rewards("wing_wars"), artworkPlaceholder: "WW", bannerPlaceholder: "wing-wars-banner", difficulty: "Hard", entryContestId: "wing-bowl" },
  { id: "taco-throwdown", name: "Taco Throwdown", description: "Steady tapping rules this rooftop shell-stability clash.", featuredRestaurantId: "taco-tower", featuredFoods: ["taco"], featuredOpponents: ["taco-tina"], rewardTable: rewards("taco_throwdown"), artworkPlaceholder: "TT", bannerPlaceholder: "taco-throwdown-banner", difficulty: "Medium", entryContestId: "taco-tower-challenge" },
  { id: "ramen-rumble", name: "Ramen Rumble", description: "Slurp fast under the lanterns of a midnight noodle battle.", featuredRestaurantId: "dragon-noodle-house", featuredFoods: ["ramen"], featuredOpponents: ["inferno-ivan"], rewardTable: rewards("ramen_rumble"), artworkPlaceholder: "RR", bannerPlaceholder: "ramen-rumble-banner", difficulty: "Elite", entryContestId: "ramen-rumble" },
  { id: "fire-feast-championship", name: "Fire Feast Championship", description: "Every food and every rival collide in the premier weekly final.", featuredRestaurantId: "fire-feast-arena", featuredFoods: ["burger", "pizza", "taco", "ramen", "hot-dog", "wings"], featuredOpponents: ["fry-frank", "wing-wizard", "inferno-ivan"], rewardTable: rewards("fire_feast_championship"), artworkPlaceholder: "FF", bannerPlaceholder: "championship-banner", difficulty: "Legendary", entryContestId: "nathans-hotdogs" },
] as const;

export const TOURNAMENT_BY_ID = new Map(TOURNAMENT_CATALOG.map((tournament) => [tournament.id, tournament]));
