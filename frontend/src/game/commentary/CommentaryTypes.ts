export type CommentaryEventType =
  | "MATCH_START"
  | "FIRST_BITE"
  | "COMBO_5"
  | "COMBO_10"
  | "COMBO_20"
  | "PERFECT_CHAIN"
  | "PLAYER_TAKES_LEAD"
  | "OPPONENT_TAKES_LEAD"
  | "LEAD_CHANGE"
  | "CLOSE_MATCH"
  | "FINAL_10_SECONDS"
  | "MATCH_FINISHED"
  | "NEW_HIGH_SCORE";

export type CommentaryPlaybackMode = "text" | "text_and_sound" | "voice";

export type CommentaryCatalogEntry = {
  messages: readonly string[];
  priority: number;
  cooldownMs: number;
  playbackMode?: CommentaryPlaybackMode;
  soundClipId?: string;
  voiceClipId?: string;
};

export type CommentaryEvent = { type: CommentaryEventType; occurredAt?: number };

export type CommentaryItem = {
  id: number;
  eventType: CommentaryEventType;
  text: string;
  priority: number;
  createdAt: number;
  playbackMode: CommentaryPlaybackMode;
  soundClipId?: string;
  voiceClipId?: string;
};
