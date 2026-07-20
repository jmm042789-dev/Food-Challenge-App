import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import { MUSIC_REGISTRY, SOUND_REGISTRY } from "./AudioRegistry";
import { DEFAULT_AUDIO_SETTINGS, loadAudioSettings, saveAudioSettings } from "./AudioSettings";
import type { AdaptiveAudioContext, AudioSettings, MusicState, SoundEvent } from "./AudioTypes";

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const effects = new Map<SoundEvent, AudioPlayer>();
let settings = DEFAULT_AUDIO_SETTINGS;
let settingsPromise: Promise<AudioSettings> | null = null;
let musicPlayer: AudioPlayer | null = null;
let musicState: MusicState | null = null;
let transitionToken = 0;
let duckPriority = 0;
let duckTimer: ReturnType<typeof setTimeout> | null = null;
let duckLevel = 1;
let audioModePromise: Promise<void> | null = null;

const musicVolume = () => clamp(settings.master * settings.music * duckLevel);
const effectVolume = () => clamp(settings.master * settings.soundEffects);

const ensureSettings = async () => {
  if (!audioModePromise) audioModePromise = setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false, shouldPlayInBackground: false, shouldRouteThroughEarpiece: false, interruptionMode: "mixWithOthers" });
  await audioModePromise;
  if (!settingsPromise) settingsPromise = loadAudioSettings().then((loaded) => (settings = loaded));
  return settingsPromise;
};

const fade = (player: AudioPlayer, from: number, to: number, duration: number, token: number) => new Promise<void>((resolve) => {
  const started = Date.now();
  const step = () => {
    if (token !== transitionToken) return resolve();
    const progress = duration <= 0 ? 1 : Math.min(1, (Date.now() - started) / duration);
    player.volume = clamp(from + (to - from) * progress);
    if (progress >= 1) resolve(); else requestAnimationFrame(step);
  };
  step();
});

export function resolveMusicState(context: AdaptiveAudioContext): MusicState {
  if (context.status === "MATCH_INTRO") return "MATCH_INTRO";
  if (context.status === "COUNTDOWN") return "COUNTDOWN";
  if (context.status === "FINISHED") return context.playerWon ? "VICTORY" : "DEFEAT";
  if (context.status !== "PLAYING") return "MENU";
  if (context.timeRemaining <= 10) return "FINAL_10_SECONDS";
  const closeLateMatch = context.timeRemaining <= 20 && Math.abs(context.scoreDifference) <= 3;
  return context.combo >= 10 || context.arenaExcitement >= 0.55 || context.recentLeadChange || closeLateMatch ? "GAMEPLAY_INTENSE" : "GAMEPLAY_NORMAL";
}

export async function transitionMusic(nextState: MusicState): Promise<void> {
  if (musicState === nextState) return;
  await ensureSettings();
  const token = ++transitionToken;
  const next = MUSIC_REGISTRY[nextState];
  const previous = musicPlayer;
  musicState = nextState;
  if (previous) {
    await fade(previous, previous.volume, 0, next.fadeMs ?? 420, token);
    if (token !== transitionToken) return;
    previous.pause(); previous.release(); musicPlayer = null;
  }
  if (!next.source || token !== transitionToken) return;
  const player = createAudioPlayer(next.source);
  musicPlayer = player; player.loop = next.loop ?? true; player.volume = 0; player.play();
  await fade(player, 0, musicVolume(), next.fadeMs ?? 420, token);
}

const duckMusic = (priority: number, level: number, duration: number) => {
  if (priority < duckPriority) return;
  duckPriority = priority; duckLevel = clamp(level);
  if (musicPlayer) musicPlayer.volume = musicVolume();
  if (duckTimer) clearTimeout(duckTimer);
  duckTimer = setTimeout(() => { duckPriority = 0; duckLevel = 1; if (musicPlayer) musicPlayer.volume = musicVolume(); duckTimer = null; }, duration);
};

export async function playSound(event: SoundEvent): Promise<void> {
  await ensureSettings();
  const definition = SOUND_REGISTRY[event];
  if (!definition.source || effectVolume() <= 0) return;
  let player = effects.get(event);
  if (!player) { player = createAudioPlayer(definition.source); effects.set(event, player); }
  player.volume = effectVolume(); player.pause(); await player.seekTo(0); player.play();
  if (definition.duckMusicTo !== undefined) duckMusic(definition.priority, definition.duckMusicTo, definition.duckDurationMs ?? 600);
}

export async function updateAudioSettings(update: Partial<AudioSettings>) {
  settings = await saveAudioSettings(update);
  if (musicPlayer) musicPlayer.volume = musicVolume();
  effects.forEach((player) => { player.volume = effectVolume(); });
  return settings;
}

export function stopMusic(fadeMs = 280) {
  const player = musicPlayer;
  const token = ++transitionToken;
  musicState = null;
  if (!player) return Promise.resolve();
  return fade(player, player.volume, 0, fadeMs, token).finally(() => { if (musicPlayer === player) { player.pause(); player.release(); musicPlayer = null; } });
}

export function releaseAudio() {
  transitionToken++; if (duckTimer) clearTimeout(duckTimer); duckTimer = null; duckPriority = 0; duckLevel = 1;
  if (musicPlayer) { musicPlayer.pause(); musicPlayer.release(); musicPlayer = null; }
  effects.forEach((player) => player.release()); effects.clear(); musicState = null;
}
