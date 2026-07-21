import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { api, type Contest, parseContests } from "../../src/api";
import ArcadeBackground from "../../src/game/ui/ArcadeBackground";
import CountdownOverlay from "../../src/game/ui/CountdownOverlay";
import EffectsLayer from "../../src/game/ui/EffectsLayer";
import FoodArena from "../../src/game/ui/FoodArena";
import GameplayHUD from "../../src/game/ui/GameplayHUD";
import VictoryOverlay, { type VictoryTournamentPresentation } from "../../src/game/ui/VictoryOverlay";
import SceneMotion, { type SceneMotionPhase } from "../../src/game/ui/SceneMotion";
import { useGameLoop } from "../../src/game/useGameLoop";
import { resolveContestDurationSeconds } from "../../src/game/contestDuration";
import FireScreenEntrance from "../../src/components/fire/FireScreenEntrance";
import FireButton from "../../src/components/fire/FireButton";
import HeatScreenOverlay from "../../src/game/ui/HeatScreenOverlay";
import HeatTierBanner from "../../src/game/ui/HeatTierBanner";
import AntacidCoolingFeedback from "../../src/game/ui/AntacidCoolingFeedback";
import CameraController, { type CameraControllerHandle } from "../../src/game/CameraController";
import { getFoodProfile } from "../../src/game/food/FoodProfiles";
import { getOpponentMood } from "../../src/game/ai/OpponentMood";
import { trackMissionEvent } from "../../src/missions/MissionTracker";
import { trackAchievementEvent } from "../../src/achievements/AchievementTracker";
import type { FoodMechanicType } from "../../src/achievements/AchievementTypes";
import { recordTournamentMatch } from "../../src/tournaments/TournamentProgress";
import { getTournamentPlayerProgress } from "../../src/tournaments/TournamentProgress";
import { TOURNAMENT_BY_ID } from "../../src/tournaments/TournamentCatalog";
import type { AchievementCompletionNotification } from "../../src/achievements/AchievementTypes";
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

export default function ContestScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { contestId, replay: replayParam, tournament: tournamentParam } = useLocalSearchParams<{ contestId?: string | string[]; replay?: string | string[]; tournament?: string | string[] }>();
  const selectedContestId = Array.isArray(contestId) ? contestId[0] : contestId ?? "";
  const replayToken = Array.isArray(replayParam) ? replayParam[0] : replayParam ?? "";
  const tournamentOccurrenceId = Array.isArray(tournamentParam) ? tournamentParam[0] : tournamentParam ?? "";
  const matchRouteKey = `${selectedContestId}:${replayToken}:${tournamentOccurrenceId}`;
  const [contest, setContest] = useState<Contest | null>(null);
  const [contestLoaded, setContestLoaded] = useState(false);
  const [playerAntacidCount, setPlayerAntacidCount] = useState<number | undefined>(undefined);
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
  overheatRemainingMs,
  antacidCount,
  canUseAntacid,
  useAntacid,
  resolvedBiteHeat,
} = useGameLoop({
  duration: matchDurationSeconds,
  matchKey: matchRouteKey,
  antacidCount: playerAntacidCount,

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
  const [reducedMotion, setReducedMotion] = useState(false);
  const [playerXp, setPlayerXp] = useState(0);
  const [resultAchievements, setResultAchievements] = useState<AchievementCompletionNotification[]>([]);
  const [resultTournament, setResultTournament] = useState<VictoryTournamentPresentation | null>(null);
  const antacidPulse = useRef(new Animated.Value(0)).current;
  const cameraRef = useRef<CameraControllerHandle>(null);
  const started = useRef(false);
  const matchStartedAt = useRef<number | null>(null);
  const scoreFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousStatus = useRef(state.status);
  const lastCameraCombo = useRef(state.combo);
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
  const { playSound: playAudioEvent } = useAdaptiveAudio(adaptiveAudioContext, matchRouteKey);
  const { commentary, commentate } = useCommentaryEngine(matchRouteKey);
  const previousArenaStatus = useRef(state.status);
  const previousArenaLead = useRef<"PLAYER" | "OPPONENT" | "TIED">("TIED");
  const arenaCloseMatch = useRef(false);
  const arenaFinalTenSent = useRef(false);
  const lastAccessibilityCountdown = useRef<number | null>(null);
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

  useEffect(() => () => {
    if (scoreFeedbackTimer.current) clearTimeout(scoreFeedbackTimer.current);
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
      } else if (state.combo > 1) {
        void playAudioEvent("COMBO");
      }
    }
  }, [playAudioEvent, state.combo]);

  useEffect(() => {
    if (state.status !== "COUNTDOWN") return;
    void playAudioEvent(countdownValue === "GO" ? "GO" : "COUNTDOWN_TICK");
  }, [countdownValue, playAudioEvent, state.status]);

  useEffect(() => {
    const priorStatus = previousStatus.current;
    previousStatus.current = state.status;

    if (state.status === "PLAYING" && priorStatus !== "PLAYING") {
      cameraRef.current?.reset();
    } else if (state.status === "FINISHED" && priorStatus !== "FINISHED") {
      cameraRef.current?.victoryZoom();
    }
  }, [state.status]);

  useEffect(() => {
    cameraRef.current?.reset();
    lastCameraCombo.current = 0;
    missionRecordedMatch.current = null;
    achievementMatchEventId.current = `${matchRouteKey}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    previousArenaLead.current = "TIED";
    arenaCloseMatch.current = false;
    arenaFinalTenSent.current = false;
    lastAccessibilityCountdown.current = null;
    lastArenaPlayerCombo.current = 0;
    lastArenaOpponentCombo.current = 0;
    firstBiteCommented.current = false;
    perfectChainCommented.current = false;
    highScoreCommented.current = false;
    activeResultKey.current = matchRouteKey;
    setResultAchievements([]);
    setResultTournament(null);
  }, [matchRouteKey]);

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
      void playAudioEvent(state.score > opponentScore ? "VICTORY" : "DEFEAT");
      if (!highScoreCommented.current && state.score > playerBestScore.current) {
        highScoreCommented.current = true;
        playerBestScore.current = state.score;
        commentate({ type: "NEW_HIGH_SCORE" });
      }
    }
  }, [commentate, opponentScore, playAudioEvent, reactArena, state.score, state.status]);

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
    if (state.status !== "PLAYING" || timeRemaining > 10 || timeRemaining <= 0 || arenaFinalTenSent.current) return;
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
    if (state.status !== "FINISHED" || missionRecordedMatch.current === matchRouteKey) return;
    missionRecordedMatch.current = matchRouteKey;
    const won = state.score > opponentScore;
    void trackMissionEvent({
      type: "MATCH_COMPLETED",
      won,
      coinsEarned: won ? 50 : 0,
      xpEarned: won ? 120 : 0,
      highestCombo,
      foodId: foodProfile.id,
      opponentId: currentOpponent.id,
    });
    const resultKey = matchRouteKey;
    void trackAchievementEvent({
      type: "MATCH_COMPLETED",
      eventId: achievementMatchEventId.current,
      won,
      score: state.score,
      highestCombo,
      foodId: foodProfile.id,
      opponentId: currentOpponent.id,
      coinsEarned: won ? 50 : 0,
      xpEarned: won ? 120 : 0,
    }).then((achievementResult) => {
      if (activeResultKey.current === resultKey) {
        setResultAchievements(achievementResult.newlyCompleted);
        if (achievementResult.newlyCompleted.length) void playAudioEvent("ACHIEVEMENT_UNLOCK");
      }
    });
    if (tournamentOccurrenceId) {
      void recordTournamentMatch(tournamentOccurrenceId, {
        matchId: achievementMatchEventId.current,
        score: state.score,
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
  }, [currentOpponent.id, foodProfile.id, highestCombo, matchRouteKey, opponentScore, playAudioEvent, state.score, state.status, tournamentOccurrenceId]);

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
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => { if (mounted) setReducedMotion(enabled); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    antacidPulse.stopAnimation();
    antacidPulse.setValue(0);
    if (reducedMotion || !canUseAntacid || (heatTier !== "CRITICAL" && heatTier !== "OVERHEATED")) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(antacidPulse, { toValue: 1, duration: 520, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(antacidPulse, { toValue: 0, duration: 520, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [antacidPulse, canUseAntacid, heatTier, reducedMotion]);

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
    setContest(null);

    async function loadContestDetails() {
      try {
        const [contestResult, playerResult, titleResult] = await Promise.allSettled([api.listContests(), api.getPlayer(), loadTitleProgress()]);
        const contests = contestResult.status === "fulfilled" ? parseContests(contestResult.value) : [];
        const contestIndex = contests.findIndex((item) => item.id === selectedContestId);

        if (active && playerResult.status === "fulfilled") {
          const player = playerResult.value as { antacid?: number; username?: string; xp?: number; best_score?: number };
          const inventory = Number(player?.antacid);
          if (Number.isFinite(inventory)) setPlayerAntacidCount(Math.max(0, Math.floor(inventory)));
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
          setContest(contests[contestIndex]);
          setNextContestId(contests[contestIndex + 1]?.id ?? null);
          setRoundLabel(`ROUND ${contestIndex + 1}`);
        }
      } catch {
        if (active) {
          setContest(null);
          setNextContestId(null);
          setRoundLabel("WORLD TOUR EVENT");
        }
      } finally {
        if (active) setContestLoaded(true);
      }
    }

    loadContestDetails();

    return () => {
      active = false;
    };
  }, [matchRouteKey, selectedContestId]);

  const handleTap = useCallback(() => {
    const { commentate: commentateLatest, combo, playAudioEvent: playAudioEventLatest, status, tap: tapLatest } = arenaCallbacksRef.current;
    if (status !== "PLAYING") return;
    tapLatest();
    cameraRef.current?.bitePunch();
    void playAudioEventLatest("CORRECT_BITE");
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
  }, []);

  const handleUseAntacid = (): boolean => {
  const used = useAntacid();

  if (!used) {
    return false;
  }

  setCoolingTrigger((value) => value + 1);

  Haptics.notificationAsync(
    Haptics.NotificationFeedbackType.Success
  ).catch(() => {});

  return true;
};
  const result = state.status === "FINISHED"
    ? state.score > opponentScore ? "victory" : "defeat"
    : null;

  const replay = () => {
    const tournamentQuery = tournamentOccurrenceId ? `&tournament=${encodeURIComponent(tournamentOccurrenceId)}` : "";
    router.replace(`/play/${selectedContestId}?replay=${Date.now()}${tournamentQuery}`);
  };

  const continueToNextContest = () => {
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

  return (
    <View style={styles.container}>
      <ArcadeBackground combo={state.combo} phase={state.status === "FINISHED" ? "result" : state.status === "PLAYING" ? "active" : "intro"} reducedMotion={reducedMotion} />
      <ArenaEffects atmosphere={atmosphere} reducedMotion={reducedMotion} />
      <CommentaryOverlay item={commentary} reducedMotion={reducedMotion} />
      <HeatScreenOverlay heartburn={heartburn} heatTier={heatTier} isOverheated={isOverheated} />
      <HeatTierBanner heatTier={heatTier} />
      <AntacidCoolingFeedback trigger={coolingTrigger} />

      <MatchIntroOverlay
        visible={state.status === "MATCH_INTRO"}
        data={matchIntroData}
        reducedMotion={reducedMotion}
        resetKey={matchRouteKey}
        onComplete={startGame}
      />

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

      <EffectsLayer
        showScore={showScore}
        scoreText={feedbackText ?? "+0"}
        showCombo={showScore && state.combo >= 5}
        comboText={comboLabel}
        combo={state.combo}
      />

      <CameraController ref={cameraRef}>
      <SceneMotion phase={scenePhase} comboImpact={comboImpact} style={[styles.overlay, { paddingTop: Math.max(insets.top, 5), paddingBottom: Math.max(insets.bottom, 6) }]}>
        <FireScreenEntrance disabled={state.status !== "PLAYING"} duration="fast" distance={8}>
        <GameplayHUD
          level={1}
          xp={25}
          nextLevelXp={100}
          coins={250}
          timeRemaining={timeRemaining}
          playerScore={state.score}
          opponentScore={opponentScore}
          combo={state.combo}
          opponentName={currentOpponent.name}
          opponentAvatar={currentOpponent.avatar}
          opponentPersonality={currentOpponent.personality}
          opponentMood={opponentMood}
          contestName={contest?.name}
          location={contest?.location}
          difficulty={contest?.difficulty}
          roundLabel={roundLabel}
          heartburn={heartburn}
          heatTier={heatTier}
          heatMultiplier={heatMultiplier}
          isOverheated={isOverheated}
          overheatRemainingMs={overheatRemainingMs}
          antacidCount={antacidCount}
          canUseAntacid={canUseAntacid}
          onUseAntacid={handleUseAntacid}
        />
        </FireScreenEntrance>

        <View style={styles.arena}>
          <FoodArena contestId={selectedContestId} combo={state.combo} timeRemaining={timeRemaining} resetKey={matchRouteKey} active={state.status === "PLAYING"} foodProfile={foodProfile} onTap={handleTap} onMechanicCompleted={handleMechanicCompleted} />
        </View>
        <Animated.View style={[styles.antacidControl, { opacity: canUseAntacid ? 1 : 0.46, transform: [{ scale: antacidPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.045] }) }] }]}>
          <FireButton accessibilityLabel={`Use antacid, ${antacidCount} remaining${canUseAntacid ? ", cool down" : ", unavailable"}`} title="USE ANTACID" subtitle={canUseAntacid ? `COOL DOWN · ${antacidCount} LEFT` : `${antacidCount} LEFT`} size="compact" variant={heatTier === "CRITICAL" || heatTier === "OVERHEATED" ? "gold" : "secondary"} disabled={!canUseAntacid} onPress={handleUseAntacid} style={styles.antacidButton} />
        </Animated.View>
      </SceneMotion>
      </CameraController>

      {result ? (
        <VictoryOverlay
          result={result}
          playerScore={state.score}
          opponentScore={opponentScore}
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
          xpEarned={result === "victory" ? 120 : 0}
          coinsEarned={result === "victory" ? 50 : 0}
          achievements={resultAchievements}
          tournament={resultTournament}
          onReplay={replay}
          onContinue={continueToNextContest}
          onBackToArena={() => router.replace("/(tabs)/contests")}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0F17",
  },
  overlay: {
    flex: 1,
  },
  arena: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 52,
  },
  antacidControl: { bottom: 3, left: 7, position: "absolute", zIndex: 40 },
  antacidButton: { marginBottom: 0, marginTop: 0 },
});
