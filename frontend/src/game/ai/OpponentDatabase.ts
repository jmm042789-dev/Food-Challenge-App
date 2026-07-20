import { Opponent } from "./types";

export const OPPONENT_DATABASE: Opponent[] = [
  {
    id: "burger-billy",
    name: "Burger Billy",
    avatar: "🍔",

    level: 1,
    difficulty: "Easy",
    personality: "Comeback Specialist",

    speed: 1.00,
    accuracy: 0.82,
    comboChance: 0.10,
    mistakeChance: 0.10,
    aggression: 0.30,

    rewardCoins: 60,
    rewardXP: 30,
  },

  {
    id: "pizza-pete",
    name: "Pizza Pete",
    avatar: "🍕",

    level: 2,
    difficulty: "Easy",
    personality: "Combo Master",

    speed: 1.05,
    accuracy: 0.86,
    comboChance: 0.12,
    mistakeChance: 0.08,
    aggression: 0.35,

    rewardCoins: 70,
    rewardXP: 35,
  },

  {
    id: "taco-tina",
    name: "Taco Tina",
    avatar: "🌮",

    level: 3,
    difficulty: "Medium",
    personality: "Defensive",

    speed: 1.12,
    accuracy: 0.91,
    comboChance: 0.22,
    mistakeChance: 0.05,
    aggression: 0.45,

    rewardCoins: 90,
    rewardXP: 45,
  },

  {
    id: "hotdog-hank",
    name: "Hotdog Hank",
    avatar: "🌭",

    level: 4,
    difficulty: "Medium",
    personality: "Wild",

    speed: 1.18,
    accuracy: 0.78,
    comboChance: 0.30,
    mistakeChance: 0.15,
    aggression: 0.65,

    rewardCoins: 110,
    rewardXP: 55,
  },

  {
    id: "wing-wizard",
    name: "Wing Wizard",
    avatar: "🍗",

    level: 5,
    difficulty: "Hard",
    personality: "Aggressive",

    speed: 1.25,
    accuracy: 0.93,
    comboChance: 0.28,
    mistakeChance: 0.04,
    aggression: 0.80,

    rewardCoins: 140,
    rewardXP: 70,
  },

  {
    id: "burrito-bob",
    name: "Burrito Bob",
    avatar: "🌯",

    level: 6,
    difficulty: "Hard",
    personality: "Defensive",

    speed: 1.18,
    accuracy: 0.96,
    comboChance: 0.18,
    mistakeChance: 0.02,
    aggression: 0.25,

    rewardCoins: 160,
    rewardXP: 80,
  },

  {
    id: "bacon-becky",
    name: "Bacon Becky",
    avatar: "🥓",

    level: 7,
    difficulty: "Elite",
    personality: "Combo Master",

    speed: 1.32,
    accuracy: 0.95,
    comboChance: 0.34,
    mistakeChance: 0.03,
    aggression: 0.60,

    rewardCoins: 190,
    rewardXP: 95,
  },

  {
    id: "donut-dave",
    name: "Donut Dave",
    avatar: "🍩",

    level: 8,
    difficulty: "Elite",
    personality: "Wild",

    speed: 1.38,
    accuracy: 0.83,
    comboChance: 0.38,
    mistakeChance: 0.14,
    aggression: 0.85,

    rewardCoins: 220,
    rewardXP: 110,
  },

  {
    id: "fry-frank",
    name: "Fry Master Frank",
    avatar: "🍟",

    level: 9,
    difficulty: "Legend",
    personality: "Aggressive",

    speed: 1.45,
    accuracy: 0.97,
    comboChance: 0.42,
    mistakeChance: 0.01,
    aggression: 0.95,

    rewardCoins: 260,
    rewardXP: 130,
  },

  {
    id: "inferno-ivan",
    name: "Inferno Ivan",
    avatar: "🌶️",

    level: 10,
    difficulty: "Legend",
    personality: "Combo Master",

    speed: 1.55,
    accuracy: 0.99,
    comboChance: 0.50,
    mistakeChance: 0.01,
    aggression: 1.00,

    rewardCoins: 350,
    rewardXP: 175,
  },
];

export function getRandomOpponent(): Opponent {
  return OPPONENT_DATABASE[
    Math.floor(Math.random() * OPPONENT_DATABASE.length)
  ];
}
