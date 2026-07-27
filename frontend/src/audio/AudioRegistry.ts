import type { MusicDefinition, MusicState, SoundDefinition, SoundEvent } from "./AudioTypes";

export const AUDIO_ASSETS = {
  music: {
    lobby: require("../../assets/sounds/lobby.mp3"),
    arena: require("../../assets/sounds/arena.mp3"),
  },
  sfx: {
    bite: require("../../assets/sounds/bite.mp3"),
    button: require("../../assets/sounds/button.mp3"),
    coins: require("../../assets/sounds/coins.mp3"),
    combo: require("../../assets/sounds/combo.mp3"),
    countdown: require("../../assets/sounds/countdown.mp3"),
    defeat: require("../../assets/sounds/defeat.mp3"),
    hurry: require("../../assets/sounds/hurry.mp3"),
    victory: require("../../assets/sounds/victory.mp3"),
    xp: require("../../assets/sounds/xp.mp3"),
  },
} as const;

export const SOUND_REGISTRY: Record<SoundEvent, SoundDefinition> = {
  BUTTON_PRESS: { source: AUDIO_ASSETS.sfx.button, priority: 1, minIntervalMs: 70, volumeScale: 0.45 },
  COUNTDOWN_TICK: { source: AUDIO_ASSETS.sfx.countdown, priority: 5, minIntervalMs: 800, volumeScale: 0.70 },
  URGENCY_TICK: { priority: 7, minIntervalMs: 1000 },
  GO: { source: AUDIO_ASSETS.sfx.countdown, priority: 6, minIntervalMs: 800, volumeScale: 0.70 },
  CORRECT_BITE: { source: AUDIO_ASSETS.sfx.bite, priority: 2, minIntervalMs: 35, volumeScale: 0.55, poolSize: 5 },
  COMBO: { source: AUDIO_ASSETS.sfx.combo, priority: 3, minIntervalMs: 180, volumeScale: 0.65 },
  COMBO_MILESTONE: { source: AUDIO_ASSETS.sfx.combo, priority: 5, duckMusicTo: 0.72, duckDurationMs: 450, minIntervalMs: 280, volumeScale: 0.65 },
  PERFECT_MECHANIC: { source: AUDIO_ASSETS.sfx.combo, priority: 6, duckMusicTo: 0.65, duckDurationMs: 600, volumeScale: 0.65 },
  OPPONENT_SPECIAL_MOVE: { source: AUDIO_ASSETS.sfx.hurry, priority: 6, duckMusicTo: 0.65, duckDurationMs: 650, volumeScale: 0.72 },
  LEAD_CHANGE: { source: AUDIO_ASSETS.sfx.combo, priority: 5, duckMusicTo: 0.72, duckDurationMs: 450, volumeScale: 0.65 },
  CROWD_CHEER: { source: AUDIO_ASSETS.sfx.combo, priority: 4, volumeScale: 0.65 },
  FINAL_10: { source: AUDIO_ASSETS.sfx.hurry, priority: 8, duckMusicTo: 0.58, duckDurationMs: 900, minIntervalMs: 1000, volumeScale: 0.72 },
  VICTORY: { source: AUDIO_ASSETS.sfx.victory, priority: 10, duckMusicTo: 0.35, duckDurationMs: 1400, minIntervalMs: 1200, volumeScale: 0.78 },
  DEFEAT: { source: AUDIO_ASSETS.sfx.defeat, priority: 9, duckMusicTo: 0.42, duckDurationMs: 1100, minIntervalMs: 1200, volumeScale: 0.62 },
  COINS: { source: AUDIO_ASSETS.sfx.coins, priority: 6, minIntervalMs: 500, volumeScale: 0.55 },
  XP: { source: AUDIO_ASSETS.sfx.xp, priority: 6, minIntervalMs: 500, volumeScale: 0.50 },
  REWARD: { source: AUDIO_ASSETS.sfx.coins, priority: 5, minIntervalMs: 250, volumeScale: 0.55 },
  RESTAURANT_UNLOCK: { source: AUDIO_ASSETS.sfx.victory, priority: 9, duckMusicTo: 0.4, duckDurationMs: 1200, volumeScale: 0.78 },
  TITLE_UNLOCK: { source: AUDIO_ASSETS.sfx.xp, priority: 8, duckMusicTo: 0.48, duckDurationMs: 900, volumeScale: 0.50 },
  ACHIEVEMENT_UNLOCK: { source: AUDIO_ASSETS.sfx.xp, priority: 8, duckMusicTo: 0.48, duckDurationMs: 900, volumeScale: 0.50 },
  TOURNAMENT_REWARD: { source: AUDIO_ASSETS.sfx.coins, priority: 9, duckMusicTo: 0.4, duckDurationMs: 1200, volumeScale: 0.55 },
};

export const MUSIC_REGISTRY: Record<MusicState, MusicDefinition> = {
  MENU: { source: AUDIO_ASSETS.music.lobby, loop: true, fadeMs: 550, volumeScale: 0.30 },
  MATCH_INTRO: {},
  COUNTDOWN: {},
  GAMEPLAY_NORMAL: { source: AUDIO_ASSETS.music.arena, loop: true, fadeMs: 600, volumeScale: 0.35 },
  GAMEPLAY_INTENSE: { source: AUDIO_ASSETS.music.arena, loop: true, fadeMs: 600, volumeScale: 0.35 },
  FINAL_10_SECONDS: { source: AUDIO_ASSETS.music.arena, loop: true, fadeMs: 600, volumeScale: 0.35 },
  VICTORY: {},
  DEFEAT: {},
  RESULTS: {},
};
