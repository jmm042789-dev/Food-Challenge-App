export type TournamentDifficulty = "Easy" | "Medium" | "Hard" | "Elite" | "Legendary";

export type TournamentReward = {
  id: string;
  label: string;
  minimumScore: number;
  coins: number;
  xp: number;
  cosmeticId?: string;
  badgeId?: string;
  titleId?: string;
};

export type TournamentDefinition = {
  id: string;
  name: string;
  description: string;
  featuredRestaurantId: string;
  featuredFoods: string[];
  featuredOpponents: string[];
  rewardTable: TournamentReward[];
  artworkPlaceholder: string;
  bannerPlaceholder: string;
  difficulty: TournamentDifficulty;
  entryContestId: string;
  globalLeaderboardId?: string;
  seasonId?: string;
  online?: boolean;
};

export type ActiveTournament = TournamentDefinition & {
  occurrenceId: string;
  startDate: string;
  endDate: string;
};

export type TournamentPlayerProgress = {
  occurrenceId: string;
  tournamentId: string;
  matchesEntered: number;
  bestScore: number;
  wins: number;
  highestCombo: number;
  finalPlacement: number | null;
  claimedRewardIds: string[];
  claimedCoins: number;
  claimedXp: number;
  processedMatchIds: string[];
};

export type TournamentProgressState = {
  version: 1;
  tournaments: TournamentPlayerProgress[];
};

export type TournamentMatchResult = {
  matchId: string;
  score: number;
  won: boolean;
  highestCombo: number;
};

export type TournamentClaimResult =
  | { ok: true; state: TournamentProgressState; reward: TournamentReward }
  | { ok: false; state: TournamentProgressState; error: "TOURNAMENT_NOT_FOUND" | "REWARD_NOT_FOUND" | "REWARD_NOT_EARNED" | "ALREADY_CLAIMED" | "CLAIM_IN_PROGRESS" | "PERSISTENCE_FAILED" };
