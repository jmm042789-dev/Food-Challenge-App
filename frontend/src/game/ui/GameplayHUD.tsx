import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

import MatchHUD from "./MatchHUD";
import type { OpponentMood } from "../ai/OpponentMood";
import { useReducedMotionPreference } from "../../components/fire/FireProgressBar";

type Props = {
  level: number;
  xp: number;
  nextLevelXp: number;
  coins: number;
  timeRemaining: number;
  playerScore: number;
  opponentScore: number;
  combo: number;
  opponentName?: string;
  opponentAvatar?: string;
  opponentPersonality?: string;
  opponentMood: OpponentMood;
  contestName?: string;
  location?: string;
  difficulty?: string;
  roundLabel?: string;
};

function VerticalMeter({ label, detail, value, tone, reducedMotion }: { label: string; detail?: string; value: number; tone: "combo" | "heat"; reducedMotion: boolean }) {
  const warning = tone === "heat" && value >= 0.82;
  const warningScale = useRef(new Animated.Value(1)).current;
  const warningGlow = useRef(new Animated.Value(0)).current;
  const fillProgress = useRef(new Animated.Value(value)).current;
  const previousValue = useRef(value);

  useEffect(() => {
    const animation = Animated.timing(fillProgress, {
      toValue: Math.max(0, Math.min(1, value)),
      duration: reducedMotion ? 0 : 140,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [fillProgress, reducedMotion, value]);

  useEffect(() => {
    const comboIncreased = tone === "combo" && value > previousValue.current;
    previousValue.current = value;
    if ((!warning && !comboIncreased) || reducedMotion) {
      warningScale.stopAnimation();
      warningGlow.stopAnimation();
      warningScale.setValue(1);
      warningGlow.setValue(0);
      return;
    }
    warningScale.setValue(comboIncreased ? 1.045 + value * 0.025 : 1.035);
    warningGlow.setValue(comboIncreased ? 0.58 : 0.75);
    const animation = Animated.parallel([
      Animated.spring(warningScale, { toValue: 1, friction: 8, tension: 180, useNativeDriver: true }),
      Animated.timing(warningGlow, { toValue: warning ? 0.25 : 0, duration: 320, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [reducedMotion, tone, value, warning, warningGlow, warningScale]);

  return (
    <Animated.View style={[styles.meterGroup, { transform: [{ scale: warningScale }] }]} pointerEvents="none">
      <View style={styles.meterConnector} />
      <Text maxFontSizeMultiplier={1.5} style={styles.meterValue}>{Math.round(value * 100)}</Text>
      <View style={[styles.meterShell, warning && styles.meterShellWarning]}>
        <Animated.View style={[styles.heatGlow, tone === "combo" && styles.comboGlow, { opacity: warningGlow }]} />
        <View style={styles.meterTrack}>
          <Animated.View style={[styles.meterFill, tone === "combo" ? styles.comboFill : styles.heatFill, { height: fillProgress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }]} />
          <View style={styles.meterShine} />
        </View>
      </View>
      <Text maxFontSizeMultiplier={1.5} style={styles.meterLabel}>{label}</Text>
      {detail ? <Text maxFontSizeMultiplier={1.5} numberOfLines={1} style={styles.meterDetail}>{detail}</Text> : null}
    </Animated.View>
  );
}

export default function GameplayHUD(props: Props) {
  const comboMeter = Math.min(1, props.combo / 25);
  const reducedMotion = useReducedMotionPreference();

  return (
    <View style={styles.container}>
      <MatchHUD
        timeRemaining={props.timeRemaining}
        playerScore={props.playerScore}
        opponentScore={props.opponentScore}
        opponentName={props.opponentName}
        opponentAvatar={props.opponentAvatar}
        opponentPersonality={props.opponentPersonality}
        opponentMood={props.opponentMood}
        combo={props.combo}
        contestName={props.contestName}
        location={props.location}
        difficulty={props.difficulty}
        roundLabel={props.roundLabel}
        reducedMotion={reducedMotion}
      />
      <View accessibilityLabel="Combo progress" accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 25, now: Math.min(25, Math.max(0, props.combo)) }} style={styles.leftMeter}><VerticalMeter label="COMBO" value={comboMeter} tone="combo" reducedMotion={reducedMotion} /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 9, paddingTop: 6, width: "100%", zIndex: 20 },
  leftMeter: { left: 12, position: "absolute", top: 105 },
  meterGroup: { alignItems: "center", width: 38 },
  meterConnector: { backgroundColor: "rgba(232,141,47,0.62)", height: 9, position: "absolute", top: -9, width: 1 },
  meterValue: { color: "#FFDA82", fontSize: 10, fontWeight: "900", marginBottom: 3 },
  meterShell: { backgroundColor: "rgba(8,6,7,0.97)", borderColor: "rgba(241,157,60,0.8)", borderRadius: 8, borderTopLeftRadius: 2, borderTopRightRadius: 2, borderWidth: 1, height: 92, padding: 4, width: 28 },
  meterShellWarning: { backgroundColor: "rgba(54,10,8,0.96)", borderColor: "#FF6038", borderWidth: 2 },
  heatGlow: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(255,72,25,0.3)", borderRadius: 9 },
  comboGlow: { backgroundColor: "rgba(255,188,62,0.28)" },
  meterTrack: { backgroundColor: "rgba(50,25,20,0.92)", borderRadius: 6, flex: 1, justifyContent: "flex-end", overflow: "hidden" },
  meterFill: { borderRadius: 5, minHeight: 3, width: "100%" },
  comboFill: { backgroundColor: "#F39A2D" },
  heatFill: { backgroundColor: "#D94B28" },
  meterShine: { backgroundColor: "rgba(255,230,180,0.18)", bottom: 2, left: 2, position: "absolute", top: 2, width: 3 },
  meterLabel: { color: "#E9BF80", fontSize: 7, fontWeight: "900", letterSpacing: 0.7, marginTop: 4 },
  meterDetail: { color: "#FFCA72", fontSize: 6, fontWeight: "900", marginTop: 1, maxWidth: 42, textAlign: "center" },
});
