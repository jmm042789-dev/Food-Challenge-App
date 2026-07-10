export type AIPersonality =
  | "aggressive"
  | "defensive"
  | "lucky"
  | "comeback";

export type Opponent = {
  id: string;
  name: string;
  difficulty: number;
  personality: AIPersonality;

  // 🍔 future-ready (restaurant / food system expansion)
  style?: "fast" | "balanced" | "slow" | "chaotic";
};

export const opponents: Opponent[] = [
  {
    id: "op_steve",
    name: "Spicy Steve",
    difficulty: 2,
    personality: "aggressive",
    style: "fast",
  },
  {
    id: "op_mia",
    name: "Chill Mia",
    difficulty: 1,
    personality: "defensive",
    style: "slow",
  },
  {
    id: "op_brook",
    name: "Lucky Brook",
    difficulty: 2,
    personality: "lucky",
    style: "chaotic",
  },
  {
    id: "op_jax",
    name: "Comeback Jax",
    difficulty: 3,
    personality: "comeback",
    style: "balanced",
  },
  {
    id: "op_ronin",
    name: "Ronin Blade",
    difficulty: 4,
    personality: "aggressive",
    style: "fast",
  },
  {
    id: "op_ivy",
    name: "Ivy Frost",
    difficulty: 3,
    personality: "defensive",
    style: "slow",
  },
  {
    id: "op_neo",
    name: "Neo RNG",
    difficulty: 4,
    personality: "lucky",
    style: "chaotic",
  },
  {
    id: "op_kai",
    name: "Kai Storm",
    difficulty: 5,
    personality: "comeback",
    style: "balanced",
  },
];