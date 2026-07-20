import { MISSION_REWARDS } from "./MissionRewards";
import type { DailyMission, MissionCategory } from "./MissionTypes";

type MissionTemplate = {
  key: string;
  category: MissionCategory;
  title: string;
  icon: string;
  goal: number;
  targetId?: string;
};

const FOOD_TARGETS = ["burger", "pizza", "taco", "ramen", "hot-dog", "wings"] as const;
const OPPONENT_TARGETS = [
  ["burger-billy", "Burger Billy"],
  ["pizza-pete", "Pizza Pete"],
  ["taco-tina", "Taco Tina"],
  ["hotdog-hank", "Hotdog Hank"],
  ["wing-wizard", "Wing Wizard"],
] as const;

export function getLocalDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: number): () => number {
  let value = seed || 1;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

export function generateDailyMissions(dateKey = getLocalDateKey()): DailyMission[] {
  const random = seededRandom(hashSeed(dateKey));
  const food = FOOD_TARGETS[Math.floor(random() * FOOD_TARGETS.length)];
  const opponent = OPPONENT_TARGETS[Math.floor(random() * OPPONENT_TARGETS.length)];
  const templates: MissionTemplate[] = [
    { key: "play", category: "PLAY_MATCHES", title: "Play 3 matches", icon: "3X", goal: 3 },
    { key: "win", category: "WIN_MATCHES", title: "Win 2 matches", icon: "W", goal: 2 },
    { key: "coins", category: "EARN_COINS", title: "Earn 100 match coins", icon: "C", goal: 100 },
    { key: "xp", category: "EARN_XP", title: "Earn 200 match XP", icon: "XP", goal: 200 },
    { key: "combo", category: "BUILD_COMBOS", title: "Reach a 10x combo", icon: "10", goal: 10 },
    { key: `food-${food}`, category: "PLAY_SPECIFIC_FOOD", title: `Play a ${food.replace(/-/g, " ")} match`, icon: "F", goal: 1, targetId: food },
    { key: `opponent-${opponent[0]}`, category: "DEFEAT_SPECIFIC_OPPONENT", title: `Defeat ${opponent[1]}`, icon: "VS", goal: 1, targetId: opponent[0] },
  ];

  for (let index = templates.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [templates[index], templates[swapIndex]] = [templates[swapIndex], templates[index]];
  }

  return templates.slice(0, 3).map((template) => ({
    id: `${dateKey}:${template.key}`,
    category: template.category,
    title: template.title,
    icon: template.icon,
    goal: template.goal,
    currentProgress: 0,
    completed: false,
    claimed: false,
    reward: { ...MISSION_REWARDS[template.category] },
    targetId: template.targetId,
  }));
}
