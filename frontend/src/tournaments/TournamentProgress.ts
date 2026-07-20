import { storage } from "../utils/storage";
import { TOURNAMENT_BY_ID } from "./TournamentCatalog";
import type { TournamentClaimResult, TournamentMatchResult, TournamentPlayerProgress, TournamentProgressState } from "./TournamentTypes";

const STORAGE_KEY = "fire_feast_tournament_progress_v1";
const claimsInFlight = new Set<string>();
let updateQueue: Promise<unknown> = Promise.resolve();

const queueUpdate = <T>(operation: () => Promise<T>): Promise<T> => {
  const result = updateQueue.then(operation, operation);
  updateQueue = result.then(() => undefined, () => undefined);
  return result;
};

const freshProgress = (occurrenceId: string): TournamentPlayerProgress => ({
  occurrenceId, tournamentId: occurrenceId.split(":")[0], matchesEntered: 0, bestScore: 0, wins: 0, highestCombo: 0,
  finalPlacement: null, claimedRewardIds: [], claimedCoins: 0, claimedXp: 0, processedMatchIds: [],
});

export async function loadTournamentProgress(): Promise<TournamentProgressState> {
  const serialized = await storage.getItem(STORAGE_KEY, "");
  if (!serialized) return { version: 1, tournaments: [] };
  try {
    const stored = JSON.parse(serialized) as Partial<TournamentProgressState>;
    return { version: 1, tournaments: stored.tournaments ?? [] };
  } catch {
    return { version: 1, tournaments: [] };
  }
}

export function getTournamentPlayerProgress(state: TournamentProgressState, occurrenceId: string): TournamentPlayerProgress {
  return state.tournaments.find((item) => item.occurrenceId === occurrenceId) ?? freshProgress(occurrenceId);
}

export async function recordTournamentMatch(occurrenceId: string, result: TournamentMatchResult): Promise<TournamentProgressState> {
  return queueUpdate(async () => {
    const state = await loadTournamentProgress();
    const current = getTournamentPlayerProgress(state, occurrenceId);
    if (current.processedMatchIds.includes(result.matchId)) return state;
    const updated: TournamentPlayerProgress = {
      ...current,
      matchesEntered: current.matchesEntered + 1,
      bestScore: Math.max(current.bestScore, Math.max(0, result.score)),
      wins: current.wins + (result.won ? 1 : 0),
      highestCombo: Math.max(current.highestCombo, Math.max(0, result.highestCombo)),
      processedMatchIds: [...current.processedMatchIds, result.matchId].slice(-50),
    };
    const nextState = { ...state, tournaments: [...state.tournaments.filter((item) => item.occurrenceId !== occurrenceId), updated] };
    await storage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    return nextState;
  });
}

export async function claimTournamentReward(occurrenceId: string, rewardId: string): Promise<TournamentClaimResult> {
  const claimKey = `${occurrenceId}:${rewardId}`;
  if (claimsInFlight.has(claimKey)) return { ok: false, state: await loadTournamentProgress(), error: "CLAIM_IN_PROGRESS" };
  claimsInFlight.add(claimKey);
  try {
    return await queueUpdate(async () => {
      const state = await loadTournamentProgress();
      const current = state.tournaments.find((item) => item.occurrenceId === occurrenceId);
      if (!current) return { ok: false, state, error: "TOURNAMENT_NOT_FOUND" } as const;
      const reward = TOURNAMENT_BY_ID.get(current.tournamentId)?.rewardTable.find((item) => item.id === rewardId);
      if (!reward) return { ok: false, state, error: "REWARD_NOT_FOUND" } as const;
      if (current.claimedRewardIds.includes(rewardId)) return { ok: false, state, error: "ALREADY_CLAIMED" } as const;
      if (current.matchesEntered < 1 || current.bestScore < reward.minimumScore) return { ok: false, state, error: "REWARD_NOT_EARNED" } as const;
      const updated = { ...current, claimedRewardIds: [...current.claimedRewardIds, rewardId], claimedCoins: current.claimedCoins + reward.coins, claimedXp: current.claimedXp + reward.xp };
      const nextState = { ...state, tournaments: state.tournaments.map((item) => item.occurrenceId === occurrenceId ? updated : item) };
      if (!await storage.setItem(STORAGE_KEY, JSON.stringify(nextState))) return { ok: false, state, error: "PERSISTENCE_FAILED" } as const;
      return { ok: true, state: nextState, reward } as const;
    });
  } finally {
    claimsInFlight.delete(claimKey);
  }
}
