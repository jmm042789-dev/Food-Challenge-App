export type MissionCategory =
  | "PLAY_MATCHES"
  | "WIN_MATCHES"
  | "EARN_COINS"
  | "EARN_XP"
  | "BUILD_COMBOS"
  | "COMPLETE_FOOD_MECHANICS"
  | "PLAY_SPECIFIC_FOOD"
  | "DEFEAT_SPECIFIC_OPPONENT";

export type MissionReward = {
  coins: number;
  xp: number;
  futureReward?: {
    type: string;
    id: string;
    quantity: number;
  };
};

export type DailyMission = {
  id: string;
  category: MissionCategory;
  title: string;
  icon: string;
  goal: number;
  currentProgress: number;
  completed: boolean;
  claimed: boolean;
  reward: MissionReward;
  targetId?: string;
};

export type DailyMissionState = {
  lastGeneratedDate: string;
  missions: DailyMission[];
  claimedRewards: {
    coins: number;
    xp: number;
  };
};

export type MissionEvent = {
  type: "MATCH_COMPLETED";
  won: boolean;
  coinsEarned: number;
  xpEarned: number;
  highestCombo: number;
  foodId: string;
  opponentId: string;
  completedFoodMechanic?: boolean;
};

export type MissionClaimResult = {
  state: DailyMissionState;
  reward: MissionReward | null;
};
