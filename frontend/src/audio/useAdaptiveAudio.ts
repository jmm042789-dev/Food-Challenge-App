import { useEffect, useMemo, useRef } from "react";
import { playSound, resolveMusicState, stopMusic, transitionMusic } from "./AdaptiveAudioManager";
import type { AdaptiveAudioContext } from "./AudioTypes";

export function useAdaptiveAudio(context: AdaptiveAudioContext, resetKey: string) {
  const musicState = useMemo(() => resolveMusicState(context), [context]);
  const resultTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousResetKey = useRef(resetKey);

  useEffect(() => {
    if (resultTimer.current) clearTimeout(resultTimer.current);
    if (previousResetKey.current !== resetKey) {
      previousResetKey.current = resetKey;
      void stopMusic().then(() => transitionMusic(musicState));
    } else {
      void transitionMusic(musicState);
    }
    if (musicState === "VICTORY" || musicState === "DEFEAT") resultTimer.current = setTimeout(() => { void transitionMusic("RESULTS"); }, 1600);
    return () => { if (resultTimer.current) clearTimeout(resultTimer.current); resultTimer.current = null; };
  }, [musicState, resetKey]);

  useEffect(() => () => { if (resultTimer.current) clearTimeout(resultTimer.current); void stopMusic(); }, []);
  return { musicState, playSound };
}
