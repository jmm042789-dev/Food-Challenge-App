import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";

import type { HeatTier } from "../heartburn";

type Props = {
  active: boolean;
  combo: number;
  heatTier: HeatTier;
  overheatWarningActive: boolean;
  reducedMotion: boolean;
  resetKey: string;
  onAction: () => number | null;
  onHoldStateChange?: (holding: boolean) => void;
};

type TimingResult = "PERFECT" | "GOOD" | "EARLY" | "LATE";

export const HOLD_FILL_DURATION_MS = 1200;
export const HOLD_TIMING_ZONES = {
  goodStart: 0.25,
  perfectStart: 0.45,
  perfectEnd: 0.55,
  goodEnd: 0.75,
} as const;
const FEEDBACK_DURATION_MS = 680;

function evaluateHoldTiming(progress: number): TimingResult {
  if (progress < HOLD_TIMING_ZONES.goodStart) return "EARLY";
  if (progress < HOLD_TIMING_ZONES.perfectStart) return "GOOD";
  if (progress <= HOLD_TIMING_ZONES.perfectEnd) return "PERFECT";
  if (progress <= HOLD_TIMING_ZONES.goodEnd) return "GOOD";
  return "LATE";
}

const feedbackLabels: Record<TimingResult, string> = {
  PERFECT: "PERFECT BITE!",
  GOOD: "GOOD BITE!",
  EARLY: "TOO EARLY",
  LATE: "TOO LATE",
};

function HoldReleaseActionControl({ active, combo, heatTier, overheatWarningActive, reducedMotion, resetKey, onAction, onHoldStateChange }: Props) {
  const [holding, setHolding] = useState(false);
  const [feedback, setFeedback] = useState<TimingResult | null>(null);
  const holdStartedAt = useRef(0);
  const fill = useRef(new Animated.Value(0)).current;
  const feedbackFlash = useRef(new Animated.Value(0)).current;
  const fillAnimation = useRef<Animated.CompositeAnimation | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdingRef = useRef(false);

  const clearFeedbackTimer = useCallback(() => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = null;
  }, []);

  const resetControl = useCallback(() => {
    clearFeedbackTimer();
    fillAnimation.current?.stop();
    fillAnimation.current = null;
    holdingRef.current = false;
    holdStartedAt.current = 0;
    fill.stopAnimation();
    fill.setValue(0);
    feedbackFlash.stopAnimation();
    feedbackFlash.setValue(0);
    setHolding(false);
    setFeedback(null);
    onHoldStateChange?.(false);
  }, [clearFeedbackTimer, feedbackFlash, fill, onHoldStateChange]);

  useEffect(() => {
    resetControl();
    return () => {
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
      fillAnimation.current?.stop();
      fill.stopAnimation();
      feedbackFlash.stopAnimation();
      onHoldStateChange?.(false);
    };
  }, [active, feedbackFlash, fill, onHoldStateChange, resetControl, resetKey]);

  const startHold = () => {
    if (!active || holdingRef.current) return;
    clearFeedbackTimer();
    setFeedback(null);
    holdingRef.current = true;
    holdStartedAt.current = Date.now();
    setHolding(true);
    onHoldStateChange?.(true);
    fill.stopAnimation();
    fill.setValue(0);
    fillAnimation.current = Animated.timing(fill, {
      toValue: 1,
      duration: HOLD_FILL_DURATION_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    fillAnimation.current.start();
  };

  const showFeedback = (result: TimingResult) => {
    setFeedback(result);
    feedbackFlash.stopAnimation();
    feedbackFlash.setValue(1);
    Animated.timing(feedbackFlash, {
      toValue: 0,
      duration: reducedMotion ? 160 : 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    clearFeedbackTimer();
    feedbackTimer.current = setTimeout(() => {
      setFeedback(null);
      feedbackTimer.current = null;
    }, FEEDBACK_DURATION_MS);
  };

  const releaseHold = () => {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    setHolding(false);
    onHoldStateChange?.(false);
    fillAnimation.current?.stop();
    fillAnimation.current = null;
    const elapsed = Date.now() - holdStartedAt.current;
    holdStartedAt.current = 0;
    const progress = Math.max(0, Math.min(1, elapsed / HOLD_FILL_DURATION_MS));
    const result = evaluateHoldTiming(progress);
    fill.setValue(progress);

    if (result === "GOOD" || result === "PERFECT") {
      const acceptedSequence = onAction();
      if (acceptedSequence === null) {
        fill.setValue(0);
        return;
      }
    }
    showFeedback(result);
    Animated.timing(fill, {
      toValue: 0,
      duration: reducedMotion ? 100 : 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  };

  const statusLabel = feedback ? feedbackLabels[feedback] : holding ? "RELEASE!" : active ? "HOLD" : "WAITING";
  const successful = feedback === "GOOD" || feedback === "PERFECT";
  const failed = feedback === "EARLY" || feedback === "LATE";

  return (
    <Pressable
      accessibilityHint="Press and hold, then release in the center Good or Perfect timing zone."
      accessibilityLabel={active ? "Hold and release bite control" : "Hold and release bite unavailable until gameplay starts"}
      accessibilityRole="button"
      accessibilityState={{ disabled: !active }}
      disabled={!active}
      onPressIn={startHold}
      onPressOut={releaseHold}
      style={styles.touchTarget}
    >
      <Animated.View pointerEvents="none" style={[styles.feedbackGlow, successful && styles.successGlow, failed && styles.failureGlow, {
        opacity: feedbackFlash,
        transform: [{ scale: feedbackFlash.interpolate({
          inputRange: [0, 1],
          outputRange: reducedMotion ? [1, 1] : [1, feedback === "PERFECT" ? 1.08 : 1.025],
        }) }],
      }]} />
      <View style={[
        styles.pad,
        combo >= 5 && styles.comboPad,
        holding && styles.holdingPad,
        successful && styles.successPad,
        failed && styles.failurePad,
        heatTier === "CRITICAL" || heatTier === "OVERHEATED" ? styles.criticalPad : null,
        overheatWarningActive && styles.warningPad,
        !active && styles.disabledPad,
      ]}>
        <View style={styles.padInset}>
          <Text maxFontSizeMultiplier={1.25} numberOfLines={1} style={styles.title}>{statusLabel}</Text>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.meter}>
            <View style={[styles.zone, styles.earlyZone]} />
            <View style={[styles.zone, styles.goodZone]} />
            <View style={[styles.zone, styles.perfectZone]} />
            <View style={[styles.zone, styles.goodZone]} />
            <View style={[styles.zone, styles.lateZone]} />
            <Animated.View style={[styles.fill, {
              opacity: reducedMotion ? 0.7 : 0.88,
              width: fill.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
            }]} />
          </View>
          <Text maxFontSizeMultiplier={1.35} numberOfLines={1} style={styles.subtitle}>{holding ? "RELEASE IN THE CENTER" : feedback ? (successful ? "BITE ACCEPTED" : "TRY THE CENTER") : "TIME YOUR RELEASE"}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default memo(HoldReleaseActionControl);

const styles = StyleSheet.create({
  touchTarget: { alignItems: "center", height: 82, justifyContent: "center", maxWidth: 520, width: "78%" },
  feedbackGlow: { borderRadius: 24, bottom: 0, left: -6, position: "absolute", right: -6, top: 0 },
  successGlow: { backgroundColor: "rgba(255,208,76,0.5)" },
  failureGlow: { backgroundColor: "rgba(255,77,45,0.32)" },
  pad: { backgroundColor: "#24100B", borderColor: "#F09A37", borderRadius: 22, borderWidth: 3, elevation: 8, height: 76, justifyContent: "center", overflow: "hidden", shadowColor: "#FF6A21", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 12, width: "100%" },
  padInset: { alignItems: "center", backgroundColor: "#7E2D15", borderColor: "#FFB04B", borderRadius: 17, borderWidth: 2, bottom: 6, justifyContent: "center", left: 6, paddingHorizontal: 16, position: "absolute", right: 6, top: 6 },
  comboPad: { borderColor: "#FFC75A" },
  holdingPad: { borderColor: "#FFD66D", shadowOpacity: 0.72 },
  successPad: { borderColor: "#FFE383" },
  failurePad: { borderColor: "#FF6642" },
  criticalPad: { borderColor: "#FF663D" },
  warningPad: { borderColor: "#FF8B53", shadowOpacity: 0.38 },
  disabledPad: { opacity: 0.42, shadowOpacity: 0 },
  title: { color: "#FFF4D7", fontSize: 17, fontWeight: "900", letterSpacing: 1.1, lineHeight: 20 },
  meter: { borderColor: "rgba(255,232,183,0.42)", borderRadius: 4, borderWidth: 1, flexDirection: "row", height: 9, marginTop: 2, overflow: "hidden", position: "relative", width: "100%" },
  zone: { height: "100%" },
  earlyZone: { backgroundColor: "#81301E", width: "25%" },
  goodZone: { backgroundColor: "#D58A2D", width: "20%" },
  perfectZone: { backgroundColor: "#F8DB70", width: "10%" },
  lateZone: { backgroundColor: "#81301E", width: "25%" },
  fill: { backgroundColor: "rgba(255,255,255,0.68)", bottom: 0, left: 0, position: "absolute", top: 0 },
  subtitle: { color: "#FFD18A", fontSize: 7, fontWeight: "900", letterSpacing: 0.8, marginTop: 2 },
});
