import { useCallback, useEffect, useRef, useState } from "react";
import { RESTAURANT_BY_ID, RESTAURANT_CATALOG } from "../../restaurants/RestaurantCatalog";
import { TOURNAMENT_BY_ID } from "../../tournaments/TournamentCatalog";
import type { ArenaAtmosphereState, ArenaReaction, ArenaReactionType, ArenaTheme } from "./ArenaReactionTypes";

const CALLOUT_THROTTLE_MS = 1800;
const DECAY_PER_SECOND = 0.018;
const DEFAULT_THEME: ArenaTheme = {
  accentPrimary: "#F39A35",
  accentSecondary: "#D94A2C",
  callouts: ["NICE!", "UNBELIEVABLE!", "WHAT A COMBO!", "HE'S HEATING UP!"],
  crowdEnergyMultiplier: 1,
  ambientEffect: "embers",
};

const clamp = (value: number): number => Math.min(1, Math.max(0, value));

export function resolveArenaTheme(foodId?: string, tournamentOccurrenceId?: string): ArenaTheme {
  const tournamentId = tournamentOccurrenceId?.split(":")[0];
  const tournament = tournamentId ? TOURNAMENT_BY_ID.get(tournamentId) : undefined;
  const restaurant = tournament
    ? RESTAURANT_BY_ID.get(tournament.featuredRestaurantId)
    : RESTAURANT_CATALOG.find((item) => foodId && item.foodsAvailable.includes(foodId));
  const atmosphere = restaurant?.arenaAtmosphere;
  return atmosphere ? {
    restaurantId: restaurant?.id,
    accentPrimary: atmosphere.accentPrimary,
    accentSecondary: atmosphere.accentSecondary,
    callouts: atmosphere.callouts,
    crowdEnergyMultiplier: Math.min(1.3, Math.max(0.75, atmosphere.crowdEnergyMultiplier)),
    ambientEffect: atmosphere.ambientEffect,
  } : DEFAULT_THEME;
}

const reactionBoost = (reaction: ArenaReaction): number => {
  switch (reaction.type) {
    case "MATCH_START": return 0.12;
    case "PLAYER_COMBO": return Math.min(0.34, 0.08 + (reaction.combo ?? 0) * 0.009);
    case "OPPONENT_COMBO": return Math.min(0.28, 0.07 + (reaction.combo ?? 0) * 0.008);
    case "PLAYER_TAKES_LEAD":
    case "OPPONENT_TAKES_LEAD": return 0.18;
    case "CLOSE_MATCH": return 0.14;
    case "FINAL_10_SECONDS": return 0.24;
    case "MATCH_FINISHED": return 0.38;
  }
};

const fixedCallout = (reaction: ArenaReactionType): string | null => {
  if (reaction === "FINAL_10_SECONDS") return "FINAL 10!";
  if (reaction === "CLOSE_MATCH") return "SO CLOSE!";
  if (reaction === "MATCH_FINISHED") return "WHAT A FINISH!";
  return null;
};

export function useArenaAtmosphere(theme: ArenaTheme, resetKey: string) {
  const [state, setState] = useState<ArenaAtmosphereState>({ excitement: 0, lastReaction: null, callout: null, calloutKey: 0, reactionKey: 0, theme });
  const excitement = useRef(0);
  const lastReactionAt = useRef(Date.now());
  const lastCalloutAt = useRef(0);

  const reset = useCallback(() => {
    excitement.current = 0;
    lastReactionAt.current = Date.now();
    lastCalloutAt.current = 0;
    setState({ excitement: 0, lastReaction: null, callout: null, calloutKey: 0, reactionKey: 0, theme });
  }, [theme]);

  useEffect(() => { reset(); }, [reset, resetKey]);

  const react = useCallback((reaction: ArenaReaction) => {
    const now = reaction.occurredAt ?? Date.now();
    const elapsedSeconds = Math.max(0, now - lastReactionAt.current) / 1000;
    const decayed = Math.max(0, excitement.current - elapsedSeconds * DECAY_PER_SECOND);
    const nextExcitement = clamp(decayed + reactionBoost(reaction) * theme.crowdEnergyMultiplier);
    excitement.current = nextExcitement;
    lastReactionAt.current = now;
    const priorityCallout = fixedCallout(reaction.type);
    const mayCallout = Boolean(priorityCallout) || now - lastCalloutAt.current >= CALLOUT_THROTTLE_MS;
    const callout = mayCallout
      ? priorityCallout ?? theme.callouts[Math.floor(Math.random() * theme.callouts.length)] ?? null
      : null;
    if (callout) lastCalloutAt.current = now;
    setState((current) => ({
      excitement: nextExcitement,
      lastReaction: reaction.type,
      callout,
      calloutKey: callout ? current.calloutKey + 1 : current.calloutKey,
      reactionKey: current.reactionKey + 1,
      theme,
    }));
  }, [theme]);

  return { atmosphere: state, react, reset };
}
