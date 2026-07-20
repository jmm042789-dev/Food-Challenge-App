export type TitleRarity = "Common" | "Rare" | "Epic" | "Legendary" | "Mythic";

export type TitleUnlockRequirement =
  | { type: "MATCHES_PLAYED"; value: number }
  | { type: "WINS"; value: number }
  | { type: "BELT_RANK"; value: number }
  | { type: "ACHIEVEMENT"; achievementId: string }
  | { type: "ACHIEVEMENTS_COMPLETED"; value: number }
  | { type: "RESTAURANTS_UNLOCKED"; value: number }
  | { type: "FOOD_MECHANIC_MASTERY"; achievementId: string }
  | { type: "SEASON_REWARD"; rewardId: string }
  | { type: "TOURNAMENT_REWARD"; rewardId: string };

export type TitleDefinition = {
  id: string;
  displayName: string;
  description: string;
  rarity: TitleRarity;
  unlockRequirement: TitleUnlockRequirement;
  iconPlaceholder: string;
  colorTheme: string;
  sourceMetadata?: {
    seasonId?: string;
    liveEventId?: string;
    restaurantPromotionId?: string;
    specialCodeId?: string;
    developerGiftId?: string;
  };
};

export type TitleProgressRecord = {
  titleId: string;
  dateUnlocked: string;
  newlyUnlocked: boolean;
};

export type TitleProgressState = {
  version: 1;
  unlockedTitles: TitleProgressRecord[];
  equippedTitleId: string | null;
};

export type TitleProgressContext = {
  matchesPlayed: number;
  wins: number;
  beltRank: number;
  completedAchievementIds: readonly string[];
  unlockedRestaurantIds: readonly string[];
  claimedSeasonRewardIds?: readonly string[];
  claimedTournamentRewardIds?: readonly string[];
};

export type TitleUnlockNotification = {
  titleId: string;
  titleName: string;
  rarity: TitleRarity;
  colorTheme: string;
};

export type TitleSyncResult = { state: TitleProgressState; newlyUnlocked: TitleUnlockNotification[] };

export type EquipTitleResult =
  | { ok: true; state: TitleProgressState }
  | { ok: false; state: TitleProgressState; error: "TITLE_NOT_FOUND" | "TITLE_LOCKED" | "PERSISTENCE_FAILED" };
