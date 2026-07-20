import { useCallback, useEffect, useRef, useState } from "react";
import { acknowledgeRestaurantUnlocks, loadRestaurantProgress, syncRestaurantUnlocks } from "./RestaurantProgress";
import type { RestaurantProgressState, RestaurantUnlockNotification } from "./RestaurantTypes";

export function useRestaurantProgress() {
  const [state, setState] = useState<RestaurantProgressState | null>(null);
  const [notifications, setNotifications] = useState<RestaurantUnlockNotification[]>([]);
  const mounted = useRef(true);
  const sync = useCallback(async (xp: number) => {
    const result = await syncRestaurantUnlocks({ xp });
    if (!mounted.current) return;
    setState(result.state);
    if (result.newlyUnlocked.length) {
      setNotifications((current) => [...current, ...result.newlyUnlocked.filter((item) => !current.some((queued) => queued.restaurantId === item.restaurantId))]);
      const acknowledged = await acknowledgeRestaurantUnlocks(result.newlyUnlocked.map((item) => item.restaurantId));
      if (mounted.current) setState(acknowledged);
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    loadRestaurantProgress().then((nextState) => { if (mounted.current) setState(nextState); });
    return () => { mounted.current = false; };
  }, []);
  return { state, notification: notifications[0] ?? null, dismissNotification: () => setNotifications((current) => current.slice(1)), sync };
}
