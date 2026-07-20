import type { AudioSource } from "expo-audio";
import type { GameStatus } from "../game/useGameLoop";

export type MusicState = "MENU" | "MATCH_INTRO" | "COUNTDOWN" | "GAMEPLAY_NORMAL" | "GAMEPLAY_INTENSE" | "FINAL_10_SECONDS" | "VICTORY" | "DEFEAT" | "RESULTS";
export type GameplayAudioIntensity = "NORMAL" | "INTENSE";
export type SoundEvent = "BUTTON_PRESS" | "COUNTDOWN_TICK" | "GO" | "CORRECT_BITE" | "COMBO" | "COMBO_MILESTONE" | "PERFECT_MECHANIC" | "OPPONENT_SPECIAL_MOVE" | "LEAD_CHANGE" | "CROWD_CHEER" | "FINAL_10" | "VICTORY" | "DEFEAT" | "REWARD" | "RESTAURANT_UNLOCK" | "TITLE_UNLOCK" | "ACHIEVEMENT_UNLOCK" | "TOURNAMENT_REWARD";

export type AudioSettings = { master: number; music: number; soundEffects: number; voice: number };
export type SoundDefinition = { source?: AudioSource; priority: number; duckMusicTo?: number; duckDurationMs?: number; caption?: string };
export type MusicDefinition = { source?: AudioSource; loop?: boolean; fadeMs?: number };
export type AdaptiveAudioContext = { status: GameStatus; combo: number; timeRemaining: number; arenaExcitement: number; scoreDifference: number; recentLeadChange?: boolean; playerWon?: boolean };
