import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import CharacterPortrait, { type CharacterReaction } from "./CharacterPortrait";
import TournamentBanner from "./TournamentBanner";
import { formatMatchDuration } from "../contestDuration";
import type { OpponentMood } from "../ai/OpponentMood";

type Props = {
  timeRemaining: number;
  opponentName?: string;
  opponentAvatar?: string;
  opponentPersonality?: string;
  opponentMood: OpponentMood;
  opponentScore: number;
  playerScore: number;
  combo?: number;
  contestName?: string;
  location?: string;
  difficulty?: string;
  roundLabel?: string;
  reducedMotion?: boolean;
};

const BLAZE = require("../../assets/characters/blaze.png");

function ScoreZone({ side, name, subtitle, avatar, score, mood, reaction, reactionKey, reactionStrength = 0, animatedStyle }: { side: "player" | "opponent"; name: string; subtitle?: string; avatar?: string; score: number; mood?: OpponentMood; reaction: CharacterReaction; reactionKey: string | number; reactionStrength?: number; animatedStyle?: object }) {
  const zone = (
    <View style={[styles.scoreZone, side === "opponent" && styles.opponentZone]}>
      <LinearGradient
        colors={side === "player" ? ["rgba(255,175,77,0.11)", "transparent"] : ["rgba(205,79,47,0.09)", "transparent"]}
        end={{ x: side === "player" ? 1 : 0, y: 0.5 }}
        pointerEvents="none"
        start={{ x: side === "player" ? 0 : 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      <CharacterPortrait image={side === "player" ? BLAZE : undefined} fallback={avatar} name={name} subtitle={subtitle} side={side} size="compact" mood={mood} reaction={reaction} reactionKey={reactionKey} reactionStrength={reactionStrength} />
      <View style={[styles.scoreInfo, side === "opponent" && styles.opponentInfo]}>
        <Text adjustsFontSizeToFit maxFontSizeMultiplier={1.5} numberOfLines={1} style={styles.score}>{Math.floor(score).toLocaleString()}</Text>
        <Text maxFontSizeMultiplier={1.5} style={styles.scoreLabel}>SCORE</Text>
      </View>
    </View>
  );
  return animatedStyle ? <Animated.View style={[styles.zoneWrap, animatedStyle]}>{zone}</Animated.View> : <View style={styles.zoneWrap}>{zone}</View>;
}

export default function MatchHUD({ timeRemaining, opponentName = "Opponent", opponentAvatar, opponentPersonality, opponentMood, opponentScore, playerScore, combo = 0, contestName, roundLabel, reducedMotion = false }: Props) {
  const formattedTime = formatMatchDuration(timeRemaining);
  const lowTime = timeRemaining > 0 && timeRemaining <= 10;
  const previousScore = useRef(playerScore);
  const previousOpponentScore = useRef(opponentScore);
  const scoreScale = useRef(new Animated.Value(1)).current;
  const scoreFlash = useRef(new Animated.Value(0)).current;
  const timerScale = useRef(new Animated.Value(1)).current;
  const timerGlow = useRef(new Animated.Value(0)).current;
  const comboScale = useRef(new Animated.Value(1)).current;
  const dashboardShimmer = useRef(new Animated.Value(0)).current;
  const previousCombo = useRef(combo);
  const playerLeading = playerScore > opponentScore;
  const tied = playerScore === opponentScore;
  const playerScored = playerScore > previousScore.current;
  const opponentScored = opponentScore > previousOpponentScore.current;
  const comboTier = combo >= 20 ? 4 : combo >= 15 ? 3 : combo >= 10 ? 2 : combo >= 5 ? 1 : 0;
  const comboMilestone = combo === 5 || combo === 10 || combo === 20 || (combo >= 30 && combo % 10 === 0);
  const playerReaction: CharacterReaction = comboMilestone ? "combo" : tied ? "idle" : playerLeading ? "leading" : "behind";
  const opponentReaction: CharacterReaction = opponentScored ? "scoring" : playerScored ? "hit" : comboTier ? "combo" : tied ? "idle" : playerLeading ? "behind" : "leading";
  const playerReactionKey = comboMilestone ? `combo-${combo}` : `lead-${playerLeading}`;
  const opponentReactionKey = `opponent-${opponentScore}-player-${playerScore}-combo-${comboTier}`;
  const accessibilitySummary = `Score ${Math.floor(playerScore)}. Combo ${combo}. ${formattedTime} remaining.`;

  useEffect(() => {
    const increased = playerScore > previousScore.current;
    previousScore.current = playerScore;
    if (reducedMotion) {
      scoreScale.stopAnimation();
      scoreFlash.stopAnimation();
      scoreScale.setValue(1);
      scoreFlash.setValue(0);
      return;
    }
    if (!increased) return;
    scoreScale.stopAnimation();
    scoreScale.setValue(1.1);
    scoreFlash.setValue(1);
    const animation = Animated.parallel([
      Animated.spring(scoreScale, { toValue: 1, friction: 6, tension: 250, useNativeDriver: true }),
      Animated.timing(scoreFlash, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [playerScore, reducedMotion, scoreFlash, scoreScale]);

  useEffect(() => { previousOpponentScore.current = opponentScore; }, [opponentScore]);

  useEffect(() => {
    const increased = combo > previousCombo.current;
    previousCombo.current = combo;
    if (!increased || reducedMotion) {
      if (reducedMotion) comboScale.setValue(1);
      return;
    }
    comboScale.stopAnimation();
    comboScale.setValue(1.08 + Math.min(0.1, combo / 250));
    const animation = Animated.spring(comboScale, {
      toValue: 1,
      friction: 6,
      tension: 260,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [combo, comboScale, reducedMotion]);

  useEffect(() => () => comboScale.stopAnimation(), [comboScale]);

  useEffect(() => {
    dashboardShimmer.stopAnimation();
    dashboardShimmer.setValue(0);
    if (reducedMotion) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.delay(1200),
      Animated.timing(dashboardShimmer, { toValue: 1, duration: 1150, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      Animated.delay(1200),
      Animated.timing(dashboardShimmer, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [dashboardShimmer, reducedMotion]);

  useEffect(() => {
    if (!lowTime || reducedMotion) {
      timerScale.stopAnimation();
      timerGlow.stopAnimation();
      timerScale.setValue(1);
      timerGlow.setValue(0);
      return;
    }
    timerScale.stopAnimation();
    timerGlow.stopAnimation();
    timerScale.setValue(1.07);
    timerGlow.setValue(1);
    const animation = Animated.parallel([
      Animated.spring(timerScale, { toValue: 1, friction: 7, tension: 220, useNativeDriver: true }),
      Animated.timing(timerGlow, { toValue: 0, duration: 520, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [lowTime, reducedMotion, timeRemaining, timerGlow, timerScale]);

  return (
    <View accessible accessibilityLabel={accessibilitySummary} style={styles.dashboard}>
      <LinearGradient colors={["rgba(255,255,255,0.055)", "rgba(255,173,74,0.025)", "rgba(0,0,0,0.08)"]} pointerEvents="none" style={StyleSheet.absoluteFill} />
      <Animated.View pointerEvents="none" style={[styles.dashboardShimmer, { opacity: dashboardShimmer.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.32, 0] }), transform: [{ translateX: dashboardShimmer.interpolate({ inputRange: [0, 1], outputRange: [-100, 410] }) }, { rotate: "-14deg" }] }]} />
      <View pointerEvents="none" style={styles.topHighlight} />
      <TournamentBanner eventTitle="FIRE FEAST WORLD TOUR" contestName={contestName} roundLabel={roundLabel} variant="compact" embedded />
      <View style={styles.divider} />
      <View style={styles.matchRow}>
        <View style={styles.playerZoneWrap}>
          <ScoreZone side="player" name="Blaze" subtitle="You" score={playerScore} reaction={playerReaction} reactionKey={playerReactionKey} animatedStyle={{ transform: [{ scale: scoreScale }] }} />
          <Animated.View pointerEvents="none" style={[styles.scoreFlash, { opacity: scoreFlash }]} />
        </View>

        <View style={styles.centerZone}>
          <Animated.View style={[styles.timer, lowTime && styles.timerWarning, { transform: [{ scale: timerScale }] }]}>
            <Animated.View pointerEvents="none" style={[styles.timerGlow, { opacity: timerGlow }]} />
            <Text maxFontSizeMultiplier={1.5} style={styles.timerLabel}>TIME</Text>
            <Text adjustsFontSizeToFit maxFontSizeMultiplier={1.5} numberOfLines={1} style={[styles.time, lowTime && styles.timeWarning]}>{formattedTime}</Text>
          </Animated.View>
          <View style={styles.centerMeta}>
            <View style={styles.vsBadge}><Text maxFontSizeMultiplier={1.5} style={styles.vs}>VS</Text></View>
            <Animated.View style={{ transform: [{ scale: comboScale }] }}><Text maxFontSizeMultiplier={1.5} numberOfLines={1} style={[styles.comboReadout, comboTier > 0 && styles.comboReadoutHot]}>x{combo}</Text></Animated.View>
          </View>
        </View>

        <ScoreZone side="opponent" name={opponentName} subtitle={opponentPersonality} avatar={opponentAvatar} score={opponentScore} mood={opponentMood} reaction={opponentReaction} reactionKey={opponentReactionKey} reactionStrength={comboTier} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dashboard: { backgroundColor: "rgba(8,5,7,0.98)", borderColor: "rgba(242,158,59,0.84)", borderRadius: 15, borderWidth: 1, elevation: 8, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.44, shadowRadius: 11, width: "100%" },
  dashboardShimmer: { backgroundColor: "rgba(255,226,174,0.28)", bottom: -30, position: "absolute", top: -30, width: 42, zIndex: 2 },
  topHighlight: { backgroundColor: "rgba(255,221,158,0.18)", height: 1, left: 9, position: "absolute", right: 9, top: 1, zIndex: 2 },
  divider: { backgroundColor: "rgba(235,145,53,0.38)", height: 1, marginHorizontal: 9 },
  matchRow: { alignItems: "stretch", flexDirection: "row", minHeight: 78, minWidth: 0, paddingHorizontal: 5 },
  zoneWrap: { flex: 1, minWidth: 0 },
  playerZoneWrap: { flex: 1, minWidth: 0 },
  scoreZone: { alignItems: "center", flex: 1, flexDirection: "row", minWidth: 0, overflow: "hidden", paddingHorizontal: 4 },
  opponentZone: { flexDirection: "row-reverse" },
  scoreInfo: { alignItems: "flex-end", flex: 1, marginLeft: 3, minWidth: 0 },
  opponentInfo: { alignItems: "flex-start", marginLeft: 0, marginRight: 2 },
  score: { color: "#FFF4DF", fontSize: 20, fontWeight: "900", lineHeight: 23, maxWidth: "100%" },
  scoreLabel: { color: "#B3967D", fontSize: 6, fontWeight: "900", letterSpacing: 1 },
  scoreFlash: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(255,196,72,0.22)", borderColor: "#FFD66B", borderWidth: 1 },
  centerZone: { alignItems: "center", borderColor: "rgba(226,139,50,0.3)", borderLeftWidth: 1, borderRightWidth: 1, flexShrink: 0, justifyContent: "center", paddingHorizontal: 3, width: 72 },
  timer: { alignItems: "center", backgroundColor: "rgba(24,12,11,0.96)", borderColor: "#ED9B3B", borderRadius: 10, borderWidth: 1, height: 48, justifyContent: "center", overflow: "hidden", width: 66 },
  timerWarning: { backgroundColor: "rgba(70,17,12,0.96)", borderColor: "#FF5C32" },
  timerGlow: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(255,72,20,0.2)", borderColor: "#FF7A32", borderRadius: 9, borderWidth: 1 },
  timerLabel: { color: "#C49660", fontSize: 7, fontWeight: "900", letterSpacing: 1.1 },
  time: { color: "#FFD77A", fontSize: 19, fontWeight: "900", lineHeight: 21 },
  timeWarning: { color: "#FF7654" },
  centerMeta: { alignItems: "center", flexDirection: "row", gap: 3, marginTop: 3 },
  vsBadge: { alignItems: "center", backgroundColor: "#3A150F", borderColor: "#ED9D3D", borderRadius: 10, borderWidth: 1, height: 20, justifyContent: "center", width: 28 },
  vs: { color: "#FFD77A", fontSize: 9, fontStyle: "italic", fontWeight: "900" },
  comboReadout: { color: "#E2A452", fontSize: 8, fontWeight: "900", maxWidth: 30 },
  comboReadoutHot: { color: "#FFD269" },
});
