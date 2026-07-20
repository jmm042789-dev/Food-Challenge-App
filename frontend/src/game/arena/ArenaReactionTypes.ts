import type { RestaurantAmbientEffect } from "../../restaurants/RestaurantTypes";

export type ArenaReactionType =
  | "MATCH_START"
  | "PLAYER_COMBO"
  | "OPPONENT_COMBO"
  | "PLAYER_TAKES_LEAD"
  | "OPPONENT_TAKES_LEAD"
  | "CLOSE_MATCH"
  | "FINAL_10_SECONDS"
  | "MATCH_FINISHED";

export type ArenaReaction = {
  type: ArenaReactionType;
  combo?: number;
  scoreDifference?: number;
  playerWon?: boolean;
  occurredAt?: number;
};

export type ArenaTheme = {
  restaurantId?: string;
  accentPrimary: string;
  accentSecondary: string;
  callouts: readonly string[];
  crowdEnergyMultiplier: number;
  ambientEffect: RestaurantAmbientEffect;
};

export type ArenaAtmosphereState = {
  excitement: number;
  lastReaction: ArenaReactionType | null;
  callout: string | null;
  calloutKey: number;
  reactionKey: number;
  theme: ArenaTheme;
};
