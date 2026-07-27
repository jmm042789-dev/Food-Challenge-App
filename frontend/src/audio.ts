import { playSound, preloadAudio, releaseAudio, setMuted, stopMusic, transitionMusic, updateAudioSettings } from "./audio/AdaptiveAudioManager";

// Compatibility facade for existing callers. New gameplay code uses the event registry.
export { loadAudioSettings, saveAudioSettings } from "./audio/AudioSettings";
export {
  disposeAudio,
  initializeAudio,
  pauseAllAudio,
  playArenaMusic,
  playLobbyMusic,
  playSfx,
  playSound,
  preloadAudio,
  releaseAudio,
  resumeAudio,
  setMasterVolume,
  setMuted,
  setSfxVolume,
  stopMusic,
  transitionMusic,
  transitionToArenaMusic,
  transitionToLobbyMusic,
  updateAudioSettings,
} from "./audio/AdaptiveAudioManager";
export type { AudioSettings, MusicState, SoundEvent } from "./audio/AudioTypes";

const GAMEPLAY_EVENTS = ["CORRECT_BITE", "COUNTDOWN_TICK", "URGENCY_TICK", "GO", "COMBO_MILESTONE", "VICTORY", "DEFEAT"] as const;

export async function preloadGameplayAudio() { await preloadAudio(GAMEPLAY_EVENTS); }
export async function startGameplayMusic() { await transitionMusic("GAMEPLAY_NORMAL"); }
export async function pauseGameplayMusic() { await stopMusic(160); }
export async function stopGameplayMusic() { await stopMusic(500); }
export async function playBiteSound() { await playSound("CORRECT_BITE"); }
export async function playCountdownTick() { await playSound("COUNTDOWN_TICK"); }
export async function playMatchStartSound() { await playSound("GO"); }
export async function playComboMilestoneSound() { await playSound("COMBO_MILESTONE"); }
export async function playUrgencyTick() { await playSound("URGENCY_TICK"); }
export async function playVictorySound() { await playSound("VICTORY"); }
export async function playDefeatSound() { await playSound("DEFEAT"); }
export function unloadGameplayAudio() { releaseAudio(); }
export async function setAudioMuted(muted: boolean) { await setMuted(muted); }
export async function setMusicVolume(volume: number) { await updateAudioSettings({ music: volume }); }
export async function setEffectsVolume(volume: number) { await updateAudioSettings({ soundEffects: volume }); }

export async function loadSounds() { await preloadGameplayAudio(); }
export async function playTap() { await playSound("CORRECT_BITE"); }
export async function playCombo() { await playSound("COMBO_MILESTONE"); }
export async function playStart() { await playSound("GO"); }
