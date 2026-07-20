// Compatibility facade for existing callers. New gameplay code uses the event registry.
export { loadAudioSettings, saveAudioSettings } from "./audio/AudioSettings";
export { playSound, releaseAudio, stopMusic, transitionMusic, updateAudioSettings } from "./audio/AdaptiveAudioManager";
export type { AudioSettings, MusicState, SoundEvent } from "./audio/AudioTypes";

import { playSound } from "./audio/AdaptiveAudioManager";

export async function loadSounds() { /* Sounds are loaded lazily and cached on first event. */ }
export async function playTap() { await playSound("CORRECT_BITE"); }
export async function playCombo() { await playSound("COMBO_MILESTONE"); }
export async function playStart() { await playSound("GO"); }
