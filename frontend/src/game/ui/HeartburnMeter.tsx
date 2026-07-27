import React, { memo, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Image, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { clampHeartburn, type HeatTier } from "../heartburn";

type HeartburnMeterProps = {
  heartburn: number;
  heatTier: HeatTier;
  heatMultiplier: number;
  isOverheated: boolean;
  overheatPenaltyActive: boolean;
  overheatRemainingMs: number;
  coolingTrigger?: number;
};

const HEAT_ICON = require("../../assets/ui/hud/heartburn-meter.png");
const ANTACID_ICON = require("../../assets/icons/antacid.png");
const tierColors: Record<HeatTier, string> = { COOL: "#D58B38", WARM: "#F2A33B", HOT: "#F2762E", CRITICAL: "#F0442C", OVERHEATED: "#FF2D25" };

function formatMultiplier(value: number) {
  return value.toFixed(2).replace(/0$/, "");
}

function HeartburnMeter({ heartburn, heatTier, heatMultiplier, isOverheated, overheatPenaltyActive, overheatRemainingMs, coolingTrigger = 0 }: HeartburnMeterProps) {
  const progress = useRef(new Animated.Value(clampHeartburn(heartburn) / 100)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const impact = useRef(new Animated.Value(0)).current;
  const cooling = useRef(new Animated.Value(0)).current;
  const previousOverheated = useRef(isOverheated);
  const [reducedMotion, setReducedMotion] = useState(false);
  const heat = clampHeartburn(heartburn);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => { if (mounted) setReducedMotion(enabled); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const animation = Animated.timing(progress, { toValue: isOverheated ? 1 : heat / 100, duration: reducedMotion ? 0 : 260, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [heat, isOverheated, progress, reducedMotion]);

  useEffect(() => {
    pulse.stopAnimation();
    pulse.setValue(0);
    if (reducedMotion || heatTier === "COOL") return;
    const duration = heatTier === "OVERHEATED" ? 420 : heatTier === "CRITICAL" ? 620 : heatTier === "HOT" ? 900 : 1250;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [heatTier, pulse, reducedMotion]);

  useEffect(() => {
    if (isOverheated && !previousOverheated.current && !reducedMotion) {
      impact.setValue(1);
      const animation = Animated.spring(impact, { toValue: 0, friction: 5, tension: 260, useNativeDriver: true });
      animation.start();
      previousOverheated.current = isOverheated;
      return () => animation.stop();
    }
    previousOverheated.current = isOverheated;
  }, [impact, isOverheated, reducedMotion]);

  useEffect(() => {
    if (coolingTrigger <= 0) return;
    cooling.stopAnimation();
    cooling.setValue(1);
    const animation = Animated.timing(cooling, { toValue: 0, duration: reducedMotion ? 0 : 720, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [cooling, coolingTrigger, reducedMotion]);

  useEffect(() => () => {
    progress.stopAnimation();
    pulse.stopAnimation();
    impact.stopAnimation();
    cooling.stopAnimation();
  }, [cooling, impact, progress, pulse]);

  const countdown = Math.max(0, overheatRemainingMs / 1000).toFixed(1);
  const roundedHeat = Math.round(heat);
  const multiplier = formatMultiplier(heatMultiplier);
  const displayTier = isOverheated ? "OVERHEATING" : overheatPenaltyActive ? "PENALTY" : heatTier;
  const rescueProgress = Math.max(0, Math.min(1, overheatRemainingMs / 2000));
  const showAntacidCue = heatTier === "CRITICAL" || isOverheated;
  const meterShake = heatTier === "CRITICAL" && !reducedMotion
    ? pulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 0] })
    : 0;

  return (
    <Animated.View
      accessibilityLabel={`Heat ${roundedHeat} percent, ${displayTier.toLowerCase()}, score multiplier ${overheatPenaltyActive ? "0.5" : multiplier}${isOverheated ? `, use antacid within ${countdown} seconds` : ""}`}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: roundedHeat, text: displayTier }}
      style={[styles.root, heatTier === "CRITICAL" && styles.criticalRoot, isOverheated && styles.warningRoot, overheatPenaltyActive && styles.penaltyRoot, {
        borderColor: tierColors[heatTier],
        transform: [
          { translateX: Animated.add(impact.interpolate({ inputRange: [0, 1], outputRange: [0, 2] }), meterShake) },
          { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, heatTier === "OVERHEATED" ? 1.04 : heatTier === "CRITICAL" ? 1.025 : 1.015] }) },
        ],
      }]}
    >
      <Animated.View pointerEvents="none" style={[styles.glow, { backgroundColor: tierColors[heatTier], opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.06, heatTier === "OVERHEATED" ? 0.28 : 0.17] }) }]} />
      <Animated.View pointerEvents="none" style={[styles.coolingGlow, { opacity: cooling, transform: [{ scale: cooling.interpolate({ inputRange: [0, 1], outputRange: [1.08, 0.96] }) }] }]} />
      <View style={styles.heading}>
        <Image source={HEAT_ICON} resizeMode="contain" style={styles.icon} />
        <Text maxFontSizeMultiplier={1.35} style={styles.label}>HEAT</Text>
        <Text maxFontSizeMultiplier={1.35} style={styles.percent}>{roundedHeat}%</Text>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { transform: [{ scaleX: progress }] }]}>
          <LinearGradient colors={heatTier === "COOL" ? ["#E7AA50", "#C56E2B"] : ["#FFD06A", tierColors[heatTier], "#B9271D"]} end={{ x: 1, y: 0 }} start={{ x: 0, y: 0 }} style={StyleSheet.absoluteFill} />
          <View style={styles.fillHighlight} />
        </Animated.View>
      </View>
      <View style={styles.statusRow}>
        {showAntacidCue ? <Image source={ANTACID_ICON} resizeMode="contain" style={styles.antacidCue} /> : <View style={styles.cueSpacer} />}
        <Text maxFontSizeMultiplier={1.3} numberOfLines={1} style={[styles.tier, heatTier === "CRITICAL" && styles.risk]}>{displayTier}</Text>
        <Text maxFontSizeMultiplier={1.3} numberOfLines={1} style={[styles.multiplier, overheatPenaltyActive && styles.penaltyText]}>{overheatPenaltyActive ? "0.5x" : `${multiplier}x`}</Text>
      </View>
      {isOverheated ? (
        <>
          <Text maxFontSizeMultiplier={1.25} style={styles.instruction}>USE ANTACID · {countdown}s</Text>
          <View style={styles.rescueTrack}><View style={[styles.rescueFill, { width: `${rescueProgress * 100}%` }]} /></View>
        </>
      ) : (
        <Text maxFontSizeMultiplier={1.3} numberOfLines={1} style={styles.detail}>{overheatPenaltyActive ? "PENALTY 0.5x" : heatTier === "CRITICAL" ? "RISK BONUS" : "SCORE MULTIPLIER"}</Text>
      )}
    </Animated.View>
  );
}

export default memo(HeartburnMeter);

const styles = StyleSheet.create({
  root: { backgroundColor: "rgba(9,6,7,0.94)", borderRadius: 10, borderWidth: 1, elevation: 4, minHeight: 78, overflow: "hidden", paddingHorizontal: 7, paddingVertical: 5, shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, width: 112 },
  criticalRoot: { borderWidth: 2, shadowColor: "#FF472D", shadowOpacity: 0.62, shadowRadius: 8 },
  warningRoot: { backgroundColor: "rgba(65,7,7,0.97)", borderWidth: 2, elevation: 9 },
  penaltyRoot: { backgroundColor: "rgba(49,21,9,0.96)" },
  glow: { ...StyleSheet.absoluteFillObject },
  heading: { alignItems: "center", flexDirection: "row", minWidth: 0 },
  coolingGlow: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(92,224,255,0.42)", borderColor: "#A9F4FF", borderRadius: 9, borderWidth: 2 },
  icon: { height: 16, marginRight: 3, width: 16 },
  label: { color: "#EBC38A", fontSize: 7, fontWeight: "900", letterSpacing: 0.8 },
  percent: { color: "#FFF0D8", flex: 1, fontSize: 9, fontWeight: "900", textAlign: "right" },
  track: { backgroundColor: "rgba(54,27,21,0.92)", borderRadius: 4, height: 8, marginTop: 4, overflow: "hidden" },
  fill: { borderRadius: 4, height: "100%", transformOrigin: "left center", width: "100%" },
  fillHighlight: { backgroundColor: "rgba(255,255,255,0.3)", height: 1, left: 2, position: "absolute", right: 2, top: 1 },
  statusRow: { alignItems: "center", flexDirection: "row", height: 15, marginTop: 2 },
  antacidCue: { height: 13, marginRight: 3, width: 13 },
  cueSpacer: { width: 2 },
  tier: { color: "#F1C477", flex: 1, fontSize: 6.5, fontWeight: "900", letterSpacing: 0.35 },
  multiplier: { color: "#FFF0C7", fontSize: 7, fontWeight: "900" },
  penaltyText: { color: "#FFB45D" },
  detail: { color: "#CFA56C", fontSize: 5.5, fontWeight: "900", letterSpacing: 0.3, minHeight: 8, textAlign: "center" },
  risk: { color: "#FFD56E" },
  instruction: { color: "#FFF0D6", fontSize: 6.5, fontWeight: "900", letterSpacing: 0.35, textAlign: "center" },
  rescueTrack: { backgroundColor: "rgba(24,2,2,0.9)", borderRadius: 3, height: 4, marginTop: 2, overflow: "hidden" },
  rescueFill: { backgroundColor: "#FFCC52", height: "100%" },
});
