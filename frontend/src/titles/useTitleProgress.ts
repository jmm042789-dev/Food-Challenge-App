import { useCallback, useEffect, useRef, useState } from "react";
import { acknowledgeTitleUnlocks, equipTitle, loadTitleProgress, syncTitleUnlocks } from "./TitleProgress";
import type { TitleProgressContext, TitleProgressState, TitleUnlockNotification } from "./TitleTypes";

export function useTitleProgress() {
  const [state, setState] = useState<TitleProgressState | null>(null);
  const [notifications, setNotifications] = useState<TitleUnlockNotification[]>([]);
  const mounted = useRef(true);
  const sync = useCallback(async (context: TitleProgressContext) => {
    const result = await syncTitleUnlocks(context);
    if (!mounted.current) return;
    setState(result.state);
    if (result.newlyUnlocked.length) {
      setNotifications((current) => [...current, ...result.newlyUnlocked.filter((item) => !current.some((queued) => queued.titleId === item.titleId))]);
      const acknowledged = await acknowledgeTitleUnlocks(result.newlyUnlocked.map((item) => item.titleId));
      if (mounted.current) setState(acknowledged);
    }
  }, []);
  const equip = useCallback(async (titleId: string) => {
    const result = await equipTitle(titleId);
    if (mounted.current) setState(result.state);
    return result;
  }, []);
  useEffect(() => {
    mounted.current = true;
    loadTitleProgress().then((nextState) => { if (mounted.current) setState(nextState); });
    return () => { mounted.current = false; };
  }, []);
  return { state, notification: notifications[0] ?? null, dismissNotification: () => setNotifications((current) => current.slice(1)), sync, equip };
}
