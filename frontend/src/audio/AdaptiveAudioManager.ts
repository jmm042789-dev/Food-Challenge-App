import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import { MUSIC_REGISTRY, SOUND_REGISTRY } from "./AudioRegistry";
import { DEFAULT_AUDIO_SETTINGS, loadAudioSettings, saveAudioSettings } from "./AudioSettings";
import type { AdaptiveAudioContext, AudioSettings, MusicState, SoundEvent } from "./AudioTypes";

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const effects = new Map<SoundEvent, AudioPlayer[]>();
const effectPoolIndex = new Map<SoundEvent, number>();
const lastPlayedAt = new Map<SoundEvent, number>();
let settings = DEFAULT_AUDIO_SETTINGS;
let settingsPromise: Promise<AudioSettings> | null = null;
let musicPlayer: AudioPlayer | null = null;
let musicState: MusicState | null = null;
let musicPlayerState: MusicState | null = null;
let transitionToken = 0;
let audioGeneration = 0;
let duckPriority = 0;
let duckTimer: ReturnType<typeof setTimeout> | null = null;
let duckLevel = 1;
let audioModePromise: Promise<void> | null = null;
let audioSuspended = false;
let desiredMusicState: MusicState | null = null;
const releasedPlayers = new WeakSet<AudioPlayer>();
type ActiveFade = {
  frame: ReturnType<typeof requestAnimationFrame> | null;
  resolve: () => void;
  token: number;
};
const activeFades = new Map<AudioPlayer, ActiveFade>();

const warnAudio = (message: string, error: unknown) => {
  if (__DEV__) console.warn(`[Fire Feast audio] ${message}`, error);
};

const musicVolume = (state = musicState) => {
  const volumeScale = state ? (MUSIC_REGISTRY[state].volumeScale ?? 1) : 1;
  return settings.muted ? 0 : clamp(settings.master * settings.music * duckLevel * volumeScale);
};
const effectVolume = (scale = 1) => settings.muted ? 0 : clamp(settings.master * settings.soundEffects * scale);

const isPlayerUsable = (player: AudioPlayer | null | undefined): player is AudioPlayer => (
  Boolean(player) && !releasedPlayers.has(player!)
);

const setPlayerVolume = (player: AudioPlayer | null | undefined, volume: number, token?: number) => {
  if (!isPlayerUsable(player) || (token !== undefined && token !== transitionToken)) return false;
  try {
    player.volume = clamp(volume);
    return true;
  } catch (error) {
    releasedPlayers.add(player);
    if (musicPlayer === player) { musicPlayer = null; musicPlayerState = null; }
    warnAudio("Unable to change volume on an invalid audio player.", error);
    return false;
  }
};

const getPlayerVolume = (player: AudioPlayer, fallback = 0) => {
  if (!isPlayerUsable(player)) return fallback;
  try {
    return player.volume;
  } catch (error) {
    releasedPlayers.add(player);
    if (musicPlayer === player) { musicPlayer = null; musicPlayerState = null; }
    warnAudio("Unable to read volume from an invalid audio player.", error);
    return fallback;
  }
};

const cancelFade = (player: AudioPlayer) => {
  const activeFade = activeFades.get(player);
  if (!activeFade) return;
  activeFades.delete(player);
  if (activeFade.frame !== null) cancelAnimationFrame(activeFade.frame);
  activeFade.resolve();
};

const releasePlayer = (player: AudioPlayer) => {
  if (!isPlayerUsable(player)) return;
  cancelFade(player);
  releasedPlayers.add(player);
  try { player.pause(); } catch { /* The native player may already be invalidated. */ }
  try { player.release(); } catch (error) { warnAudio("Unable to release an audio player.", error); }
};

const detachAndReleaseMusicPlayer = (player: AudioPlayer) => {
  if (musicPlayer === player) {
    musicPlayer = null;
    musicPlayerState = null;
  }
  releasePlayer(player);
};

const ensureSettings = async () => {
  if (!audioModePromise) audioModePromise = setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false, shouldPlayInBackground: false, shouldRouteThroughEarpiece: false, interruptionMode: "mixWithOthers" });
  await audioModePromise;
  if (!settingsPromise) settingsPromise = loadAudioSettings().then((loaded) => {
    settings = loaded;
    return loaded;
  });
  return settingsPromise;
};

const fade = (player: AudioPlayer, from: number, to: number, duration: number, token: number) => new Promise<void>((resolve) => {
  cancelFade(player);
  if (!isPlayerUsable(player) || token !== transitionToken) return resolve();
  const started = Date.now();
  const activeFade: ActiveFade = { frame: null, resolve, token };
  activeFades.set(player, activeFade);
  const finish = () => {
    if (activeFades.get(player) === activeFade) activeFades.delete(player);
    resolve();
  };
  const step = () => {
    if (
      activeFades.get(player) !== activeFade
      || activeFade.token !== transitionToken
      || !isPlayerUsable(player)
    ) {
      finish();
      return;
    }
    const progress = duration <= 0 ? 1 : Math.min(1, (Date.now() - started) / duration);
    if (!setPlayerVolume(player, from + (to - from) * progress, token)) {
      finish();
      return;
    }
    if (progress >= 1) finish();
    else activeFade.frame = requestAnimationFrame(step);
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
  desiredMusicState = nextState;
  try {
    if (audioSuspended) return;
    if (musicState === nextState && musicPlayerState === nextState && isPlayerUsable(musicPlayer)) return;
    const token = ++transitionToken;
    await ensureSettings();
    if (token !== transitionToken) return;
    const next = MUSIC_REGISTRY[nextState];
    const current = musicPlayerState ? MUSIC_REGISTRY[musicPlayerState] : null;
    if (musicPlayer && current?.source === next.source) {
      musicState = nextState;
      musicPlayerState = nextState;
      setPlayerVolume(musicPlayer, musicVolume(nextState));
      return;
    }
    const previous = musicPlayer;
    musicState = nextState;
    if (previous) {
      if (!isPlayerUsable(previous)) {
        if (musicPlayer === previous) { musicPlayer = null; musicPlayerState = null; }
      } else {
        await fade(previous, getPlayerVolume(previous), 0, next.fadeMs ?? 420, token);
      }
      if (token !== transitionToken) return;
      detachAndReleaseMusicPlayer(previous);
    }
    if (!next.source || token !== transitionToken) return;
    const player = createAudioPlayer(next.source);
    musicPlayer = player; musicPlayerState = nextState; player.loop = next.loop ?? true; setPlayerVolume(player, 0, token); player.play();
    await fade(player, 0, musicVolume(nextState), next.fadeMs ?? 420, token);
  } catch (error) {
    warnAudio(`Unable to transition to ${nextState} music.`, error);
  }
}

const duckMusic = (priority: number, level: number, duration: number) => {
  if (priority < duckPriority) return;
  duckPriority = priority; duckLevel = clamp(level);
  if (isPlayerUsable(musicPlayer)) setPlayerVolume(musicPlayer, musicVolume());
  if (duckTimer) clearTimeout(duckTimer);
  duckTimer = setTimeout(() => {
    duckPriority = 0;
    duckLevel = 1;
    if (isPlayerUsable(musicPlayer)) setPlayerVolume(musicPlayer, musicVolume());
    duckTimer = null;
  }, duration);
};

export async function playSound(event: SoundEvent): Promise<void> {
  try {
    if (audioSuspended) return;
    const generation = audioGeneration;
    await ensureSettings();
    if (generation !== audioGeneration || audioSuspended) return;
    const definition = SOUND_REGISTRY[event];
    if (!definition.source || effectVolume(definition.volumeScale) <= 0) return;
    const now = Date.now();
    if (now - (lastPlayedAt.get(event) ?? 0) < (definition.minIntervalMs ?? 0)) return;
    lastPlayedAt.set(event, now);
    let pool = effects.get(event);
    if (!pool) {
      pool = Array.from({ length: definition.poolSize ?? 1 }, () => createAudioPlayer(definition.source!));
      effects.set(event, pool);
    }
    const index = effectPoolIndex.get(event) ?? 0;
    const poolIndex = index % pool.length;
    let player = pool[poolIndex];
    if (!isPlayerUsable(player)) {
      player = createAudioPlayer(definition.source);
      pool[poolIndex] = player;
    }
    effectPoolIndex.set(event, (index + 1) % pool.length);
    if (!setPlayerVolume(player, effectVolume(definition.volumeScale))) return;
    player.pause();
    await player.seekTo(0);
    if (generation !== audioGeneration || !isPlayerUsable(player) || audioSuspended) return;
    player.play();
    if (definition.duckMusicTo !== undefined) duckMusic(definition.priority, definition.duckMusicTo, definition.duckDurationMs ?? 600);
  } catch (error) {
    warnAudio(`Unable to play ${event}.`, error);
  }
}

export async function preloadAudio(events: readonly SoundEvent[]): Promise<void> {
  try {
    const generation = audioGeneration;
    await ensureSettings();
    if (generation !== audioGeneration) return;
    events.forEach((event) => {
      if (effects.has(event)) return;
      const definition = SOUND_REGISTRY[event];
      if (!definition.source) return;
      effects.set(
        event,
        Array.from({ length: definition.poolSize ?? 1 }, () => {
          const player = createAudioPlayer(definition.source!);
          setPlayerVolume(player, effectVolume(definition.volumeScale));
          return player;
        }),
      );
    });
  } catch (error) {
    warnAudio("Unable to preload sound effects.", error);
  }
}

export async function updateAudioSettings(update: Partial<AudioSettings>) {
  settings = await saveAudioSettings(update);
  if (isPlayerUsable(musicPlayer)) setPlayerVolume(musicPlayer, musicVolume());
  effects.forEach((pool, event) => {
    const definition = SOUND_REGISTRY[event];
    pool.forEach((player) => { setPlayerVolume(player, effectVolume(definition.volumeScale)); });
  });
  return settings;
}

export function stopMusic(fadeMs = 280) {
  desiredMusicState = null;
  const player = musicPlayer;
  const token = ++transitionToken;
  musicState = null;
  if (!isPlayerUsable(player)) {
    if (musicPlayer === player) { musicPlayer = null; musicPlayerState = null; }
    return Promise.resolve();
  }
  return fade(player, getPlayerVolume(player), 0, fadeMs, token)
    .catch(() => undefined)
    .finally(() => {
      if (token === transitionToken && musicPlayer === player) detachAndReleaseMusicPlayer(player);
    });
}

export function releaseAudio() {
  transitionToken++; audioGeneration++; if (duckTimer) clearTimeout(duckTimer); duckTimer = null; duckPriority = 0; duckLevel = 1;
  const player = musicPlayer;
  musicPlayer = null; musicPlayerState = null;
  if (player) releasePlayer(player);
  effects.forEach((pool) => pool.forEach(releasePlayer)); effects.clear(); effectPoolIndex.clear(); lastPlayedAt.clear(); musicState = null;
  desiredMusicState = null; audioSuspended = false; settingsPromise = null; audioModePromise = null;
}

export async function initializeAudio(): Promise<void> {
  try {
    await ensureSettings();
    await preloadAudio(Object.keys(SOUND_REGISTRY) as SoundEvent[]);
  } catch (error) {
    warnAudio("Unable to initialize audio.", error);
  }
}

export const playLobbyMusic = () => transitionMusic("MENU");
export const playArenaMusic = () => transitionMusic("GAMEPLAY_NORMAL");
export const transitionToLobbyMusic = playLobbyMusic;
export const transitionToArenaMusic = playArenaMusic;
export const playSfx = playSound;

export function pauseAllAudio(): void {
  audioSuspended = true;
  transitionToken++;
  if (isPlayerUsable(musicPlayer)) musicPlayer.pause();
  effects.forEach((pool) => pool.forEach((player) => { if (isPlayerUsable(player)) player.pause(); }));
}

export async function resumeAudio(): Promise<void> {
  try {
    if (!audioSuspended) return;
    audioSuspended = false;
    if (isPlayerUsable(musicPlayer) && desiredMusicState === musicPlayerState) {
      setPlayerVolume(musicPlayer, musicVolume());
      musicPlayer.play();
      return;
    }
    if (desiredMusicState) await transitionMusic(desiredMusicState);
  } catch (error) {
    warnAudio("Unable to resume audio.", error);
  }
}

export const setMasterVolume = (value: number) => updateAudioSettings({ master: clamp(value) });
export const setMusicVolume = (value: number) => updateAudioSettings({ music: clamp(value) });
export const setSfxVolume = (value: number) => updateAudioSettings({ soundEffects: clamp(value) });
export const setMuted = (muted: boolean) => updateAudioSettings({ muted });
export const disposeAudio = releaseAudio;
