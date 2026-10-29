import { Alert } from "react-native";
import type { TournamentClaimResult } from "./TournamentTypes";
import { useCallback, useEffect, useRef, useState } from "react";
import { claimTournamentReward, loadTournamentProgress } from "./TournamentProgress";
import { getActiveTournament } from "./TournamentRotation";
import type { TournamentProgressState } from "./TournamentTypes";

export function useTournamentProgress() {
  const [activeTournament, setActiveTournament] = useState(getActiveTournament);
  const [state, setState] = useState<TournamentProgressState | null>(null);
  const mounted = useRef(true);
  const refresh = useCallback(async () => {
    const nextState = await loadTournamentProgress();
    if (mounted.current) {
      setActiveTournament(getActiveTournament());
      setState(nextState);
    }
  }, []);
  const claim = useCallback(async (rewardId: string) => {
    let result: TournamentClaimResult;
    try { result = await claimTournamentReward(activeTournament.occurrenceId, rewardId); }
    catch {
      Alert.alert("Couldn't save this milestone.", "It hasn't been recorded. Please try again.");
      return null;
    }
    if (result.ok) { if (mounted.current) setState(result.state); }
    else if (result.error !== "CLAIM_IN_PROGRESS") {
      Alert.alert("Local milestone", result.error === "ALREADY_CLAIMED" ? "Already recorded on this device."
        : result.error === "PERSISTENCE_FAILED" ? "Couldn't save this milestone. It hasn't been recorded. Please try again."
        : "This milestone is not ready to record.");
    }
    return result;
  }, [activeTournament.occurrenceId]);
  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => { mounted.current = false; };
  }, [refresh]);
  return { activeTournament, state, refresh, claim };
}
