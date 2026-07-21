import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

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
      <CharacterPortrait image={side === "player" ? BLAZE : undefined} fallback={avatar} name={name} subtitle={subtitle} side={side} size="compact" mood={mood} reaction={reaction} reactionKey={reactionKey} reactionStrength={reactionStrength} />
      <View style={[styles.scoreInfo, side === "opponent" && styles.opponentInfo]}>
        <Text adjustsFontSizeToFit numberOfLines={1} style={styles.score}>{Math.floor(score).toLocaleString()}</Text>
        <Text style={styles.scoreLabel}>SCORE</Text>
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
            <Text style={styles.timerLabel}>TIME</Text>
            <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.time, lowTime && styles.timeWarning]}>{formattedTime}</Text>
          </Animated.View>
          <View style={styles.centerMeta}>
            <View style={styles.vsBadge}><Text style={styles.vs}>VS</Text></View>
            <Text numberOfLines={1} style={styles.comboReadout}>x{combo}</Text>
          </View>
        </View>

        <ScoreZone side="opponent" name={opponentName} subtitle={opponentPersonality} avatar={opponentAvatar} score={opponentScore} mood={opponentMood} reaction={opponentReaction} reactionKey={opponentReactionKey} reactionStrength={comboTier} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dashboard: { backgroundColor: "rgba(9,6,8,0.97)", borderColor: "rgba(235,145,49,0.78)", borderRadius: 13, borderWidth: 1, overflow: "hidden", width: "100%" },
  topHighlight: { backgroundColor: "rgba(255,221,158,0.18)", height: 1, left: 9, position: "absolute", right: 9, top: 1, zIndex: 2 },
  divider: { backgroundColor: "rgba(221,128,42,0.3)", height: 1, marginHorizontal: 7 },
  matchRow: { alignItems: "stretch", flexDirection: "row", minHeight: 76, minWidth: 0, paddingHorizontal: 4 },
  zoneWrap: { flex: 1, minWidth: 0 },
  playerZoneWrap: { flex: 1, minWidth: 0 },
  scoreZone: { alignItems: "center", flex: 1, flexDirection: "row", minWidth: 0, overflow: "hidden", paddingHorizontal: 3 },
  opponentZone: { flexDirection: "row-reverse" },
  scoreInfo: { alignItems: "flex-end", flex: 1, marginLeft: 2, minWidth: 0 },
  opponentInfo: { alignItems: "flex-start", marginLeft: 0, marginRight: 2 },
  score: { color: "#FFF1D8", fontSize: 19, fontWeight: "900", lineHeight: 22, maxWidth: "100%" },
  scoreLabel: { color: "#8E7665", fontSize: 5, fontWeight: "900", letterSpacing: 0.9 },
  scoreFlash: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(255,196,72,0.22)", borderColor: "#FFD66B", borderWidth: 1 },
  centerZone: { alignItems: "center", borderColor: "rgba(216,125,42,0.24)", borderLeftWidth: 1, borderRightWidth: 1, flexShrink: 0, justifyContent: "center", paddingHorizontal: 3, width: 68 },
  timer: { alignItems: "center", backgroundColor: "rgba(20,11,11,0.92)", borderColor: "#E59134", borderRadius: 9, borderWidth: 1, height: 46, justifyContent: "center", overflow: "hidden", width: 64 },
  timerWarning: { backgroundColor: "rgba(70,17,12,0.96)", borderColor: "#FF5C32" },
  timerGlow: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(255,72,20,0.2)", borderColor: "#FF7A32", borderRadius: 9, borderWidth: 1 },
  timerLabel: { color: "#A97E51", fontSize: 6, fontWeight: "900", letterSpacing: 1.1 },
  time: { color: "#FFD06A", fontSize: 18, fontWeight: "900", lineHeight: 20 },
  timeWarning: { color: "#FF7654" },
  centerMeta: { alignItems: "center", flexDirection: "row", gap: 3, marginTop: 3 },
  vsBadge: { alignItems: "center", backgroundColor: "#34120E", borderColor: "#E99437", borderRadius: 10, borderWidth: 1, height: 19, justifyContent: "center", width: 27 },
  vs: { color: "#FFD170", fontSize: 8, fontStyle: "italic", fontWeight: "900" },
  comboReadout: { color: "#D99A49", fontSize: 6, fontWeight: "900", maxWidth: 27 },
});
