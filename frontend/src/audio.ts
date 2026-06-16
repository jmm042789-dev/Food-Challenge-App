/**
 * Simple sound manager wrapper around expo-audio.
 *
 * Audio assets are loaded from public CDN MP3 URLs (Pixabay royalty-free).
 * If a URL fails to load at runtime, the SFX silently no-ops — the rest of
 * the app continues to function. Swap URLs anytime in the SFX_URLS map.
 */
import { Platform } from "react-native";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";

const SFX_URLS: Record<string, string> = {
  // Royalty-free CDN sources; replace with your own if you have nicer audio
  chomp:     "https://cdn.pixabay.com/audio/2022/03/15/audio_88ca7e7e74.mp3",
  tums:      "https://cdn.pixabay.com/audio/2021/08/04/audio_dc39bbc81f.mp3",
  dunk:      "https://cdn.pixabay.com/audio/2022/03/10/audio_d0c79775a4.mp3",
  countdown: "https://cdn.pixabay.com/audio/2022/03/15/audio_d8c5e2c12a.mp3",
  win:       "https://cdn.pixabay.com/audio/2021/08/04/audio_0625c1539c.mp3",
  lose:      "https://cdn.pixabay.com/audio/2022/03/15/audio_166b9c34a8.mp3",
  reward:    "https://cdn.pixabay.com/audio/2022/03/15/audio_4caea27c7f.mp3",
  click:     "https://cdn.pixabay.com/audio/2022/03/24/audio_e8de2c2d6a.mp3",
};

const players: Record<string, AudioPlayer | null> = {};
let audioReady = false;
let userEnabled = true;

async function ensureAudioMode() {
  if (audioReady) return;
  try {
    await setAudioModeAsync({ playsInSilentMode: false, allowsRecording: false });
    audioReady = true;
  } catch {
    audioReady = true; // mark ready so we stop retrying — silent failure
  }
}

function getPlayer(key: string): AudioPlayer | null {
  if (players[key] !== undefined) return players[key];
  try {
    const p = createAudioPlayer({ uri: SFX_URLS[key] });
    p.volume = key === "win" || key === "reward" ? 0.9 : 0.7;
    players[key] = p;
    return p;
  } catch {
    players[key] = null;
    return null;
  }
}

export const sfx = {
  setEnabled(on: boolean) { userEnabled = on; },
  isEnabled() { return userEnabled; },
  play(key: keyof typeof SFX_URLS) {
    if (!userEnabled) return;
    if (Platform.OS === "web") return; // expo-audio on web is flaky for short SFX; skip
    ensureAudioMode();
    const p = getPlayer(String(key));
    if (!p) return;
    try {
      p.seekTo(0);
      p.play();
    } catch {
      // ignore
    }
  },
  preload() {
    if (Platform.OS === "web") return;
    ensureAudioMode();
    Object.keys(SFX_URLS).forEach((k) => getPlayer(k));
  },
};
