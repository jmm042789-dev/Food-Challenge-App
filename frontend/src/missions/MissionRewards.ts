import type { MissionCategory, MissionReward } from "./MissionTypes";

export const MISSION_REWARDS: Record<MissionCategory, MissionReward> = {
  PLAY_MATCHES: { coins: 40, xp: 35 },
  WIN_MATCHES: { coins: 75, xp: 60 },
  EARN_COINS: { coins: 55, xp: 40 },
  EARN_XP: { coins: 45, xp: 65 },
  BUILD_COMBOS: { coins: 60, xp: 55 },
  COMPLETE_FOOD_MECHANICS: { coins: 65, xp: 55 },
  PLAY_SPECIFIC_FOOD: { coins: 50, xp: 45 },
  DEFEAT_SPECIFIC_OPPONENT: { coins: 85, xp: 70 },
};
