import React, { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View } from "react-native";
import ImpactEffect from "./ImpactEffect";
import CharacterPortrait from "./CharacterPortrait";

type ResultBannerProps = {
  result: "victory" | "defeat";
  playerScore: number;
  opponentScore: number;
  opponentName?: string;
  opponentAvatar?: string;
  opponentPersonality?: string;
};

const TROPHY = require("../../assets/icons/trophy.png");
const BLAZE = require("../../assets/characters/blaze.png");

export default function ResultBanner({ result, playerScore, opponentScore, opponentName = "Opponent", opponentAvatar, opponentPersonality }: ResultBannerProps) {
  const isVictory = result === "victory";
  const trim = isVictory ? "#F2A43C" : "#B84A3D";
  const trophyScale = useRef(new Animated.Value(isVictory ? 0.6 : 0.92)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    glowOpacity.setValue(isVictory ? 0.85 : 0.35);
    const animation = Animated.parallel([
      Animated.spring(trophyScale, { toValue: 1, friction: isVictory ? 5 : 8, tension: 180, useNativeDriver: true }),
      Animated.timing(glowOpacity, { toValue: isVictory ? 0.2 : 0.1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [glowOpacity, isVictory, trophyScale]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.worldTour}>FIRE FEAST WORLD TOUR</Text>
      <Text style={styles.complete}>MATCH COMPLETE</Text>
      <Text style={[styles.result, isVictory ? styles.victory : styles.defeat]}>{isVictory ? "VICTORY" : "DEFEAT"}</Text>
      <Text style={styles.subtitle}>{isVictory ? "THE FEAST IS YOURS" : "THE ARENA DEMANDS A REMATCH"}</Text>

      <Animated.View style={[styles.emblem, { borderColor: trim, transform: [{ scale: trophyScale }] }]} pointerEvents="none">
        <Animated.View style={[styles.emblemGlow, { backgroundColor: isVictory ? "rgba(238,151,42,0.55)" : "rgba(154,45,38,0.2)", opacity: glowOpacity }]} />
        {isVictory ? <ImpactEffect trigger={1} variant="completion" size={104} /> : null}
        {isVictory ? <ImpactEffect trigger={1} variant="combo" size={126} /> : null}
        <Image source={TROPHY} resizeMode="contain" style={[styles.trophy, !isVictory && styles.defeatTrophy]} />
      </Animated.View>

      <View style={[styles.comparison, { borderColor: trim }]}>
        <View style={styles.topHighlight} pointerEvents="none" />
        <View style={styles.competitor}>
          <CharacterPortrait image={BLAZE} name="Blaze" subtitle="You" side="player" size="compact" reaction={isVictory ? "victory" : "defeat"} reactionKey={result} />
          <Text style={styles.score}>{Math.floor(playerScore).toLocaleString()}</Text>
          <Text style={styles.scoreLabel}>FINAL SCORE</Text>
        </View>
        <View style={styles.vsColumn}>
          <View style={styles.rule} />
          <View style={styles.vsBadge}><Text style={styles.vs}>VS</Text></View>
          <View style={styles.rule} />
        </View>
        <View style={styles.competitor}>
          <CharacterPortrait fallback={opponentAvatar} name={opponentName} subtitle={opponentPersonality} side="opponent" size="compact" reaction={isVictory ? "defeat" : "victory"} reactionKey={result} />
          <Text style={styles.score}>{Math.floor(opponentScore).toLocaleString()}</Text>
          <Text style={styles.scoreLabel}>FINAL SCORE</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", width: "100%" },
  worldTour: { color: "#D99A4D", fontSize: 7, fontWeight: "900", letterSpacing: 1.8, marginTop: 4 },
  complete: { color: "#B38B5E", fontSize: 8, fontWeight: "900", letterSpacing: 2 },
  result: { fontSize: 39, fontWeight: "900", letterSpacing: 2.2, lineHeight: 43, textAlign: "center" },
  victory: { color: "#FFD06A", textShadowColor: "rgba(255,105,20,0.8)", textShadowRadius: 12 },
  defeat: { color: "#E06E5E", textShadowColor: "rgba(85,10,10,0.8)", textShadowRadius: 9 },
  subtitle: { color: "#E1C29A", fontSize: 9, fontWeight: "900", letterSpacing: 1.1 },
  emblem: { alignItems: "center", backgroundColor: "rgba(10,7,8,0.92)", borderRadius: 38, borderWidth: 2, height: 76, justifyContent: "center", marginBottom: 7, marginTop: 6, overflow: "hidden", width: 76 },
  emblemGlow: { borderRadius: 34, height: 66, position: "absolute", width: 66 },
  trophy: { height: 58, width: 58 },
  defeatTrophy: { opacity: 0.66, tintColor: "#C05B4E" },
  comparison: { alignItems: "stretch", backgroundColor: "rgba(12,8,9,0.96)", borderRadius: 13, borderWidth: 1, flexDirection: "row", minHeight: 112, overflow: "hidden", width: "100%" },
  topHighlight: { backgroundColor: "rgba(255,218,150,0.12)", height: 1, left: 10, position: "absolute", right: 10, top: 1 },
  competitor: { alignItems: "center", flex: 1, justifyContent: "center", paddingVertical: 7 },
  score: { color: "#FFF1D9", fontSize: 23, fontWeight: "900", lineHeight: 25 },
  scoreLabel: { color: "#8F7665", fontSize: 6, fontWeight: "900", letterSpacing: 0.8 },
  vsColumn: { alignItems: "center", justifyContent: "center", width: 48 },
  rule: { backgroundColor: "rgba(225,132,43,0.3)", flex: 1, width: 1 },
  vsBadge: { alignItems: "center", backgroundColor: "#35130E", borderColor: "#DF8B31", borderRadius: 18, borderWidth: 1, height: 36, justifyContent: "center", marginVertical: 4, width: 36 },
  vs: { color: "#FFD071", fontSize: 12, fontStyle: "italic", fontWeight: "900" },
});
