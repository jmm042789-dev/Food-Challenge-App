import { Audio } from "expo-av";

let tapSound: Audio.Sound | null = null;
let comboSound: Audio.Sound | null = null;
let startSound: Audio.Sound | null = null;

export async function loadSounds() {
  tapSound = new Audio.Sound();
  comboSound = new Audio.Sound();
  startSound = new Audio.Sound();

  await tapSound.loadAsync(require("../assets/sounds/tap.mp3"));
  await comboSound.loadAsync(require("../assets/sounds/combo.mp3"));
  await startSound.loadAsync(require("../assets/sounds/start.mp3"));
}

export async function playTap() {
  await tapSound?.replayAsync();
}

export async function playCombo() {
  await comboSound?.replayAsync();
}

export async function playStart() {
  await startSound?.replayAsync();
}