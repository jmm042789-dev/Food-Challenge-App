import { storage } from "../utils/storage";
import type { AudioSettings } from "./AudioTypes";

const STORAGE_KEY = "fire_feast_audio_settings_v1";
export const DEFAULT_AUDIO_SETTINGS: AudioSettings = { master: 1, music: 0.72, soundEffects: 0.9, voice: 1 };
const clamp = (value: unknown, fallback: number) => Math.min(1, Math.max(0, Number.isFinite(Number(value)) ? Number(value) : fallback));

export async function loadAudioSettings(): Promise<AudioSettings> {
  const serialized = await storage.getItem(STORAGE_KEY, "");
  if (!serialized) return DEFAULT_AUDIO_SETTINGS;
  try {
    const stored = JSON.parse(serialized) as Partial<AudioSettings>;
    return { master: clamp(stored.master, 1), music: clamp(stored.music, 0.72), soundEffects: clamp(stored.soundEffects, 0.9), voice: clamp(stored.voice, 1) };
  } catch { return DEFAULT_AUDIO_SETTINGS; }
}

export async function saveAudioSettings(settings: Partial<AudioSettings>): Promise<AudioSettings> {
  const current = await loadAudioSettings();
  const next = { master: clamp(settings.master, current.master), music: clamp(settings.music, current.music), soundEffects: clamp(settings.soundEffects, current.soundEffects), voice: clamp(settings.voice, current.voice) };
  await storage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
