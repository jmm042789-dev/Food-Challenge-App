import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { AccessibilityInfo, Alert, Animated, AppState, Easing, Image, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import * as Haptics from "expo-haptics";

import { api, type Contest, parseContests } from "../../src/api";
import ArcadeBackground from "../../src/game/ui/ArcadeBackground";
import CountdownOverlay from "../../src/game/ui/CountdownOverlay";
import EffectsLayer from "../../src/game/ui/EffectsLayer";
import FoodArena from "../../src/game/ui/FoodArena";
import GameplayHUD from "../../src/game/ui/GameplayHUD";
import HeartburnMeter from "../../src/game/ui/HeartburnMeter";
import VictoryOverlay, { type VictoryTournamentPresentation } from "../../src/game/ui/VictoryOverlay";
import SceneMotion, { type SceneMotionPhase } from "../../src/game/ui/SceneMotion";
import { useGameLoop } from "../../src/game/useGameLoop";
import { resolveContestDurationSeconds } from "../../src/game/contestDuration";
import FireScreenEntrance from "../../src/components/fire/FireScreenEntrance";
import FireButton from "../../src/components/fire/FireButton";
import FireEmptyState from "../../src/components/fire/FireEmptyState";
import FireLoading from "../../src/components/fire/FireLoading";
import HeatScreenOverlay from "../../src/game/ui/HeatScreenOverlay";
import HeatTierBanner from "../../src/game/ui/HeatTierBanner";
import AntacidCoolingFeedback from "../../src/game/ui/AntacidCoolingFeedback";
import HeatPresentationOverlay from "../../src/game/ui/HeatPresentationOverlay";
import CameraController, { type CameraControllerHandle } from "../../src/game/CameraController";
import { getFoodProfile } from "../../src/game/food/FoodProfiles";
import { getOpponentMood } from "../../src/game/ai/OpponentMood";
import { trackMissionEvent } from "../../src/missions/MissionTracker";
import { trackAchievementEvent } from "../../src/achievements/AchievementTracker";
import type { AchievementCompletionNotification, FoodMechanicType } from "../../src/achievements/AchievementTypes";
import { getTournamentPlayerProgress, recordTournamentMatch } from "../../src/tournaments/TournamentProgress";
import { TOURNAMENT_BY_ID } from "../../src/tournaments/TournamentCatalog";
import MatchIntroOverlay from "../../src/game/ui/MatchIntroOverlay";
import { resolveMatchIntroData } from "../../src/game/MatchIntro";
import { loadTitleProgress } from "../../src/titles/TitleProgress";
import { TITLE_BY_ID } from "../../src/titles/TitleCatalog";
import { beltForXp } from "../../src/ranks";
import ArenaEffects from "../../src/game/arena/ArenaEffects";
import { resolveArenaTheme, useArenaAtmosphere } from "../../src/game/arena/ArenaAtmosphere";
import CommentaryOverlay from "../../src/game/commentary/CommentaryOverlay";
import { useCommentaryEngine } from "../../src/game/commentary/CommentaryEngine";
import { useAdaptiveAudio } from "../../src/audio/useAdaptiveAudio";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePlayerBalance } from "../../src/playerBalance";
import { stopGameplayMusic } from "../../src/audio";
import { antacidHeatReduction } from "../../src/game/matchModifiers";
import { useAppPreferences } from "../../src/preferences/AppPreferences";
import { playerFacingErrorMessage } from "../../src/playerFacingErrors";
import {
  parseAuthoritativeOpponent,
  type AuthoritativeOpponentConfig,
} from "../../src/game/authoritativeOpponent";
import type { Opponent } from "../../src/game/ai/types";
import { initialResultFlow, transitionResultFlow } from "../../src/game/resultFlow";

const ANTACID_ICON = require("../../src/assets/icons/antacid.png");

export default function ContestScreen() {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { preferences } = useAppPreferences();
  const router = useRouter();
  const { contestId, replay: replayParam, tournament: tournamentParam } = useLocalSearchParams<{ contestId?: string | string[]; replay?: string | string[]; tournament?: string | string[] }>();
  const selectedContestId = Array.isArray(contestId) ? contestId[0] : contestId ?? "";
  const replayToken = Array.isArray(replayParam) ? replayParam[0] : replayParam ?? "";
  const tournamentOccurrenceId = Array.isArray(tournamentParam) ? tournamentParam[0] : tournamentParam ?? "";
  const matchRouteKey = `${selectedContestId}:${replayToken}:${tournamentOccurrenceId}`;
  const [contest, setContest] = useState<Contest | null>(null);
  const [contestLoaded, setContestLoaded] = useState(false);
  const [matchStartError, setMatchStartError] = useState(false);
  const [matchStartFailureMessage, setMatchStartFailureMessage] = useState("The arena could not start this match. Please try again.");
  const [matchStartAttempt, setMatchStartAttempt] = useState(0);
  const [playerAntacidCount, setPlayerAntacidCount] = useState<number | undefined>(undefined);
  const [equippedGear, setEquippedGear] = useState<string | null>(null);
  const [authoritativeOpponent, setAuthoritativeOpponent] = useState<Opponent | null>(null);
  const [authoritativeOpponentConfig, setAuthoritativeOpponentConfig] = useState<AuthoritativeOpponentConfig | null>(null);
  const [introPlayer, setIntroPlayer] = useState({ name: "Hungry Hero", rank: beltForXp(0).name, title: undefined as string | undefined });
  const matchDurationSeconds = resolveContestDurationSeconds(contest);
  const foodProfile = useMemo(
    () => getFoodProfile(selectedContestId, contest?.food),
    [contest?.food, selectedContestId],
  );
  const {
  state,
  timeRemaining,
  opponentScore,
  opponentCombo,
  currentOpponent,
  showCountdown,
  countdownValue,
  startGame,
  startMatchIntro,
  tap,
  heartburn,
  heatTier,
  heatMultiplier,
  isOverheated,
  overheatWarningActive,
  overheatPenaltyActive,
  overheatRemainingMs,
  antacidCount,
  canUseAntacid,
  applyAntacid,
  presentationEvents,
  matchStats,
} = useGameLoop({
  duration: matchDurationSeconds,
  matchKey: matchRouteKey,
  antacidCount: playerAntacidCount,
  equippedGear,
  opponent: authoritativeOpponent,
  opponentConfig: authoritativeOpponentConfig,

  foodId: selectedContestId,
  foodName: contest?.food,
  difficulty: contest?.difficulty,

  heatMultiplier:
    (contest as any)?.heatMultiplier ??
    (contest as any)?.heat_multiplier,

  extraHeat:
    (contest as any)?.extraHeat ??
    (contest as any)?.extra_heat,
});
  const [feedbackText, setFeedbackText] = useState<string | null>(null);
  const [showScore, setShowScore] = useState(false);
  const [comboLabel, setComboLabel] = useState("COMBO");
  const [highestCombo, setHighestCombo] = useState(0);
  const [matchTime, setMatchTime] = useState(0);
  const [nextContestId, setNextContestId] = useState<string | null>(null);
  const [roundLabel, setRoundLabel] = useState("WORLD TOUR EVENT");
  const [coolingTrigger, setCoolingTrigger] = useState(0);
  const [antacidAcknowledging, setAntacidAcknowledging] = useState(false);
  const [systemReducedMotion, setSystemReducedMotion] = useState(false);
  const reducedMotion = systemReducedMotion || preferences.reducedMotion;
  const hapticsEnabled = preferences.hapticsEnabled;
  const [playerXp, setPlayerXp] = useState(0);
  const [resultReward, setResultReward] = useState<{
    coins: number;
    xp: number;
    totalXp: number;
    won: boolean;
    acceptedScore: number;
    opponentScore: number;
    outcome: "win" | "loss" | "tie";
  } | null>(null);
  const [resultFlow, dispatchResultFlow] = useReducer(transitionResultFlow<NonNullable<typeof resultReward>>, undefined, initialResultFlow<NonNullable<typeof resultReward>>);
  const result = state.status === "FINISHED" && resultReward
    ? resultReward.outcome === "tie"
      ? "draw"
      : resultReward.outcome === "win" ? "victory" : "defeat"
    : null;
  const coins = usePlayerBalance();
  const [resultAchievements, setResultAchievements] = useState<AchievementCompletionNotification[]>([]);
  const [resultTournament, setResultTournament] = useState<VictoryTournamentPresentation | null>(null);
  const antacidPulse = useRef(new Animated.Value(0)).current;
  const antacidAcknowledgementTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cameraRef = useRef<CameraControllerHandle>(null);
  const started = useRef(false);
  const matchStartedAt = useRef<number | null>(null);
  const scoreFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serverOpponentId = useRef<string | null>(null);
  const serverMatchId = useRef<string | null>(null);
  const resultRequestInFlight = useRef(false);
  const abandonRequestInFlight = useRef(false);
  const resultNavigationInFlight = useRef(false);
  const submittedResultKey = useRef<string | null>(null);
  const previousStatus = useRef(state.status);
  const lastCameraCombo = useRef(state.combo);
  const lastBiteHapticAt = useRef(0);
  const missionRecordedMatch = useRef<string | null>(null);
  const achievementMatchEventId = useRef(`${matchRouteKey}:${Date.now()}:${Math.random().toString(36).slice(2)}`);
  const arenaTheme = useMemo(
    () => resolveArenaTheme(foodProfile.id, tournamentOccurrenceId),
    [foodProfile.id, tournamentOccurrenceId],
  );
  const { atmosphere, react: reactArena } = useArenaAtmosphere(arenaTheme, matchRouteKey);
  const adaptiveAudioContext = useMemo(() => ({
    status: state.status,
    combo: state.combo,
    timeRemaining,
    arenaExcitement: atmosphere.excitement,
    scoreDifference: state.score - opponentScore,
    recentLeadChange: atmosphere.lastReaction === "PLAYER_TAKES_LEAD" || atmosphere.lastReaction === "OPPONENT_TAKES_LEAD",
    playerWon: state.status === "FINISHED" ? state.score > opponentScore : undefined,
  }), [atmosphere.excitement, atmosphere.lastReaction, opponentScore, state.combo, state.score, state.status, timeRemaining]);
  const { playSound: playAudioEvent } = useAdaptiveAudio(adaptiveAudioContext, matchRouteKey, isFocused);
  const { commentary, commentate } = useCommentaryEngine(matchRouteKey);
  const previousArenaStatus = useRef(state.status);
  const previousArenaLead = useRef<"PLAYER" | "OPPONENT" | "TIED">("TIED");
  const arenaCloseMatch = useRef(false);
  const arenaFinalTenSent = useRef(false);
  const previousAudioTimeRemaining = useRef(timeRemaining);
  const lastAccessibilityCountdown = useRef<number | null>(null);
  const countdownAudioPlayed = useRef(false);
  const lastUrgencyAudioSecond = useRef<number | null>(null);
  const resultAudioKey = useRef<string | null>(null);
  const lastHeatPresentationId = useRef(0);
  const lastArenaPlayerCombo = useRef(0);
  const lastArenaOpponentCombo = useRef(0);
  const firstBiteCommented = useRef(false);
  const perfectChainCommented = useRef(false);
  const playerBestScore = useRef(0);
  const highScoreCommented = useRef(false);
  const activeResultKey = useRef(matchRouteKey);

  useEffect(() => {
    if (!contestLoaded || started.current) return;
    started.current = true;
    startMatchIntro();
  }, [contestLoaded, startMatchIntro]);

  useEffect(() => {
    if (!feedbackText) return;
    const timer = setTimeout(() => setFeedbackText(null), 650);
    return () => clearTimeout(timer);
  }, [feedbackText]);

  useEffect(() => {
    const newEvents = presentationEvents.filter((event) => event.id > lastHeatPresentationId.current);
    if (!newEvents.length) return;
    lastHeatPresentationId.current = newEvents[newEvents.length - 1].id;
    if (newEvents.some((event) => event.type === "OVERHEAT_WARNING_STARTED") && hapticsEnabled && !reducedMotion) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }
    if (newEvents.some((event) => event.type === "OVERHEATED")) {
      cameraRef.current?.shake(5);
      if (hapticsEnabled && !reducedMotion) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
    if (newEvents.some((event) => event.type === "PERFECT_COOLDOWN")) {
      void playAudioEvent("PERFECT_MECHANIC");
      if (hapticsEnabled && !reducedMotion) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  }, [hapticsEnabled, playAudioEvent, presentationEvents, reducedMotion]);

  useEffect(() => () => {
    if (scoreFeedbackTimer.current) clearTimeout(scoreFeedbackTimer.current);
    if (antacidAcknowledgementTimer.current) clearTimeout(antacidAcknowledgementTimer.current);
  }, []);

  useEffect(() => {
    setHighestCombo((current) => Math.max(current, state.combo));
  }, [state.combo]);

  useEffect(() => {
    if (state.combo !== lastCameraCombo.current) {
      lastCameraCombo.current = state.combo;
      if (state.combo >= 5 && state.combo % 5 === 0) {
        cameraRef.current?.comboPunch();
        cameraRef.current?.shake(4);
        void playAudioEvent("COMBO_MILESTONE");
        if (hapticsEnabled && !reducedMotion) {
          Haptics.impactAsync(state.combo >= 20 ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        }
      }
    }
  }, [hapticsEnabled, playAudioEvent, reducedMotion, state.combo]);

  useEffect(() => {
    if (state.status !== "COUNTDOWN") return;
    if (!countdownAudioPlayed.current) {
      countdownAudioPlayed.current = true;
      void playAudioEvent("COUNTDOWN_TICK");
    }
    if (countdownValue === "GO") {
      cameraRef.current?.countdownSettle();
      if (hapticsEnabled && !reducedMotion) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
  }, [countdownValue, hapticsEnabled, playAudioEvent, reducedMotion, state.status]);

  useEffect(() => {
    const priorStatus = previousStatus.current;
    previousStatus.current = state.status;

    if (state.status === "PLAYING" && priorStatus !== "PLAYING") {
      cameraRef.current?.reset();
    } else if (state.status === "FINISHED" && priorStatus !== "FINISHED") {
      const won = state.score > opponentScore;
      if (won) cameraRef.current?.victoryZoom();
      else cameraRef.current?.defeatSettle();
      if (hapticsEnabled && !reducedMotion) {
        Haptics.notificationAsync(won ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning).catch(() => {});
      }
    }
  }, [hapticsEnabled, opponentScore, playAudioEvent, reducedMotion, state.score, state.status]);

  useEffect(() => {
    cameraRef.current?.reset();
    lastCameraCombo.current = 0;
    missionRecordedMatch.current = null;
    achievementMatchEventId.current = `${matchRouteKey}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    previousArenaLead.current = "TIED";
    arenaCloseMatch.current = false;
    arenaFinalTenSent.current = false;
    previousAudioTimeRemaining.current = matchDurationSeconds;
    lastAccessibilityCountdown.current = null;
    countdownAudioPlayed.current = false;
    lastUrgencyAudioSecond.current = null;
    resultAudioKey.current = null;
    lastHeatPresentationId.current = 0;
    lastArenaPlayerCombo.current = 0;
    lastArenaOpponentCombo.current = 0;
    firstBiteCommented.current = false;
    perfectChainCommented.current = false;
    highScoreCommented.current = false;
    activeResultKey.current = matchRouteKey;
    serverOpponentId.current = null;
    serverMatchId.current = null;
    resultRequestInFlight.current = false;
    submittedResultKey.current = null;
    if (antacidAcknowledgementTimer.current) clearTimeout(antacidAcknowledgementTimer.current);
    antacidAcknowledgementTimer.current = null;
    setAntacidAcknowledging(false);
    setResultAchievements([]);
    setResultTournament(null);
    setResultReward(null);
    dispatchResultFlow({ type: "RESET" });
  }, [matchDurationSeconds, matchRouteKey]);

  useEffect(() => {
    if (state.status === "FINISHED") dispatchResultFlow({ type: "FINISH" });
  }, [state.status]);

  useEffect(() => {
    if (resultFlow.phase === "FINISHED") dispatchResultFlow({ type: "SUBMIT" });
  }, [resultFlow.phase]);

  useEffect(() => {
    if (resultFlow.phase === "OFFICIAL_RESULT_RECEIVED" || resultFlow.phase === "NAVIGATING_RESULT") {
      dispatchResultFlow({ type: "SHOW_RESULT" });
    }
  }, [resultFlow.phase]);

  useEffect(() => {
    if (resultFlow.phase !== "SUBMITTING_RESULT" || submittedResultKey.current === matchRouteKey || resultRequestInFlight.current) return;
    const opponentId = serverOpponentId.current;
    const matchId = serverMatchId.current;
    if (!opponentId || !matchId) return;

    resultRequestInFlight.current = true;
    const duration = matchStartedAt.current === null
      ? matchDurationSeconds
      : Math.max(1, Math.round((Date.now() - matchStartedAt.current) / 1000));
    void api.submitResult({
      match_id: matchId,
      contest_id: selectedContestId,
      score: state.score,
      opponent_score: opponentScore,
      duration_sec: duration,
      accepted_taps: state.acceptedTapCount,
      completed_progress: state.completedProgress,
      maximum_combo: highestCombo,
      opponent_id: opponentId,
      tums_used: Math.max(0, (playerAntacidCount ?? antacidCount) - antacidCount),
      completion_reason: "timer_completed",
      is_tournament: Boolean(tournamentOccurrenceId),
    }).then((response) => {
      const reward = response as {
        coin_reward?: unknown;
        xp_reward?: unknown;
        new_xp?: unknown;
        won?: unknown;
        accepted_score?: unknown;
        authoritative_opponent_score?: unknown;
        authoritative_outcome?: unknown;
      };
      if (
        typeof reward.coin_reward !== "number"
        || !Number.isFinite(reward.coin_reward)
        || typeof reward.xp_reward !== "number"
        || !Number.isFinite(reward.xp_reward)
        || typeof reward.new_xp !== "number"
        || !Number.isFinite(reward.new_xp)
        || typeof reward.won !== "boolean"
        || typeof reward.accepted_score !== "number"
        || !Number.isFinite(reward.accepted_score)
        || typeof reward.authoritative_opponent_score !== "number"
        || !Number.isFinite(reward.authoritative_opponent_score)
        || !["win", "loss", "tie"].includes(String(reward.authoritative_outcome))
      ) {
        throw new Error("Match reward response was invalid.");
      }
      const officialResult = {
        coins: Math.max(0, reward.coin_reward),
        xp: Math.max(0, reward.xp_reward),
        totalXp: Math.max(0, reward.new_xp),
        won: reward.won,
        acceptedScore: Math.max(0, reward.accepted_score),
        opponentScore: Math.max(0, reward.authoritative_opponent_score),
        outcome: reward.authoritative_outcome as "win" | "loss" | "tie",
      };
      setResultReward(officialResult);
      submittedResultKey.current = matchRouteKey;
      dispatchResultFlow({ type: "ACCEPT", result: officialResult });
    }).catch((error: unknown) => {
      dispatchResultFlow({ type: "REJECT", error });
    }).finally(() => {
      resultRequestInFlight.current = false;
    });
  }, [antacidCount, highestCombo, matchDurationSeconds, matchRouteKey, opponentScore, playerAntacidCount, resultFlow.attempt, resultFlow.phase, selectedContestId, state.acceptedTapCount, state.completedProgress, state.score, tournamentOccurrenceId]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active" || (state.status !== "COUNTDOWN" && state.status !== "PLAYING")) return;
      void api.activeMatch().then((recovery) => {
        if (
          recovery.status !== "resumable"
          || recovery.match_id !== serverMatchId.current
        ) {
          setMatchStartError(true);
        }
      }).catch(() => {
        // A transient resume check must not interrupt an otherwise active round.
      });
    });
    return () => subscription.remove();
  }, [state.status]);

  useEffect(() => {
    const priorStatus = previousArenaStatus.current;
    previousArenaStatus.current = state.status;
    if (state.status === "PLAYING" && priorStatus !== "PLAYING") {
      reactArena({ type: "MATCH_START" });
      commentate({ type: "MATCH_START" });
    }
    if (state.status === "FINISHED" && priorStatus !== "FINISHED") {
      reactArena({ type: "MATCH_FINISHED", playerWon: state.score > opponentScore });
      commentate({ type: "MATCH_FINISHED" });
      if (!highScoreCommented.current && state.score > playerBestScore.current) {
        highScoreCommented.current = true;
        playerBestScore.current = state.score;
        commentate({ type: "NEW_HIGH_SCORE" });
      }
    }
  }, [commentate, opponentScore, playAudioEvent, reactArena, state.score, state.status]);

  useEffect(() => {
    if (!result || resultAudioKey.current === matchRouteKey) return;
    resultAudioKey.current = matchRouteKey;
    if (result === "victory") void playAudioEvent("VICTORY");
    else if (result === "defeat") void playAudioEvent("DEFEAT");
  }, [matchRouteKey, playAudioEvent, result]);

  useEffect(() => {
    if (state.status !== "PLAYING" || state.combo < 5) return;
    const milestone = Math.floor(state.combo / 5) * 5;
    if (milestone <= lastArenaPlayerCombo.current) return;
    lastArenaPlayerCombo.current = milestone;
    reactArena({ type: "PLAYER_COMBO", combo: milestone });
    if (milestone === 5) commentate({ type: "COMBO_5" });
    else if (milestone === 10) commentate({ type: "COMBO_10" });
    else if (milestone === 20) commentate({ type: "COMBO_20" });
    if (milestone >= 30 && !perfectChainCommented.current) {
      perfectChainCommented.current = true;
      commentate({ type: "PERFECT_CHAIN" });
    }
  }, [commentate, reactArena, state.combo, state.status]);

  useEffect(() => {
    if (state.status !== "PLAYING" || opponentCombo < 5) return;
    const milestone = Math.floor(opponentCombo / 5) * 5;
    if (milestone <= lastArenaOpponentCombo.current) return;
    lastArenaOpponentCombo.current = milestone;
    reactArena({ type: "OPPONENT_COMBO", combo: milestone });
  }, [opponentCombo, reactArena, state.status]);

  useEffect(() => {
    if (state.status !== "PLAYING") return;
    const lead = state.score === opponentScore ? "TIED" : state.score > opponentScore ? "PLAYER" : "OPPONENT";
    const priorLead = previousArenaLead.current;
    if (lead !== "TIED" && lead !== priorLead) {
      reactArena({ type: lead === "PLAYER" ? "PLAYER_TAKES_LEAD" : "OPPONENT_TAKES_LEAD", scoreDifference: Math.abs(state.score - opponentScore) });
      if (priorLead !== "TIED") commentate({ type: "LEAD_CHANGE" });
      commentate({ type: lead === "PLAYER" ? "PLAYER_TAKES_LEAD" : "OPPONENT_TAKES_LEAD" });
      void playAudioEvent("LEAD_CHANGE");
    }
    previousArenaLead.current = lead;
    const leadingScore = Math.max(state.score, opponentScore);
    const close = leadingScore >= 8 && Math.abs(state.score - opponentScore) <= Math.max(2, leadingScore * 0.08);
    if (close && !arenaCloseMatch.current) {
      reactArena({ type: "CLOSE_MATCH", scoreDifference: Math.abs(state.score - opponentScore) });
      commentate({ type: "CLOSE_MATCH" });
      void playAudioEvent("CROWD_CHEER");
    }
    arenaCloseMatch.current = close;
  }, [commentate, opponentScore, playAudioEvent, reactArena, state.score, state.status]);

  useEffect(() => {
    const priorTimeRemaining = previousAudioTimeRemaining.current;
    previousAudioTimeRemaining.current = timeRemaining;
    if (state.status !== "PLAYING" || priorTimeRemaining <= 10 || timeRemaining > 10 || timeRemaining <= 0 || arenaFinalTenSent.current) return;
    arenaFinalTenSent.current = true;
    reactArena({ type: "FINAL_10_SECONDS" });
    commentate({ type: "FINAL_10_SECONDS" });
    void playAudioEvent("FINAL_10");
  }, [commentate, playAudioEvent, reactArena, state.status, timeRemaining]);

  useEffect(() => {
    if (state.status !== "PLAYING" || ![5, 3, 2, 1].includes(timeRemaining) || lastAccessibilityCountdown.current === timeRemaining) return;
    lastAccessibilityCountdown.current = timeRemaining;
    AccessibilityInfo.announceForAccessibility(
      timeRemaining === 5 ? "5 seconds remaining" : String(timeRemaining),
    );
  }, [state.status, timeRemaining]);

  useEffect(() => {
    if (
      state.status !== "PLAYING"
      || timeRemaining < 1
      || timeRemaining > 5
      || lastUrgencyAudioSecond.current === timeRemaining
    ) return;
    lastUrgencyAudioSecond.current = timeRemaining;
    void playAudioEvent("URGENCY_TICK");
  }, [playAudioEvent, state.status, timeRemaining]);

  useEffect(() => {
    if (state.status !== "FINISHED" || resultReward === null || missionRecordedMatch.current === matchRouteKey) return;
    missionRecordedMatch.current = matchRouteKey;
    const won = resultReward.won;
    void trackMissionEvent({
      type: "MATCH_COMPLETED",
      won,
      coinsEarned: resultReward.coins,
      xpEarned: resultReward.xp,
      highestCombo,
      foodId: foodProfile.id,
      opponentId: currentOpponent.id,
    });
    const resultKey = matchRouteKey;
    void trackAchievementEvent({
      type: "MATCH_COMPLETED",
      eventId: achievementMatchEventId.current,
      won,
      score: resultReward.acceptedScore,
      highestCombo,
      foodId: foodProfile.id,
      opponentId: currentOpponent.id,
      coinsEarned: resultReward.coins,
      xpEarned: resultReward.xp,
    }).then((achievementResult) => {
      if (activeResultKey.current === resultKey) {
        setResultAchievements(achievementResult.newlyCompleted);
        if (achievementResult.newlyCompleted.length) void playAudioEvent("ACHIEVEMENT_UNLOCK");
      }
    });
    if (tournamentOccurrenceId) {
      void recordTournamentMatch(tournamentOccurrenceId, {
        matchId: achievementMatchEventId.current,
        score: resultReward.acceptedScore,
        won,
        highestCombo,
      }).then((tournamentState) => {
        if (activeResultKey.current !== resultKey) return;
        const progress = getTournamentPlayerProgress(tournamentState, tournamentOccurrenceId);
        const definition = TOURNAMENT_BY_ID.get(progress.tournamentId);
        if (!definition) return;
        const maximumTarget = Math.max(1, ...definition.rewardTable.map((reward) => reward.minimumScore));
        const nextReward = definition.rewardTable.find((reward) => progress.bestScore < reward.minimumScore) ?? definition.rewardTable[definition.rewardTable.length - 1];
        setResultTournament({
          name: definition.name,
          bestScore: progress.bestScore,
          progress: Math.min(1, progress.bestScore / maximumTarget),
          rank: progress.finalPlacement,
          rewardPreview: nextReward ? `${nextReward.label}: ${nextReward.coins} COINS · ${nextReward.xp} XP` : undefined,
        });
      });
    }
  }, [currentOpponent.id, foodProfile.id, highestCombo, matchRouteKey, playAudioEvent, resultReward, state.status, tournamentOccurrenceId]);

  const arenaCallbacksRef = useRef({
    commentate,
    combo: state.combo,
    playAudioEvent,
    status: state.status,
    tap,
  });
  arenaCallbacksRef.current = {
    commentate,
    combo: state.combo,
    playAudioEvent,
    status: state.status,
    tap,
  };

  const handleMechanicCompleted = useCallback((mechanicType: FoodMechanicType) => {
    void trackAchievementEvent({ type: "FOOD_MECHANIC_COMPLETED", mechanicType });
    void arenaCallbacksRef.current.playAudioEvent("PERFECT_MECHANIC");
  }, []);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => { if (mounted) setSystemReducedMotion(enabled); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    antacidPulse.stopAnimation();
    antacidPulse.setValue(0);
    if (reducedMotion || !canUseAntacid || heartburn < 85) return;
    const pulseDuration = overheatWarningActive ? 330 : heartburn >= 90 ? 430 : 650;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(antacidPulse, { toValue: 1, duration: pulseDuration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(antacidPulse, { toValue: 0, duration: pulseDuration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [antacidPulse, canUseAntacid, heartburn, overheatWarningActive, reducedMotion]);

  useEffect(() => () => antacidPulse.stopAnimation(), [antacidPulse]);

  useEffect(() => {
    if (state.status === "PLAYING" && matchStartedAt.current === null) {
      matchStartedAt.current = Date.now();
    }

    if (state.status === "FINISHED" && matchStartedAt.current !== null) {
      setMatchTime(Math.max(1, Math.round((Date.now() - matchStartedAt.current) / 1000)));
    }
  }, [state.status]);

  useEffect(() => {
    let active = true;
    started.current = false;
    setContestLoaded(false);
    setMatchStartError(false);
    setMatchStartFailureMessage("The arena could not start this match. Please try again.");
    setContest(null);
    setEquippedGear(null);
    setAuthoritativeOpponent(null);
    setAuthoritativeOpponentConfig(null);

    async function loadContestDetails() {
      try {
        if (!selectedContestId || !/^[A-Za-z0-9._:-]{1,128}$/.test(selectedContestId)) {
          throw new Error("Invalid contest route");
        }
        const [contestResult, playerResult, titleResult] = await Promise.allSettled([
          api.listContests(),
          api.getPlayer(),
          loadTitleProgress(),
        ]);
        const contests = contestResult.status === "fulfilled" ? parseContests(contestResult.value) : [];
        const contestIndex = contests.findIndex((item) => item.id === selectedContestId);
        const selectedContest = contests[contestIndex];
        if (!selectedContest) throw new Error("Contest was not found");
        if (playerResult.status !== "fulfilled" || !playerResult.value) {
          throw new Error("Player balance was unavailable");
        }
        const player = playerResult.value as {
          antacid?: number;
          username?: string;
          xp?: number;
          best_score?: number;
          coins?: number;
        };
        if (Number(player.coins ?? 0) < selectedContest.entry_fee) {
          throw new Error("Not enough coins for this contest");
        }
        const activeMatch = await api.activeMatch();
        if (
          activeMatch.status === "resumable"
          && activeMatch.contest_id
          && activeMatch.contest_id !== selectedContestId
        ) {
          throw new Error("A different contest is already active.");
        }
        // startMatch is idempotent for the same contest and returns the original
        // opponent/start payload needed to resume without creating a new match.
        const match = await api.startMatch(selectedContestId);
        const parsedOpponent = parseAuthoritativeOpponent(match?.opponent_config);
        if (!parsedOpponent) throw new Error("Match opponent response was incomplete");

        if (active) {
          const inventory = Number(match?.player_tums);
          if (Number.isFinite(inventory)) setPlayerAntacidCount(Math.max(0, Math.floor(inventory)));
          setEquippedGear(typeof match?.equipped_gear === "string" ? match.equipped_gear : null);
          setAuthoritativeOpponent(parsedOpponent.opponent);
          setAuthoritativeOpponentConfig(parsedOpponent.config);
          playerBestScore.current = Math.max(0, Number(player.best_score) || 0);
          setPlayerXp(Math.max(0, Number(player.xp) || 0));
          const equippedTitleId = titleResult.status === "fulfilled" ? titleResult.value.equippedTitleId : null;
          setIntroPlayer({
            name: player.username?.trim() || "Hungry Hero",
            rank: beltForXp(Number(player.xp || 0)).name,
            title: equippedTitleId ? TITLE_BY_ID.get(equippedTitleId)?.displayName : undefined,
          });
        }

        if (active && contestIndex >= 0) {
          const authoritativeContest = match?.contest;
          setContest(
            authoritativeContest
            && typeof authoritativeContest === "object"
            && authoritativeContest.id === selectedContestId
              ? authoritativeContest as Contest
              : contests[contestIndex],
          );
          setNextContestId(contests[contestIndex + 1]?.id ?? null);
          setRoundLabel(`ROUND ${contestIndex + 1}`);
        }
        if (active) {
          const opponentId = String(match?.opponent?.id ?? "");
          const matchId = String(match?.match_id ?? "");
          if (!opponentId || !matchId) throw new Error("Match start response was incomplete");
          serverOpponentId.current = opponentId;
          serverMatchId.current = matchId;
          setContestLoaded(true);
        }
      } catch (error: unknown) {
        if (active) {
          setContest(null);
          setNextContestId(null);
          setRoundLabel("WORLD TOUR EVENT");
          setMatchStartFailureMessage(playerFacingErrorMessage(error));
          setMatchStartError(true);
        }
      }
    }

    loadContestDetails();

    return () => {
      active = false;
    };
  }, [matchRouteKey, matchStartAttempt, selectedContestId]);

  const handleTap = useCallback(() => {
    const { commentate: commentateLatest, combo, playAudioEvent: playAudioEventLatest, status, tap: tapLatest } = arenaCallbacksRef.current;
    if (status !== "PLAYING") return null;
    const acceptedActionSequence = tapLatest();
    if (acceptedActionSequence === null) return null;
    cameraRef.current?.bitePunch();
    void playAudioEventLatest("CORRECT_BITE");
    const now = Date.now();
    if (hapticsEnabled && !reducedMotion && now - lastBiteHapticAt.current >= 80) {
      lastBiteHapticAt.current = now;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    if (!firstBiteCommented.current) {
      firstBiteCommented.current = true;
      commentateLatest({ type: "FIRST_BITE" });
    }

    const nextCombo = combo + 1;
    if (nextCombo >= 100) {
      setFeedbackText("+200");
      setComboLabel("EPIC COMBO!");
    } else if (nextCombo >= 50) {
      setFeedbackText("+150");
      setComboLabel("MEGA COMBO");
    } else if (nextCombo >= 25) {
      setFeedbackText("+100");
      setComboLabel("FIRE COMBO");
    } else if (nextCombo >= 10) {
      setFeedbackText("+25");
      setComboLabel("HOT STREAK");
    } else if (nextCombo >= 5) {
      setFeedbackText("+10");
      setComboLabel("COMBO");
    } else {
      setFeedbackText("+5");
      setComboLabel("COMBO");
    }

    setShowScore(true);
    if (scoreFeedbackTimer.current) clearTimeout(scoreFeedbackTimer.current);
    scoreFeedbackTimer.current = setTimeout(() => setShowScore(false), 520);
    return acceptedActionSequence;
  }, [hapticsEnabled, reducedMotion]);

  const handleUseAntacid = useCallback((): boolean => {
    const heatReduction = antacidHeatReduction(heartburn);
    const used = applyAntacid();
    if (!used) return false;

    setCoolingTrigger((value) => value + 1);
    setAntacidAcknowledging(true);
    if (antacidAcknowledgementTimer.current) clearTimeout(antacidAcknowledgementTimer.current);
    antacidAcknowledgementTimer.current = setTimeout(() => {
      setAntacidAcknowledging(false);
      antacidAcknowledgementTimer.current = null;
    }, 420);
    cameraRef.current?.comboPunch(0.85);
    cameraRef.current?.shake(2.5);
    void playAudioEvent("PERFECT_MECHANIC");
    if (hapticsEnabled && !reducedMotion) {
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      ).catch(() => {});
    }
    setFeedbackText(`-${heatReduction} HEAT`);
    return true;
  }, [applyAntacid, heartburn, hapticsEnabled, playAudioEvent, reducedMotion]);
  const replay = () => {
    if (resultNavigationInFlight.current) return;
    resultNavigationInFlight.current = true;
    const tournamentQuery = tournamentOccurrenceId ? `&tournament=${encodeURIComponent(tournamentOccurrenceId)}` : "";
    router.replace(`/play/${selectedContestId}?replay=${Date.now()}${tournamentQuery}`);
  };

  const abandonAndReturn = () => {
    if (abandonRequestInFlight.current) return;
    abandonRequestInFlight.current = true;
    void stopGameplayMusic();
    void api.abandonMatch()
      .then(() => {
        abandonRequestInFlight.current = false;
        router.replace("/(tabs)/contests");
      })
      .catch(() => {
        abandonRequestInFlight.current = false;
        Alert.alert("Unable to leave match", "Check your connection and try again.");
      });
  };

  const continueToNextContest = () => {
    if (resultNavigationInFlight.current) return;
    resultNavigationInFlight.current = true;
    router.replace(nextContestId ? `/play/${nextContestId}` : "/(tabs)/contests");
  };

  const scenePhase: SceneMotionPhase = state.status === "FINISHED" ? "result" : state.status === "PLAYING" ? "active" : "intro";
  const comboImpact = state.combo === 10 || state.combo === 20 || (state.combo >= 30 && state.combo % 10 === 0) ? state.combo : 0;
  const opponentMood = useMemo(() => getOpponentMood({
    playerScore: state.score,
    opponentScore,
    playerCombo: state.combo,
    timeRemaining,
    matchDuration: matchDurationSeconds,
    matchFinished: state.status === "FINISHED",
  }), [matchDurationSeconds, opponentScore, state.combo, state.score, state.status, timeRemaining]);
  const matchIntroData = useMemo(() => resolveMatchIntroData({
    tournamentOccurrenceId,
    foodId: foodProfile.id,
    foodName: contest?.food ?? foodProfile.displayName,
    challengeName: contest?.name ?? `${foodProfile.displayName} Challenge`,
    playerName: introPlayer.name,
    playerTitle: introPlayer.title,
    playerRank: introPlayer.rank,
    opponentName: currentOpponent.name,
    opponentSubtitle: currentOpponent.personality,
  }), [contest?.food, contest?.name, currentOpponent.name, currentOpponent.personality, foodProfile.displayName, foodProfile.id, introPlayer.name, introPlayer.rank, introPlayer.title, tournamentOccurrenceId]);

  if (resultFlow.phase === "RESULT_ERROR") {
    return (
      <View style={styles.container}>
        <ArcadeBackground reducedMotion={reducedMotion} />
        <FireEmptyState
          icon="!"
          title="Result Not Verified"
          message={`${playerFacingErrorMessage(resultFlow.error)} No rewards were applied. Retry safely for this match's official result.`}
          buttonLabel="RETRY RESULT"
          onPress={() => {
            dispatchResultFlow({ type: "RETRY" });
          }}
        />
        <FireButton title="RETURN TO ARENA" onPress={() => router.replace("/(tabs)/contests")} variant="secondary" style={styles.recoveryButton} />
      </View>
    );
  }

  if (matchStartError) {
    return (
      <View style={styles.container}>
        <ArcadeBackground reducedMotion={reducedMotion} />
        <FireEmptyState
          icon="!"
          title="Unable to Start the Feast"
          message={matchStartFailureMessage}
          buttonLabel="RETRY"
          onPress={() => setMatchStartAttempt((current) => current + 1)}
        />
        <FireButton
          title="RETURN TO ARENA"
          onPress={abandonAndReturn}
          variant="secondary"
          style={styles.recoveryButton}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View
        accessibilityElementsHidden={showCountdown || result !== null}
        importantForAccessibility={showCountdown || result !== null ? "no-hide-descendants" : "auto"}
        style={styles.gameplayLayer}
      >
      <ArcadeBackground combo={state.combo} phase={state.status === "FINISHED" ? "result" : state.status === "PLAYING" ? "active" : "intro"} reducedMotion={reducedMotion} />
      <ArenaEffects atmosphere={atmosphere} reducedMotion={reducedMotion} />
      <CommentaryOverlay item={commentary} reducedMotion={reducedMotion} />
      <HeatScreenOverlay heartburn={heartburn} heatTier={heatTier} isOverheated={isOverheated} />
      <HeatTierBanner heatTier={heatTier} />
      <AntacidCoolingFeedback trigger={coolingTrigger} />
      <HeatPresentationOverlay events={presentationEvents} overheatWarningActive={overheatWarningActive} overheatRemainingMs={overheatRemainingMs} />

      <MatchIntroOverlay
        visible={state.status === "MATCH_INTRO"}
        data={matchIntroData}
        reducedMotion={reducedMotion}
        resetKey={matchRouteKey}
        onComplete={startGame}
      />

      <EffectsLayer
        showScore={showScore}
        scoreText={feedbackText ?? "+0"}
        showCombo={showScore && state.combo >= 5}
        comboText={comboLabel}
        combo={state.combo}
      />

      <CameraController ref={cameraRef} phase={scenePhase} reducedMotion={reducedMotion || !preferences.cameraEffectsEnabled}>
      <SceneMotion phase={scenePhase} comboImpact={comboImpact} reducedMotion={reducedMotion} style={[styles.overlay, { paddingTop: Math.max(insets.top, 5), paddingBottom: Math.max(insets.bottom, 6) }]}>
        <FireScreenEntrance disabled={state.status !== "PLAYING"} duration="fast" distance={8}>
        <GameplayHUD
          level={1}
          xp={25}
          nextLevelXp={100}
          coins={coins}
          timeRemaining={timeRemaining}
          playerScore={resultReward?.acceptedScore ?? state.score}
          opponentScore={resultReward?.opponentScore ?? opponentScore}
          combo={state.combo}
          opponentName={currentOpponent.name}
          opponentAvatar={currentOpponent.avatar}
          opponentPersonality={currentOpponent.personality}
          opponentMood={opponentMood}
          contestName={contest?.name}
          location={contest?.location}
          difficulty={contest?.difficulty}
          roundLabel={roundLabel}
        />
        </FireScreenEntrance>

        <View style={styles.utilityHud}>
          <View style={styles.matchModifierRow}>
            {matchStats.equippedGearName ? <Text style={styles.perkIndicator}>⚡ {matchStats.equippedGearName.toUpperCase()}</Text> : null}
            {state.antacidProtectionRemainingMs > 0 ? <Text style={styles.shieldIndicator}>🛡 HEAT SHIELD</Text> : null}
            {state.freshStomachRemainingMs > 0 ? <Text style={styles.freshIndicator}>✨ FRESH STOMACH +10%</Text> : null}
          </View>
          <View style={styles.utilityControlsRow}>
          <HeartburnMeter
            coolingTrigger={coolingTrigger}
            heartburn={heartburn}
            heatMultiplier={heatMultiplier}
            heatTier={heatTier}
            isOverheated={isOverheated}
            overheatPenaltyActive={overheatPenaltyActive}
            overheatRemainingMs={overheatRemainingMs}
          />
        {state.status === "PLAYING" ? (
          <Animated.View style={[styles.antacidControl, canUseAntacid && heartburn >= 85 && styles.antacidControlCritical, canUseAntacid && overheatWarningActive && styles.antacidControlWarning, antacidAcknowledging && styles.antacidControlAcknowledged, { opacity: canUseAntacid || antacidAcknowledging ? 1 : 0.46, transform: [{ scale: antacidPulse.interpolate({ inputRange: [0, 1], outputRange: [1, overheatWarningActive ? 1.11 : heartburn >= 90 ? 1.075 : 1.045] }) }] }]}>
            <FireButton
              accessibilityHint={`Reduces heat by ${antacidHeatReduction(heartburn)} and protects from new heat for two seconds.`}
              accessibilityLabel={antacidCount <= 0 ? "Antacid unavailable, none remaining" : `Use antacid, ${antacidCount} remaining, reduce heat by ${antacidHeatReduction(heartburn)}`}
              title={antacidAcknowledging ? "ANTACID!" : overheatWarningActive ? "SAVE COMBO" : "ANTACID"}
              subtitle={antacidAcknowledging ? `-${antacidHeatReduction(heartburn)} HEAT` : overheatWarningActive ? `USE NOW · ${antacidCount} LEFT` : heartburn >= 90 && canUseAntacid ? `READY · -${antacidHeatReduction(heartburn)} HEAT · ${antacidCount}` : `-${antacidHeatReduction(heartburn)} HEAT · ${antacidCount} LEFT`}
              leftIcon={<Image accessibilityIgnoresInvertColors source={ANTACID_ICON} resizeMode="contain" style={styles.antacidIcon} />}
              size="compact"
              variant={canUseAntacid && heartburn >= 85 ? "gold" : "secondary"}
              disabled={!canUseAntacid || antacidAcknowledging}
              haptic={false}
              onPress={handleUseAntacid}
              style={styles.antacidButton}
            />
          </Animated.View>
        ) : null}
          </View>
        </View>
        <View style={styles.gameplayContent}>
          <FoodArena
            active={state.status === "PLAYING"}
            biteMechanic={contest?.bite_mechanic}
            combo={state.combo}
            contestId={selectedContestId}
            foodName={contest?.food}
            foodProfile={foodProfile}
            heatTier={heatTier}
            overheatWarningActive={overheatWarningActive}
            resetKey={matchRouteKey}
            timeRemaining={timeRemaining}
            onAcceptedAction={handleTap}
            onMechanicCompleted={handleMechanicCompleted}
          />
        </View>
      </SceneMotion>
      </CameraController>
      </View>

      <CountdownOverlay
        visible={showCountdown}
        value={countdownValue}
        contestId={selectedContestId}
        contestName={contest?.name ?? (selectedContestId.replace(/-/g, " ") || "Featured Challenge")}
        location={contest?.location ?? "Fire Feast Arena"}
        food={contest?.food ?? "Featured Feast"}
        difficulty={contest?.difficulty ?? "Elite"}
        roundLabel={roundLabel}
        opponentName={currentOpponent.name}
        opponentAvatar={currentOpponent.avatar}
        opponentPersonality={currentOpponent.personality}
        restaurantName={contest?.restaurant_name}
        restaurantLogoUrl={contest?.restaurant_logo_url}
        city={contest?.city}
        state={contest?.state}
        verified={contest?.verified}
        sponsored={contest?.sponsored}
        sponsorName={contest?.sponsor_name}
        sponsorLogoUrl={contest?.sponsor_logo_url}
        sponsorMessage={contest?.sponsor_message}
      />

      {result ? (
        <VictoryOverlay
          result={result}
          playerScore={resultReward!.acceptedScore}
          opponentScore={resultReward!.opponentScore}
          opponentName={currentOpponent.name}
          opponentAvatar={currentOpponent.avatar}
          opponentPersonality={currentOpponent.personality}
          contestName={contest?.name}
          location={contest?.location}
          difficulty={contest?.difficulty}
          roundLabel={roundLabel}
          restaurantName={contest?.restaurant_name}
          restaurantLogoUrl={contest?.restaurant_logo_url}
          city={contest?.city}
          state={contest?.state}
          verified={contest?.verified}
          sponsored={contest?.sponsored}
          sponsorName={contest?.sponsor_name}
          sponsorLogoUrl={contest?.sponsor_logo_url}
          sponsorMessage={contest?.sponsor_message}
          highestCombo={highestCombo}
          foodName={contest?.food ?? "Featured feast"}
          matchTime={matchTime}
          currentXp={playerXp}
          xpEarned={resultReward?.xp}
          coinsEarned={resultReward?.coins}
          totalXp={resultReward?.totalXp}
          rewardReady={resultReward !== null}
          achievements={resultAchievements}
          tournament={resultTournament}
          onReplay={replay}
          onContinue={continueToNextContest}
          onBackToArena={() => router.replace("/(tabs)/contests")}
        />
      ) : null}
      {state.status === "FINISHED" && resultFlow.phase === "SUBMITTING_RESULT" ? (
        <View accessibilityViewIsModal style={styles.resultPending}>
          <FireLoading title="Verifying Result" subtitle="Waiting for the arena's official score and rewards." />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0F17",
  },
  gameplayLayer: {
    flex: 1,
  },
  recoveryButton: {
    alignSelf: "center",
    bottom: 48,
    position: "absolute",
  },
  resultPending: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(7,4,5,0.9)", justifyContent: "center", zIndex: 200 },
  overlay: {
    flex: 1,
    minHeight: 0,
    width: "100%",
  },
  gameplayContent: {
    flex: 1,
    alignItems: "center",
    minHeight: 0,
  },
  utilityHud: { flexShrink: 0, minHeight: 88, paddingHorizontal: 12, paddingTop: 3, width: "100%", zIndex: 40 },
  matchModifierRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 3, minHeight: 4, paddingBottom: 3, zIndex: 45 },
  utilityControlsRow: { alignItems: "center", flexDirection: "row", gap: 8, justifyContent: "space-between", minHeight: 82, width: "100%" },
  perkIndicator: { backgroundColor: "rgba(75,35,8,0.92)", borderColor: "#D89A3C", borderRadius: 6, borderWidth: 1, color: "#FFD879", fontSize: 7, fontWeight: "900", letterSpacing: 0.5, overflow: "hidden", paddingHorizontal: 6, paddingVertical: 3 },
  shieldIndicator: { backgroundColor: "rgba(7,49,56,0.94)", borderColor: "#8DE7F3", borderRadius: 6, borderWidth: 1, color: "#DFFFFF", fontSize: 7, fontWeight: "900", letterSpacing: 0.5, overflow: "hidden", paddingHorizontal: 6, paddingVertical: 3 },
  freshIndicator: { backgroundColor: "rgba(45,30,7,0.94)", borderColor: "#FFD66B", borderRadius: 6, borderWidth: 1, color: "#FFF1A8", fontSize: 7, fontWeight: "900", letterSpacing: 0.45, overflow: "hidden", paddingHorizontal: 6, paddingVertical: 3 },
  antacidControl: { alignItems: "flex-end", flex: 1, maxWidth: 220, minWidth: 0, zIndex: 40 },
  antacidControlCritical: { backgroundColor: "rgba(116,42,8,0.34)", borderRadius: 16 },
  antacidControlWarning: { backgroundColor: "rgba(180,22,12,0.42)", elevation: 12, zIndex: 90 },
  antacidControlAcknowledged: { backgroundColor: "rgba(35,130,148,0.38)", borderRadius: 16 },
  antacidButton: { marginBottom: 0, marginTop: 0 },
  antacidIcon: { height: 26, width: 26 },
});
