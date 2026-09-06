import type { AvatarConfiguration } from "../profile/PlayerIdentity";

export type FriendshipState = "SELF" | "NONE" | "FRIENDS" | "INCOMING" | "OUTGOING";
export type PublicPlayerProfile = {
  public_id: string;
  handle: string;
  display_name: string;
  avatar: AvatarConfiguration;
  level: number;
  rank: string;
  wins: number;
  matches: number;
  best_score: number;
  friendship_state: FriendshipState;
};

export type FriendLists = {
  friends: PublicPlayerProfile[];
  incoming: PublicPlayerProfile[];
  outgoing: PublicPlayerProfile[];
};

export type PvpContestSummary = { id: string; name: string; food: string; difficulty: string; duration_sec: number; bite_mechanic: string };
export type PvpChallenge = {
  challenge_id: string; status: "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED" | "EXPIRED";
  contest: PvpContestSummary; created_at: string; expires_at: string; match_id?: string; rematch_of?: string | null;
  direction: "INCOMING" | "OUTGOING"; player: PublicPlayerProfile | null;
};
export type PvpChallengeLists = { incoming: PvpChallenge[]; outgoing: PvpChallenge[]; history: PvpChallenge[] };
export type PvpMatchStatus = {
  match_id: string; status: "READY" | "ACTIVE" | "WAITING" | "FINAL" | "CANCELLED";
  contest: PvpContestSummary; player: PublicPlayerProfile; opponent: PublicPlayerProfile; own_attempt_state: "NOT_STARTED" | "active" | "VALID" | "INVALID";
  opponent_submitted: boolean; expires_at: string; already_finalized?: boolean;
  quip_events: PvpQuipEvent[]; quip_counts: Record<PvpQuipCategory, number>; approved_quips: Record<PvpQuipCategory, Record<string, string>>;
  rematch?: PvpChallenge | null;
  result?: { own_score: number; opponent_score: number; outcome: "WIN" | "LOSS" | "DRAW"; rewards: { coins: number; xp: number }; rating_change: number; rivalry: PvpRivalry };
};
export type PvpQuipCategory = "PRE_MATCH" | "IN_GAME" | "POST_MATCH";
export type PvpQuipEvent = { event_id: string; sender_public_id: string; quip_id: string; category: PvpQuipCategory; text: string; created_at: string };
export type PvpRivalry = { opponent?: PublicPlayerProfile; matches: number; wins: number; losses: number; draws: number };
export type PvpRecentOpponent = { player: PublicPlayerProfile; last_result: "WIN" | "LOSS" | "DRAW"; last_played_at: string; rivalry: PvpRivalry };
export type PvpAttemptStart = {
  match_id: string; attempt_id: string; contest: import("../api").Contest; validation_version: 3;
  authoritative_duration_sec: number; server_started_at: string; server_time: string; expires_at: string;
  player_tums: number; equipped_gear: string | null; perk_modifiers: Record<string, number>; opponent: PublicPlayerProfile;
};
