import { Alert } from "react-native";
import type { MissionClaimResult } from "./MissionTypes";
import { useCallback, useEffect, useState } from "react";
import { claimMission, loadDailyMissions } from "./MissionTracker";
import type { DailyMissionState } from "./MissionTypes";

export function useDailyMissions() {
  const [state, setState] = useState<DailyMissionState | null>(null);
  const refresh = useCallback(async () => {
    try { const nextState = await loadDailyMissions(); setState(nextState); }
    catch { Alert.alert("Local milestones unavailable", "Please try again."); }
  }, []);
  const claim = useCallback(async (missionId: string) => {
    let result: MissionClaimResult;
    try { result = await claimMission(missionId); }
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
    loadDailyMissions().then((nextState) => { if (active) setState(nextState); }).catch(() => { if (active) Alert.alert("Local milestones unavailable", "Please try again."); });
    return () => { active = false; };
  }, []);

  return { state, refresh, claim };
}
