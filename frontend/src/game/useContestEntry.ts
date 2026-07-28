import { useCallback, useRef } from "react";
import { Alert } from "react-native";
import { useRouter, type Href } from "expo-router";

import { api } from "../api";

type ContestEntryOptions = {
  tournamentOccurrenceId?: string;
};

const playRoute = (contestId: string, tournamentOccurrenceId?: string): Href => {
  const route = `/play/${encodeURIComponent(contestId)}`;
  return (tournamentOccurrenceId
    ? `${route}?tournament=${encodeURIComponent(tournamentOccurrenceId)}`
    : route) as Href;
};

export function useContestEntry() {
  const router = useRouter();
  const checking = useRef(false);

  return useCallback(async (contestId: string, options: ContestEntryOptions = {}) => {
    if (checking.current) return;
    checking.current = true;

    try {
      const activeMatch = await api.activeMatch();
      if (
        activeMatch.status !== "resumable"
        || typeof activeMatch.contest_id !== "string"
        || !activeMatch.contest_id
      ) {
        router.push(playRoute(contestId, options.tournamentOccurrenceId));
        return;
      }

      if (activeMatch.contest_id === contestId) {
        router.push(playRoute(activeMatch.contest_id, options.tournamentOccurrenceId));
        return;
      }

      Alert.alert(
        "Active Match",
        "You already have a match in progress.",
        [
          {
            text: "Resume Current Match",
            onPress: () => {
              router.push(playRoute(activeMatch.contest_id!));
            },
          },
          {
            text: "Abandon Match & Start New",
            style: "destructive",
            onPress: () => {
              void (async () => {
                try {
                  const result = await api.abandonMatch();
                  if (result.status === "cancelled" || result.status === "expired" || result.status === "settled" || result.status === "absent") {
                    router.push(playRoute(contestId, options.tournamentOccurrenceId));
                  }
                } catch {
                  Alert.alert("Unable to Abandon Match", "The active match could not be abandoned. Please try again.");
                }
              })();
            },
          },
          { text: "Cancel", style: "cancel" },
        ],
        { cancelable: true },
      );
    } catch {
      Alert.alert("Unable to Check Active Match", "Check your connection and try again.");
    } finally {
      checking.current = false;
    }
  }, [router]);
}
