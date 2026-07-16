import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { api, type Contest, parseContests } from "../../src/api";
import ArcadeBackground from "../../src/game/ui/ArcadeBackground";
import CountdownOverlay from "../../src/game/ui/CountdownOverlay";
import EffectsLayer from "../../src/game/ui/EffectsLayer";
import FoodArena from "../../src/game/ui/FoodArena";
import GameplayHUD from "../../src/game/ui/GameplayHUD";
import VictoryOverlay from "../../src/game/ui/VictoryOverlay";
import SceneMotion, { type SceneMotionPhase } from "../../src/game/ui/SceneMotion";
import { useGameLoop } from "../../src/game/useGameLoop";
import FireScreenEntrance from "../../src/components/fire/FireScreenEntrance";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ContestScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { contestId } = useLocalSearchParams<{ contestId?: string | string[] }>();
  const selectedContestId = Array.isArray(contestId) ? contestId[0] : contestId ?? "";
  const {
    state,
    timeRemaining,
    opponentScore,
    currentOpponent,
    showCountdown,
    countdownValue,
    startGame,
    tap,
  } = useGameLoop();

  const [feedbackText, setFeedbackText] = useState<string | null>(null);
  const [showScore, setShowScore] = useState(false);
  const [comboLabel, setComboLabel] = useState("COMBO");
  const [highestCombo, setHighestCombo] = useState(0);
  const [matchTime, setMatchTime] = useState(0);
  const [contest, setContest] = useState<Contest | null>(null);
  const [nextContestId, setNextContestId] = useState<string | null>(null);
  const [roundLabel, setRoundLabel] = useState("WORLD TOUR EVENT");
  const started = useRef(false);
  const matchStartedAt = useRef<number | null>(null);
  const scoreFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    startGame();
  }, [startGame]);

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
    if (state.status === "PLAYING" && matchStartedAt.current === null) {
      matchStartedAt.current = Date.now();
    }

    if (state.status === "FINISHED" && matchStartedAt.current !== null) {
      setMatchTime(Math.max(1, Math.round((Date.now() - matchStartedAt.current) / 1000)));
    }
  }, [state.status]);

  useEffect(() => {
    let active = true;

    async function loadContestDetails() {
      try {
        const result = await api.listContests();
        const contests = parseContests(result);
        const contestIndex = contests.findIndex((item) => item.id === selectedContestId);

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
      }
    }

    loadContestDetails();

    return () => {
      active = false;
    };
  }, [selectedContestId]);

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
      <ArcadeBackground />

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
        />
        </FireScreenEntrance>

        <View style={styles.arena}>
          <FoodArena contestId={selectedContestId} combo={state.combo} active={state.status === "PLAYING"} onTap={handleTap} />
        </View>
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
});
