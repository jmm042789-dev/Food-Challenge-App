import type { MusicDefinition, MusicState, SoundDefinition, SoundEvent } from "./AudioTypes";

const TAP = require("../../assets/sounds/tap.mp3");
const COMBO = require("../../assets/sounds/combo.mp3");
const START = require("../../assets/sounds/start.mp3");

export const SOUND_REGISTRY: Record<SoundEvent, SoundDefinition> = {
  BUTTON_PRESS: { source: TAP, priority: 1 }, COUNTDOWN_TICK: { source: TAP, priority: 3 }, GO: { source: START, priority: 6, duckMusicTo: 0.65, duckDurationMs: 500 },
  CORRECT_BITE: { source: TAP, priority: 2 }, COMBO: { source: COMBO, priority: 3 }, COMBO_MILESTONE: { source: COMBO, priority: 5, duckMusicTo: 0.72, duckDurationMs: 450 },
  PERFECT_MECHANIC: { source: COMBO, priority: 6, duckMusicTo: 0.65, duckDurationMs: 600 }, OPPONENT_SPECIAL_MOVE: { source: START, priority: 6, duckMusicTo: 0.65, duckDurationMs: 650 },
  LEAD_CHANGE: { source: COMBO, priority: 5, duckMusicTo: 0.72, duckDurationMs: 450 }, CROWD_CHEER: { source: COMBO, priority: 4 }, FINAL_10: { source: START, priority: 8, duckMusicTo: 0.48, duckDurationMs: 900 },
  VICTORY: { source: START, priority: 10, duckMusicTo: 0.35, duckDurationMs: 1400 }, DEFEAT: { source: START, priority: 9, duckMusicTo: 0.42, duckDurationMs: 1100 }, REWARD: { source: COMBO, priority: 5 },
  RESTAURANT_UNLOCK: { source: START, priority: 9, duckMusicTo: 0.4, duckDurationMs: 1200 }, TITLE_UNLOCK: { source: COMBO, priority: 8, duckMusicTo: 0.48, duckDurationMs: 900 },
  ACHIEVEMENT_UNLOCK: { source: COMBO, priority: 8, duckMusicTo: 0.48, duckDurationMs: 900 }, TOURNAMENT_REWARD: { source: START, priority: 9, duckMusicTo: 0.4, duckDurationMs: 1200 },
};

// Music sources intentionally remain optional until licensed loops are added.
export const MUSIC_REGISTRY: Record<MusicState, MusicDefinition> = {
  MENU: {}, MATCH_INTRO: {}, COUNTDOWN: {}, GAMEPLAY_NORMAL: {}, GAMEPLAY_INTENSE: {}, FINAL_10_SECONDS: {}, VICTORY: {}, DEFEAT: {}, RESULTS: {},
};
