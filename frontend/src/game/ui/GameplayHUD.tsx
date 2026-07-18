import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

import MatchHUD from "./MatchHUD";
import type { HeatTier } from "../heartburn";
import HeartburnMeter from "./HeartburnMeter";

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
  contestName?: string;
  location?: string;
  difficulty?: string;
  roundLabel?: string;
  heartburn: number;
  heatTier: HeatTier;
  heatMultiplier: number;
  isOverheated: boolean;
  overheatRemainingMs: number;
  antacidCount: number;
  canUseAntacid: boolean;
  onUseAntacid: () => boolean;
};

function VerticalMeter({ label, detail, value, tone }: { label: string; detail?: string; value: number; tone: "combo" | "heat" }) {
  const percent = `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` as `${number}%`;
  const warning = tone === "heat" && value >= 0.82;
  const warningScale = useRef(new Animated.Value(1)).current;
  const warningGlow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!warning) return;
    warningScale.setValue(1.035);
    warningGlow.setValue(0.75);
    const animation = Animated.parallel([
      Animated.spring(warningScale, { toValue: 1, friction: 8, tension: 180, useNativeDriver: true }),
      Animated.timing(warningGlow, { toValue: 0.25, duration: 420, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [value, warning, warningGlow, warningScale]);

  return (
    <Animated.View style={[styles.meterGroup, { transform: [{ scale: warningScale }] }]} pointerEvents="none">
      <View style={styles.meterConnector} />
      <Text style={styles.meterValue}>{Math.round(value * 100)}</Text>
      <View style={[styles.meterShell, warning && styles.meterShellWarning]}>
        <Animated.View style={[styles.heatGlow, { opacity: warningGlow }]} />
        <View style={styles.meterTrack}>
          <View style={[styles.meterFill, tone === "combo" ? styles.comboFill : styles.heatFill, { height: percent }]} />
          <View style={styles.meterShine} />
        </View>
      </View>
      <Text style={styles.meterLabel}>{label}</Text>
      {detail ? <Text numberOfLines={1} style={styles.meterDetail}>{detail}</Text> : null}
    </Animated.View>
  );
}

export default function GameplayHUD(props: Props) {
  const comboMeter = Math.min(1, props.combo / 25);

  return (
    <View style={styles.container}>
      <MatchHUD
        timeRemaining={props.timeRemaining}
        playerScore={props.playerScore}
        opponentScore={props.opponentScore}
        opponentName={props.opponentName}
        opponentAvatar={props.opponentAvatar}
        opponentPersonality={props.opponentPersonality}
        combo={props.combo}
        contestName={props.contestName}
        location={props.location}
        difficulty={props.difficulty}
        roundLabel={props.roundLabel}
      />
      <View style={styles.leftMeter}><VerticalMeter label="COMBO" value={comboMeter} tone="combo" /></View>
      <View style={styles.rightMeter}><HeartburnMeter heartburn={props.heartburn} heatTier={props.heatTier} heatMultiplier={props.heatMultiplier} isOverheated={props.isOverheated} overheatRemainingMs={props.overheatRemainingMs} /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 7, paddingTop: 5, width: "100%", zIndex: 20 },
  leftMeter: { left: 9, position: "absolute", top: 110 },
  rightMeter: { position: "absolute", right: 9, top: 110 },
  meterGroup: { alignItems: "center", width: 42 },
  meterConnector: { backgroundColor: "rgba(232,141,47,0.62)", height: 9, position: "absolute", top: -9, width: 1 },
  meterValue: { color: "#FFD06A", fontSize: 10, fontWeight: "900", marginBottom: 3 },
  meterShell: { backgroundColor: "rgba(8,6,7,0.97)", borderColor: "rgba(238,145,48,0.76)", borderRadius: 8, borderTopLeftRadius: 2, borderTopRightRadius: 2, borderWidth: 1, height: 108, padding: 4, width: 30 },
  meterShellWarning: { backgroundColor: "rgba(54,10,8,0.96)", borderColor: "#FF6038", borderWidth: 2 },
  heatGlow: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(255,72,25,0.3)", borderRadius: 9 },
  meterTrack: { backgroundColor: "rgba(50,25,20,0.92)", borderRadius: 6, flex: 1, justifyContent: "flex-end", overflow: "hidden" },
  meterFill: { borderRadius: 5, minHeight: 3, width: "100%" },
  comboFill: { backgroundColor: "#F39A2D" },
  heatFill: { backgroundColor: "#D94B28" },
  meterShine: { backgroundColor: "rgba(255,230,180,0.18)", bottom: 2, left: 2, position: "absolute", top: 2, width: 3 },
  meterLabel: { color: "#DDB274", fontSize: 7, fontWeight: "900", letterSpacing: 0.6, marginTop: 4 },
  meterDetail: { color: "#FFCA72", fontSize: 6, fontWeight: "900", marginTop: 1, maxWidth: 42, textAlign: "center" },
});
