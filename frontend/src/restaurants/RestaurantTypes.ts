export type RestaurantDifficulty = "Easy" | "Medium" | "Hard" | "Elite" | "Legendary";
export type RestaurantAmbientEffect = "embers" | "spotlight" | "neon" | "smoke" | "confetti";
export type RestaurantAtmosphereConfig = {
  accentPrimary: string;
  accentSecondary: string;
  callouts: string[];
  crowdEnergyMultiplier: number;
  ambientEffect: RestaurantAmbientEffect;
};
export type RestaurantAudioTheme = {
  ambientLoopId?: string;
  musicStyle?: string;
  crowdStyle?: string;
  sponsorMusicId?: string;
};

export type RestaurantUnlockRequirement =
  | { type: "XP"; value: number }
  | { type: "BELT_RANK"; value: number }
  | { type: "MATCHES_WON"; value: number }
  | { type: "ACHIEVEMENT"; achievementId: string }
  | { type: "EVENT"; eventId: string }
  | { type: "SPONSOR"; sponsorId: string };

export type RestaurantDefinition = {
  id: string;
  displayName: string;
  description: string;
  theme: string;
  unlockRequirement: RestaurantUnlockRequirement;
  difficulty: RestaurantDifficulty;
  foodsAvailable: string[];
  opponentsAvailable: string[];
  artworkPlaceholder: string;
  backgroundPlaceholder: string;
  arenaAtmosphere?: RestaurantAtmosphereConfig;
  audioTheme?: RestaurantAudioTheme;
  sponsorId?: string;
  realRestaurant?: boolean;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  menuUrl?: string;
};

export type RestaurantUnlockStatus = "locked" | "unlocked";

export type RestaurantProgressRecord = {
  restaurantId: string;
  status: RestaurantUnlockStatus;
  newlyUnlocked: boolean;
  dateUnlocked: string | null;
};

export type RestaurantProgressState = {
  version: 1;
  restaurants: RestaurantProgressRecord[];
};

export type RestaurantProgressContext = {
  xp: number;
  beltRank?: number;
  matchesWon?: number;
  completedAchievementIds?: readonly string[];
  eventIds?: readonly string[];
  sponsorIds?: readonly string[];
};

export type RestaurantUnlockNotification = {
  restaurantId: string;
  restaurantName: string;
  theme: string;
};

export type RestaurantUnlockResult = {
  state: RestaurantProgressState;
  newlyUnlocked: RestaurantUnlockNotification[];
};
