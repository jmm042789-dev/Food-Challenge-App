import React, { memo, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Image, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { clampHeartburn, type HeatTier } from "../heartburn";

type HeartburnMeterProps = {
  heartburn: number;
  heatTier: HeatTier;
  heatMultiplier: number;
  isOverheated: boolean;
  overheatRemainingMs: number;
  coolingTrigger?: number;
};

const HEAT_ICON = require("../../assets/ui/hud/heartburn-meter.png");
const tierColors: Record<HeatTier, string> = { COOL: "#D58B38", WARM: "#F2A33B", HOT: "#F2762E", CRITICAL: "#F0442C", OVERHEATED: "#FF2D25" };

function HeartburnMeter({ heartburn, heatTier, heatMultiplier, isOverheated, overheatRemainingMs, coolingTrigger = 0 }: HeartburnMeterProps) {
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
      Animated.spring(impact, { toValue: 0, friction: 5, tension: 260, useNativeDriver: true }).start();
    }
    previousOverheated.current = isOverheated;
  }, [impact, isOverheated, reducedMotion]);

  useEffect(() => {
    if (coolingTrigger <= 0) return;
    cooling.stopAnimation();
    cooling.setValue(1);
    const animation = Animated.timing(cooling, {
      toValue: 0,
      duration: reducedMotion ? 0 : 720,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [cooling, coolingTrigger, reducedMotion]);

  useEffect(() => () => { progress.stopAnimation(); pulse.stopAnimation(); impact.stopAnimation(); cooling.stopAnimation(); }, [cooling, impact, progress, pulse]);

  const countdown = Math.max(0, overheatRemainingMs / 1000).toFixed(1);
  const detail = `${heatTier} · x${heatMultiplier.toFixed(1)}`;
  return (
    <Animated.View
      accessibilityLabel={`Heat ${heat} percent, ${heatTier.toLowerCase()} tier, score multiplier ${heatMultiplier.toFixed(1)}${isOverheated ? `, recovery in ${countdown} seconds` : ""}`}
      accessibilityRole="progressbar"
      style={[styles.root, { borderColor: tierColors[heatTier], transform: [{ translateX: impact.interpolate({ inputRange: [0, 1], outputRange: [0, 2] }) }, { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, heatTier === "OVERHEATED" ? 1.045 : 1.025] }) }] }]}
    >
      <Animated.View pointerEvents="none" style={[styles.glow, { backgroundColor: tierColors[heatTier], opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.08, heatTier === "OVERHEATED" ? 0.28 : 0.18] }) }]} />
      <Animated.View pointerEvents="none" style={[styles.coolingGlow, { opacity: cooling, transform: [{ scale: cooling.interpolate({ inputRange: [0, 1], outputRange: [1.08, 0.96] }) }] }]} />
      <View style={styles.heading}><Image source={HEAT_ICON} resizeMode="contain" style={styles.icon} /><Text style={styles.label}>HEAT</Text><Text style={styles.percent}>{heat}%</Text></View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { transform: [{ scaleX: progress }] }]}>
          <LinearGradient colors={heatTier === "COOL" ? ["#E7AA50", "#C56E2B"] : ["#FFD06A", tierColors[heatTier], "#B9271D"]} end={{ x: 1, y: 0 }} start={{ x: 0, y: 0 }} style={StyleSheet.absoluteFill} />
          <View style={styles.fillHighlight} />
        </Animated.View>
      </View>
      <Text numberOfLines={1} style={[styles.detail, heatTier === "CRITICAL" && styles.risk]}>{heatTier === "CRITICAL" ? `RISK BONUS · x${heatMultiplier.toFixed(1)}` : detail}</Text>
      {isOverheated ? <Text style={styles.countdown}>{countdown}s</Text> : null}
    </Animated.View>
  );
}

export default memo(HeartburnMeter);

const styles = StyleSheet.create({
  root: { backgroundColor: "rgba(9,6,7,0.94)", borderRadius: 9, borderWidth: 1, elevation: 4, minHeight: 62, overflow: "hidden", paddingHorizontal: 6, paddingVertical: 5, shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, width: 104 },
  glow: { ...StyleSheet.absoluteFillObject }, heading: { alignItems: "center", flexDirection: "row", minWidth: 0 },
  coolingGlow: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(92,224,255,0.42)", borderColor: "#A9F4FF", borderRadius: 9, borderWidth: 2 },
  icon: { height: 16, marginRight: 3, width: 16 }, label: { color: "#EBC38A", fontSize: 7, fontWeight: "900", letterSpacing: 0.8 }, percent: { color: "#FFF0D8", flex: 1, fontSize: 9, fontWeight: "900", textAlign: "right" },
  track: { backgroundColor: "rgba(54,27,21,0.92)", borderRadius: 4, height: 8, marginTop: 4, overflow: "hidden" },
  fill: { borderRadius: 4, height: "100%", transformOrigin: "left center", width: "100%" },
  fillHighlight: { backgroundColor: "rgba(255,255,255,0.3)", height: 1, left: 2, position: "absolute", right: 2, top: 1 },
  detail: { color: "#E6B76F", fontSize: 6, fontWeight: "900", letterSpacing: 0.3, marginTop: 4, textAlign: "center" }, risk: { color: "#FFD56E" },
  countdown: { color: "#FFF0D6", fontSize: 8, fontWeight: "900", marginTop: 1, textAlign: "center" },
});
