import React, { memo, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import type { HeatTier } from "../heartburn";

type Props = { heartburn: number; heatTier: HeatTier; isOverheated: boolean };
const opacityByTier: Record<HeatTier, number> = { COOL: 0.01, WARM: 0.07, HOT: 0.12, CRITICAL: 0.18, OVERHEATED: 0.24 };

function HeatScreenOverlay({ heartburn, heatTier, isOverheated }: Props) {
  const opacity = useRef(new Animated.Value(opacityByTier[heatTier])).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const previousOverheated = useRef(isOverheated);
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => { let mounted = true; AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (mounted) setReducedMotion(v); }); return () => { mounted = false; }; }, []);
  useEffect(() => { const a = Animated.timing(opacity, { toValue: opacityByTier[heatTier], duration: reducedMotion ? 0 : 360, useNativeDriver: true }); a.start(); return () => a.stop(); }, [heatTier, opacity, reducedMotion]);
  useEffect(() => {
    pulse.stopAnimation(); pulse.setValue(0);
    if (reducedMotion || (heatTier !== "CRITICAL" && heatTier !== "OVERHEATED")) return;
    const a = Animated.loop(Animated.sequence([Animated.timing(pulse, { toValue: 1, duration: isOverheated ? 430 : 720, easing: Easing.inOut(Easing.sin), useNativeDriver: true }), Animated.timing(pulse, { toValue: 0, duration: isOverheated ? 430 : 720, easing: Easing.inOut(Easing.sin), useNativeDriver: true })]));
    a.start(); return () => a.stop();
  }, [heatTier, isOverheated, pulse, reducedMotion]);
  useEffect(() => {
    if (isOverheated && !previousOverheated.current && !reducedMotion) {
      flash.setValue(0.16);
      Animated.timing(flash, { toValue: 0, duration: 320, useNativeDriver: true }).start();
    }
    previousOverheated.current = isOverheated;
  }, [flash, isOverheated, reducedMotion]);
  useEffect(() => () => { opacity.stopAnimation(); pulse.stopAnimation(); flash.stopAnimation(); }, [flash, opacity, pulse]);
  const color = isOverheated ? "rgba(255,31,22,0.9)" : heatTier === "CRITICAL" ? "rgba(244,60,24,0.82)" : "rgba(236,99,28,0.7)";
  return <Animated.View pointerEvents="none" style={[styles.overlay, { opacity: Animated.add(Animated.add(opacity, flash), pulse.interpolate({ inputRange: [0, 1], outputRange: [0, isOverheated ? 0.08 : 0.035] })) }]}>
    <LinearGradient colors={[color, "transparent"]} style={styles.top} />
    <LinearGradient colors={["transparent", color]} style={styles.bottom} />
    <LinearGradient colors={[color, "transparent"]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.left} />
    <LinearGradient colors={["transparent", color]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.right} />
    <View style={[styles.edge, { borderColor: color, borderWidth: heartburn >= 75 ? 3 : 2 }]} />
  </Animated.View>;
}
export default memo(HeatScreenOverlay);
const styles = StyleSheet.create({ overlay: { ...StyleSheet.absoluteFillObject, zIndex: 2 }, top: { height: 78, left: 0, position: "absolute", right: 0, top: 0 }, bottom: { bottom: 0, height: 88, left: 0, position: "absolute", right: 0 }, left: { bottom: 0, left: 0, position: "absolute", top: 0, width: 54 }, right: { bottom: 0, position: "absolute", right: 0, top: 0, width: 54 }, edge: { ...StyleSheet.absoluteFillObject } });
