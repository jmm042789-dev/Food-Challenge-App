import { useCallback, useEffect, useState } from "react";
import { claimMission, loadDailyMissions } from "./MissionTracker";
import type { DailyMissionState } from "./MissionTypes";

export function useDailyMissions() {
  const [state, setState] = useState<DailyMissionState | null>(null);
  const refresh = useCallback(async () => {
    const nextState = await loadDailyMissions();
    setState(nextState);
  }, []);
  const claim = useCallback(async (missionId: string) => {
    const result = await claimMission(missionId);
    setState(result.state);
    return result.reward;
  }, []);

  useEffect(() => {
    let active = true;
    loadDailyMissions().then((nextState) => { if (active) setState(nextState); });
    return () => { active = false; };
  }, []);

  return { state, refresh, claim };
}
