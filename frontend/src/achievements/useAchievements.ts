import { useCallback, useEffect, useState } from "react";
import { claimAchievement, migrateAchievementProgress } from "./AchievementTracker";
import { loadAchievementState } from "./AchievementStorage";
import type { AchievementMigrationSnapshot, AchievementState } from "./AchievementTypes";

export function useAchievements() {
  const [state, setState] = useState<AchievementState | null>(null);
  const refresh = useCallback(async () => {
    const nextState = await loadAchievementState();
    setState(nextState);
  }, []);
  const migrate = useCallback(async (snapshot: AchievementMigrationSnapshot) => {
    const nextState = await migrateAchievementProgress(snapshot);
    setState(nextState);
  }, []);
  const claim = useCallback(async (achievementId: string) => {
    const result = await claimAchievement(achievementId);
    setState(result.state);
    return result;
  }, []);
  useEffect(() => {
    let active = true;
    loadAchievementState().then((nextState) => { if (active) setState(nextState); });
    return () => { active = false; };
  }, []);
  return { state, refresh, migrate, claim };
}
