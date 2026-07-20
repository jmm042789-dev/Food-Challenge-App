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
    const result = await claimTournamentReward(activeTournament.occurrenceId, rewardId);
    if (mounted.current) setState(result.state);
    return result;
  }, [activeTournament.occurrenceId]);
  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => { mounted.current = false; };
  }, [refresh]);
  return { activeTournament, state, refresh, claim };
}
