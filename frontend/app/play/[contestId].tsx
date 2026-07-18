import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { api, type Contest, parseContests } from "../../src/api";
import ArcadeBackground from "../../src/game/ui/ArcadeBackground";
import CountdownOverlay from "../../src/game/ui/CountdownOverlay";
import EffectsLayer from "../../src/game/ui/EffectsLayer";
import FoodArena from "../../src/game/ui/FoodArena";
import GameplayHUD from "../../src/game/ui/GameplayHUD";
import VictoryOverlay from "../../src/game/ui/VictoryOverlay";
import SceneMotion, { type SceneMotionPhase } from "../../src/game/ui/SceneMotion";
import { useGameLoop } from "../../src/game/useGameLoop";
import { resolveContestDurationSeconds } from "../../src/game/contestDuration";
import FireScreenEntrance from "../../src/components/fire/FireScreenEntrance";
import FireButton from "../../src/components/fire/FireButton";
import HeatScreenOverlay from "../../src/game/ui/HeatScreenOverlay";
import HeatTierBanner from "../../src/game/ui/HeatTierBanner";
import AntacidCoolingFeedback from "../../src/game/ui/AntacidCoolingFeedback";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ContestScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { contestId, replay: replayParam } = useLocalSearchParams<{ contestId?: string | string[]; replay?: string | string[] }>();
  const selectedContestId = Array.isArray(contestId) ? contestId[0] : contestId ?? "";
  const replayToken = Array.isArray(replayParam) ? replayParam[0] : replayParam ?? "";
  const matchRouteKey = `${selectedContestId}:${replayToken}`;
  const [contest, setContest] = useState<Contest | null>(null);
  const [contestLoaded, setContestLoaded] = useState(false);
  const [playerAntacidCount, setPlayerAntacidCount] = useState<number | undefined>(undefined);
  const matchDurationSeconds = resolveContestDurationSeconds(contest);
  const {
    state,
    timeRemaining,
    opponentScore,
    currentOpponent,
    showCountdown,
    countdownValue,
    startGame,
    tap,
    heartburn,
    heatTier,
    heatMultiplier,
    isOverheated,
    overheatRemainingMs,
    antacidCount,
    canUseAntacid,
    useAntacid,
  } = useGameLoop(matchDurationSeconds, matchRouteKey, playerAntacidCount);

  const [feedbackText, setFeedbackText] = useState<string | null>(null);
  const [showScore, setShowScore] = useState(false);
  const [comboLabel, setComboLabel] = useState("COMBO");
  const [highestCombo, setHighestCombo] = useState(0);
  const [matchTime, setMatchTime] = useState(0);
  const [nextContestId, setNextContestId] = useState<string | null>(null);
  const [roundLabel, setRoundLabel] = useState("WORLD TOUR EVENT");
  const [coolingTrigger, setCoolingTrigger] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const antacidPulse = useRef(new Animated.Value(0)).current;
  const started = useRef(false);
  const matchStartedAt = useRef<number | null>(null);
  const scoreFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!contestLoaded || started.current) return;
    started.current = true;
    startGame();
  }, [contestLoaded, startGame]);

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
        const [contestResult, playerResult] = await Promise.allSettled([api.listContests(), api.getPlayer()]);
        const contests = contestResult.status === "fulfilled" ? parseContests(contestResult.value) : [];
        const contestIndex = contests.findIndex((item) => item.id === selectedContestId);

        if (active && playerResult.status === "fulfilled") {
          const inventory = Number((playerResult.value as { antacid?: number })?.antacid);
          if (Number.isFinite(inventory)) setPlayerAntacidCount(Math.max(0, Math.floor(inventory)));
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

  const handleTap = () => {
    if (state.status !== "PLAYING") return;
    tap();

    const nextCombo = state.combo + 1;
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
  };

  const handleUseAntacid = () => {
    if (!useAntacid()) return;
    setCoolingTrigger((value) => value + 1);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const result = state.status === "FINISHED"
    ? state.score > opponentScore ? "victory" : "defeat"
    : null;

  const replay = () => {
    router.replace(`/play/${selectedContestId}?replay=${Date.now()}`);
  };

  const continueToNextContest = () => {
    router.replace(nextContestId ? `/play/${nextContestId}` : "/(tabs)/contests");
  };

  const scenePhase: SceneMotionPhase = state.status === "FINISHED" ? "result" : state.status === "PLAYING" ? "active" : "intro";
  const comboImpact = state.combo === 10 || state.combo === 20 || (state.combo >= 30 && state.combo % 10 === 0) ? state.combo : 0;

  return (
    <View style={styles.container}>
      <ArcadeBackground combo={state.combo} phase={state.status === "FINISHED" ? "result" : state.status === "PLAYING" ? "active" : "intro"} />
      <HeatScreenOverlay heartburn={heartburn} heatTier={heatTier} isOverheated={isOverheated} />
      <HeatTierBanner heatTier={heatTier} />
      <AntacidCoolingFeedback trigger={coolingTrigger} />

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
          <FoodArena contestId={selectedContestId} combo={state.combo} timeRemaining={timeRemaining} resetKey={matchRouteKey} active={state.status === "PLAYING"} onTap={handleTap} />
        </View>
        <Animated.View style={[styles.antacidControl, { opacity: canUseAntacid ? 1 : 0.46, transform: [{ scale: antacidPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.045] }) }] }]}>
          <FireButton accessibilityLabel={`Use antacid, ${antacidCount} remaining${canUseAntacid ? ", cool down" : ", unavailable"}`} title="USE ANTACID" subtitle={canUseAntacid ? `COOL DOWN · ${antacidCount} LEFT` : `${antacidCount} LEFT`} size="compact" variant={heatTier === "CRITICAL" || heatTier === "OVERHEATED" ? "gold" : "secondary"} disabled={!canUseAntacid} onPress={handleUseAntacid} style={styles.antacidButton} />
        </Animated.View>
      </SceneMotion>

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
