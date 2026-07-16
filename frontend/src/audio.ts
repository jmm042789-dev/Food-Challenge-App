import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
} from "expo-audio";

type EffectName = "tap" | "combo" | "start";
type EffectSlot = {
  player: AudioPlayer;
  pendingRestart: boolean;
  operation: Promise<void> | null;
};

let effects: Record<EffectName, EffectSlot> | null = null;
let loadPromise: Promise<void> | null = null;
const loggedFailures = new Set<string>();

function logOnce(key: string, error: unknown) {
  if (loggedFailures.has(key)) return;
  loggedFailures.add(key);
  console.warn(`[audio] ${key} failed`, error);
}

function releaseEffects() {
  if (!effects) return;
  for (const { player } of Object.values(effects)) {
    try {
      player.release();
    } catch (error) {
      logOnce("player release", error);
    }
  }
  effects = null;
}

function waitUntilLoaded(player: AudioPlayer) {
  if (player.isLoaded) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      subscription.remove();
      reject(new Error("Timed out loading local sound"));
    }, 5000);
    const subscription = player.addListener("playbackStatusUpdate", (status) => {
      if (!status.isLoaded) return;
      clearTimeout(timeout);
      subscription.remove();
      resolve();
    });
  });
}

export async function loadSounds() {
  if (effects) return;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    releaseEffects();
    await setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording: false,
      shouldPlayInBackground: false,
      shouldRouteThroughEarpiece: false,
      interruptionMode: "mixWithOthers",
    });

    const players = {
      tap: createAudioPlayer(require("../assets/sounds/tap.mp3")),
      combo: createAudioPlayer(require("../assets/sounds/combo.mp3")),
      start: createAudioPlayer(require("../assets/sounds/start.mp3")),
    };

    effects = {
      tap: { player: players.tap, pendingRestart: false, operation: null },
      combo: { player: players.combo, pendingRestart: false, operation: null },
      start: { player: players.start, pendingRestart: false, operation: null },
    };

    await Promise.all(Object.values(players).map(waitUntilLoaded));
  })().catch((error) => {
    releaseEffects();
    logOnce("sound loading", error);
    throw error;
  }).finally(() => {
    loadPromise = null;
  });

  return loadPromise;
}

async function playEffect(name: EffectName) {
  try {
    await loadSounds();
    const slot = effects?.[name];
    if (!slot) return;

    slot.pendingRestart = true;
    if (slot.operation) return slot.operation;

    slot.operation = (async () => {
      while (slot.pendingRestart) {
        slot.pendingRestart = false;
        slot.player.pause();
        await slot.player.seekTo(0);
        slot.player.play();
      }
    })().catch((error) => {
      logOnce(`${name} playback`, error);
    }).finally(() => {
      slot.operation = null;
    });

    return slot.operation;
  } catch {
    // Initialization logs once; sound feedback must never interrupt gameplay.
  }
}

export async function playTap() {
  await playEffect("tap");
}

export async function playCombo() {
  await playEffect("combo");
}

export async function playStart() {
  await playEffect("start");
}
