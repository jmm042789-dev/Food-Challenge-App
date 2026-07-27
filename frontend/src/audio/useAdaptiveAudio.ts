import { useCallback, useEffect, useMemo, useRef } from "react";
import { playSound, preloadAudio, resolveMusicState, stopMusic, transitionMusic } from "./AdaptiveAudioManager";
import type { AdaptiveAudioContext } from "./AudioTypes";

const GAMEPLAY_EVENTS = ["CORRECT_BITE", "COUNTDOWN_TICK", "URGENCY_TICK", "GO", "COMBO", "COMBO_MILESTONE", "PERFECT_MECHANIC", "LEAD_CHANGE", "CROWD_CHEER", "FINAL_10", "VICTORY", "DEFEAT", "ACHIEVEMENT_UNLOCK"] as const;

export function useAdaptiveAudio(context: AdaptiveAudioContext, resetKey: string, enabled = true) {
  const musicState = useMemo(() => resolveMusicState(context), [context]);
  const previousResetKey = useRef(resetKey);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const playGameplaySound = useCallback(
    (event: Parameters<typeof playSound>[0]) => (
      enabledRef.current ? playSound(event) : Promise.resolve()
    ),
    [],
  );

  useEffect(() => {
    void preloadAudio(GAMEPLAY_EVENTS);
  }, []);

  useEffect(() => {
    if (!enabled || context.status === "FINISHED") {
      void stopMusic(500);
      return;
    }
    if (context.status !== "PLAYING") {
      void stopMusic(400);
      return;
    }
    if (previousResetKey.current !== resetKey) {
      previousResetKey.current = resetKey;
      void stopMusic().then(() => transitionMusic(musicState));
    } else {
      void transitionMusic(musicState);
    }
  }, [context.status, enabled, musicState, resetKey]);

  useEffect(() => () => { enabledRef.current = false; void stopMusic(500); }, []);
  return { musicState, playSound: playGameplaySound };
}
