import { Alert } from "react-native";
import type { ClaimAchievementResult } from "./AchievementTypes";
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
    let result: ClaimAchievementResult;
    try { result = await claimAchievement(achievementId); }
    catch {
      Alert.alert("Couldn't save this milestone.", "It hasn't been recorded. Please try again.");
      return null;
    }
    if (result.ok) { setState(result.state); }
    else if (result.error !== "CLAIM_IN_PROGRESS") {
      Alert.alert("Local milestone", result.error === "ALREADY_CLAIMED" ? "Already recorded on this device."
        : result.error === "PERSISTENCE_FAILED" ? "Couldn't save this milestone. It hasn't been recorded. Please try again."
        : "This milestone is not ready to record.");
    }
    return result;
  }, []);
  useEffect(() => {
    let active = true;
    loadAchievementState().then((nextState) => { if (active) setState(nextState); });
    return () => { active = false; };
  }, []);
  return { state, refresh, migrate, claim };
}
