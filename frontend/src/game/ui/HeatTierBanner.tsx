import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text } from "react-native";
import * as Haptics from "expo-haptics";

import type { HeatTier } from "../heartburn";

const rank: Record<HeatTier, number> = { COOL: 0, WARM: 1, HOT: 2, CRITICAL: 3, OVERHEATED: 4 };
const labels: Record<HeatTier, string> = { COOL: "", WARM: "WARMING UP", HOT: "HEAT RISING", CRITICAL: "CRITICAL HEAT", OVERHEATED: "OVERHEATED" };

export default function HeatTierBanner({ heatTier }: { heatTier: HeatTier }) {
  const previous = useRef<HeatTier>(heatTier);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-12)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animation = useRef<Animated.CompositeAnimation | null>(null);
  const [visibleTier, setVisibleTier] = useState<HeatTier | null>(null);

  useEffect(() => {
    const oldTier = previous.current;
    previous.current = heatTier;
    if (rank[heatTier] <= rank[oldTier] || heatTier === "COOL") return;
    if (timer.current) clearTimeout(timer.current);
    animation.current?.stop();
    setVisibleTier(heatTier);
    opacity.setValue(0); translateY.setValue(-12);
    animation.current = Animated.parallel([Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }), Animated.timing(translateY, { toValue: 0, duration: 190, easing: Easing.out(Easing.cubic), useNativeDriver: true })]);
    animation.current.start();
    const haptic = heatTier === "OVERHEATED" ? Haptics.NotificationFeedbackType.Error : heatTier === "CRITICAL" ? Haptics.ImpactFeedbackStyle.Heavy : heatTier === "HOT" ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light;
    const feedback = heatTier === "OVERHEATED" ? Haptics.notificationAsync(haptic as Haptics.NotificationFeedbackType) : Haptics.impactAsync(haptic as Haptics.ImpactFeedbackStyle);
    feedback.catch(() => {});
    timer.current = setTimeout(() => Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => setVisibleTier(null)), heatTier === "OVERHEATED" ? 1000 : 820);
  }, [heatTier, opacity, translateY]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); animation.current?.stop(); opacity.stopAnimation(); translateY.stopAnimation(); }, [opacity, translateY]);
  if (!visibleTier) return null;
  return <Animated.View pointerEvents="none" style={[styles.banner, visibleTier === "OVERHEATED" && styles.overheated, { opacity, transform: [{ translateY }] }]}><Text style={styles.text}>{labels[visibleTier]}</Text></Animated.View>;
}
const styles = StyleSheet.create({ banner: { alignSelf: "center", backgroundColor: "rgba(70,23,12,0.96)", borderColor: "#F09A38", borderRadius: 8, borderWidth: 1, paddingHorizontal: 18, paddingVertical: 8, position: "absolute", top: "25%", zIndex: 80 }, overheated: { backgroundColor: "rgba(104,13,10,0.98)", borderColor: "#FF4935", borderWidth: 2 }, text: { color: "#FFF0D2", fontSize: 15, fontWeight: "900", letterSpacing: 1.4 } });
