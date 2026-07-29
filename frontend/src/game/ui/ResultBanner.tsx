import React, { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View } from "react-native";
import ImpactEffect from "./ImpactEffect";
import CharacterPortrait from "./CharacterPortrait";
import CinematicCount from "./CinematicCount";

type ResultBannerProps = {
  result: "victory" | "defeat" | "draw";
  playerScore: number;
  opponentScore: number;
  opponentName?: string;
  opponentAvatar?: string;
  opponentPersonality?: string;
  bannerText?: string;
  scoresRevealed?: boolean;
  reducedMotion?: boolean;
};

const TROPHY = require("../../assets/icons/trophy.png");
const BLAZE = require("../../assets/characters/blaze.png");

export default function ResultBanner({ result, playerScore, opponentScore, opponentName = "Opponent", opponentAvatar, opponentPersonality, bannerText, scoresRevealed = true, reducedMotion = false }: ResultBannerProps) {
  const isVictory = result === "victory";
  const isDraw = result === "draw";
  const trim = isVictory ? "#F2A43C" : isDraw ? "#B49B75" : "#B84A3D";
  const trophyScale = useRef(new Animated.Value(isVictory ? 0.6 : 0.92)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    glowOpacity.setValue(reducedMotion ? 0.2 : isVictory ? 0.85 : 0.35);
    const animation = Animated.parallel([
      Animated.spring(trophyScale, { toValue: 1, friction: isVictory ? 5 : 8, tension: 180, useNativeDriver: true }),
      Animated.timing(glowOpacity, { toValue: isVictory ? 0.2 : 0.1, duration: reducedMotion ? 0 : 650, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [glowOpacity, isVictory, reducedMotion, trophyScale]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.worldTour}>FIRE FEAST WORLD TOUR</Text>
      <Text style={styles.complete}>MATCH COMPLETE</Text>
      <Text style={[styles.result, isVictory ? styles.victory : isDraw ? styles.draw : styles.defeat]}>{isVictory ? bannerText ?? "VICTORY!" : isDraw ? "DRAW" : "DEFEAT"}</Text>
      <Text style={styles.subtitle}>{isVictory ? "THE FEAST IS YOURS" : isDraw ? "EVENLY MATCHED" : "THE ARENA DEMANDS A REMATCH"}</Text>

      <Animated.View style={[styles.emblem, { borderColor: trim, transform: [{ scale: trophyScale }] }]} pointerEvents="none">
        <Animated.View style={[styles.emblemGlow, { backgroundColor: isVictory ? "rgba(238,151,42,0.55)" : isDraw ? "rgba(178,157,116,0.2)" : "rgba(154,45,38,0.2)", opacity: glowOpacity }]} />
        {isVictory && !reducedMotion ? <ImpactEffect trigger={1} variant="completion" size={104} /> : null}
        {isVictory && !reducedMotion ? <ImpactEffect trigger={1} variant="combo" size={126} /> : null}
        <Image source={TROPHY} resizeMode="contain" style={[styles.trophy, isDraw ? styles.drawTrophy : !isVictory && styles.defeatTrophy]} />
      </Animated.View>

      <View style={[styles.comparison, { borderColor: trim }]}>
        <View style={styles.topHighlight} pointerEvents="none" />
        <View style={styles.competitor}>
          {isVictory && !reducedMotion ? <ImpactEffect trigger={1} variant="completion" size={76} /> : null}
          <CharacterPortrait image={BLAZE} name="Blaze" subtitle="You" side="player" size="compact" reaction={isDraw ? "idle" : isVictory ? "victory" : "defeat"} reactionKey={result} />
          {scoresRevealed ? <CinematicCount value={Math.floor(playerScore)} active immediate={reducedMotion} style={styles.score} /> : <Text style={styles.score}>—</Text>}
          <Text style={styles.scoreLabel}>FINAL SCORE</Text>
        </View>
        <View style={styles.vsColumn}>
          <View style={styles.rule} />
          <View style={styles.vsBadge}><Text style={styles.vs}>VS</Text></View>
          <View style={styles.rule} />
        </View>
        <View style={styles.competitor}>
          {!isVictory && !reducedMotion ? <ImpactEffect trigger={1} variant="completion" size={76} /> : null}
          <CharacterPortrait fallback={opponentAvatar} name={opponentName} subtitle={opponentPersonality} side="opponent" size="compact" reaction={isDraw ? "idle" : isVictory ? "defeat" : "victory"} reactionKey={result} />
          {scoresRevealed ? <CinematicCount value={Math.floor(opponentScore)} active immediate={reducedMotion} style={styles.score} /> : <Text style={styles.score}>—</Text>}
          <Text style={styles.scoreLabel}>FINAL SCORE</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", width: "100%" },
  worldTour: { color: "#E3AA60", fontSize: 8, fontWeight: "900", letterSpacing: 2, marginTop: 4 },
  complete: { color: "#C19A6D", fontSize: 9, fontWeight: "900", letterSpacing: 2.2 },
  result: { fontSize: 39, fontWeight: "900", letterSpacing: 2.2, lineHeight: 43, textAlign: "center" },
  victory: { color: "#FFD06A", textShadowColor: "rgba(255,105,20,0.8)", textShadowRadius: 12 },
  defeat: { color: "#E06E5E", textShadowColor: "rgba(85,10,10,0.8)", textShadowRadius: 9 },
  draw: { color: "#D8C7A3", textShadowColor: "rgba(69,55,37,0.8)", textShadowRadius: 8 },
  subtitle: { color: "#E8CBA5", fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
  emblem: { alignItems: "center", backgroundColor: "rgba(10,7,8,0.95)", borderRadius: 40, borderWidth: 2, elevation: 8, height: 80, justifyContent: "center", marginBottom: 8, marginTop: 7, overflow: "hidden", shadowColor: "#F28A2D", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 9, width: 80 },
  emblemGlow: { borderRadius: 34, height: 66, position: "absolute", width: 66 },
  trophy: { height: 58, width: 58 },
  defeatTrophy: { opacity: 0.66, tintColor: "#C05B4E" },
  drawTrophy: { opacity: 0.78, tintColor: "#C7B58C" },
  comparison: { alignItems: "stretch", backgroundColor: "rgba(12,8,9,0.98)", borderRadius: 14, borderWidth: 1, elevation: 6, flexDirection: "row", minHeight: 116, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.32, shadowRadius: 8, width: "100%" },
  topHighlight: { backgroundColor: "rgba(255,218,150,0.12)", height: 1, left: 10, position: "absolute", right: 10, top: 1 },
  competitor: { alignItems: "center", flex: 1, justifyContent: "center", paddingVertical: 7 },
  score: { color: "#FFF1D9", fontSize: 25, fontWeight: "900", lineHeight: 27, textShadowColor: "rgba(255,126,32,0.32)", textShadowRadius: 5 },
  scoreLabel: { color: "#A48A76", fontSize: 7, fontWeight: "900", letterSpacing: 0.9 },
  vsColumn: { alignItems: "center", justifyContent: "center", width: 48 },
  rule: { backgroundColor: "rgba(225,132,43,0.3)", flex: 1, width: 1 },
  vsBadge: { alignItems: "center", backgroundColor: "#35130E", borderColor: "#DF8B31", borderRadius: 18, borderWidth: 1, height: 36, justifyContent: "center", marginVertical: 4, width: 36 },
  vs: { color: "#FFD071", fontSize: 12, fontStyle: "italic", fontWeight: "900" },
});
