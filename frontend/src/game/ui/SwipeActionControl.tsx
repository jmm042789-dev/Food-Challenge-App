import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, PanResponder, StyleSheet, Text, View } from "react-native";

import type { HeatTier } from "../heartburn";
import {
  SWIPE_CONFIG,
  claimSwipeSubmission,
  validateSwipe,
  type SwipeSubmissionState,
  type SwipeValidationReason,
} from "./swipeValidation";

type Props = {
  active: boolean;
  combo: number;
  heatTier: HeatTier;
  overheatWarningActive: boolean;
  reducedMotion: boolean;
  resetKey: string;
  onAction: () => number | null;
};

type Feedback = "GOOD SWIPE!" | "SWIPE FARTHER" | "TOO SLOW" | "TRY AGAIN";

const feedbackForReason = (reason: SwipeValidationReason): Feedback => {
  if (reason === "VALID") return "GOOD SWIPE!";
  if (reason === "TOO_SHORT") return "SWIPE FARTHER";
  if (reason === "TOO_SLOW") return "TOO SLOW";
  return "TRY AGAIN";
};

function SwipeActionControl({ active, combo, heatTier, overheatWarningActive, reducedMotion, resetKey, onAction }: Props) {
  const [swiping, setSwiping] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const indicatorX = useRef(new Animated.Value(0)).current;
  const feedbackFlash = useRef(new Animated.Value(0)).current;
  const startPosition = useRef({ x: 0, y: 0 });
  const endPosition = useRef({ x: 0, y: 0 });
  const startedAt = useRef(0);
  const directionRef = useRef<"LEFT" | "RIGHT" | null>(null);
  const cancelledRef = useRef(false);
  const submissionStateRef = useRef<SwipeSubmissionState>({ submitted: false });
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accessibilityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accessibilitySubmittingRef = useRef(false);
  const activeRef = useRef(active);
  const reducedMotionRef = useRef(reducedMotion);
  const onActionRef = useRef(onAction);
  const finishGestureRef = useRef<(dx: number, dy: number, cancelled: boolean) => void>(() => {});
  const cancelGestureRef = useRef<() => void>(() => {});

  activeRef.current = active;
  reducedMotionRef.current = reducedMotion;
  onActionRef.current = onAction;

  const clearFeedbackTimer = () => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = null;
  };

  const clearAccessibilityTimer = () => {
    if (accessibilityTimer.current) clearTimeout(accessibilityTimer.current);
    accessibilityTimer.current = null;
  };

  const centerIndicator = () => {
    indicatorX.stopAnimation();
    Animated.timing(indicatorX, {
      toValue: 0,
      duration: reducedMotionRef.current ? 70 : 160,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const showFeedback = (value: Feedback, successful: boolean) => {
    clearFeedbackTimer();
    setFeedback(value);
    feedbackFlash.stopAnimation();
    feedbackFlash.setValue(1);
    Animated.timing(feedbackFlash, {
      toValue: 0,
      duration: reducedMotionRef.current ? 120 : 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    feedbackTimer.current = setTimeout(() => {
      setFeedback(null);
      feedbackTimer.current = null;
    }, SWIPE_CONFIG.feedbackDurationMs);
    if (!successful) centerIndicator();
  };

  finishGestureRef.current = (dx, dy, cancelled) => {
    if (!claimSwipeSubmission(submissionStateRef.current)) return;
    setSwiping(false);
    const duration = startedAt.current ? Date.now() - startedAt.current : 0;
    const result = validateSwipe({
      active: activeRef.current,
      cancelled: cancelled || cancelledRef.current,
      dx,
      dy,
      duration,
    });
    directionRef.current = result.direction;
    const acceptedSequence = result.valid ? onActionRef.current() : null;
    const successful = result.valid && acceptedSequence !== null;
    showFeedback(successful ? "GOOD SWIPE!" : feedbackForReason(result.valid ? "INACTIVE" : result.reason), successful);
    centerIndicator();
  };

  cancelGestureRef.current = () => {
    claimSwipeSubmission(submissionStateRef.current);
    cancelledRef.current = true;
    startedAt.current = 0;
    directionRef.current = null;
    startPosition.current = { x: 0, y: 0 };
    endPosition.current = { x: 0, y: 0 };
    setSwiping(false);
    setFeedback(null);
    clearFeedbackTimer();
    indicatorX.stopAnimation();
    indicatorX.setValue(0);
    feedbackFlash.stopAnimation();
    feedbackFlash.setValue(0);
  };

  const performAccessibilityAction = () => {
    if (!activeRef.current || accessibilitySubmittingRef.current) return;
    accessibilitySubmittingRef.current = true;
    const acceptedSequence = onActionRef.current();
    if (acceptedSequence !== null) showFeedback("GOOD SWIPE!", true);
    clearAccessibilityTimer();
    accessibilityTimer.current = setTimeout(() => {
      accessibilitySubmittingRef.current = false;
      accessibilityTimer.current = null;
    }, SWIPE_CONFIG.feedbackDurationMs);
  };

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => activeRef.current,
    onMoveShouldSetPanResponder: () => activeRef.current,
    onPanResponderGrant: (event) => {
      clearFeedbackTimer();
      setFeedback(null);
      setSwiping(true);
      submissionStateRef.current.submitted = false;
      cancelledRef.current = false;
      directionRef.current = null;
      startedAt.current = Date.now();
      startPosition.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
      endPosition.current = startPosition.current;
      indicatorX.stopAnimation();
      indicatorX.setValue(0);
    },
    onPanResponderMove: (event, gestureState) => {
      endPosition.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
      const maxTravel = reducedMotionRef.current ? 32 : SWIPE_CONFIG.maxIndicatorTravelPx;
      indicatorX.setValue(Math.max(-maxTravel, Math.min(maxTravel, gestureState.dx)));
    },
    onPanResponderRelease: (_event, gestureState) => {
      finishGestureRef.current(gestureState.dx, gestureState.dy, false);
    },
    onPanResponderTerminate: (_event, gestureState) => {
      void gestureState;
      cancelGestureRef.current();
    },
    onPanResponderTerminationRequest: () => true,
  }), [indicatorX]);

  useEffect(() => {
    clearFeedbackTimer();
    clearAccessibilityTimer();
    submissionStateRef.current.submitted = false;
    accessibilitySubmittingRef.current = false;
    cancelledRef.current = false;
    startedAt.current = 0;
    directionRef.current = null;
    startPosition.current = { x: 0, y: 0 };
    endPosition.current = { x: 0, y: 0 };
    setSwiping(false);
    setFeedback(null);
    indicatorX.stopAnimation();
    indicatorX.setValue(0);
    feedbackFlash.stopAnimation();
    feedbackFlash.setValue(0);
    return () => {
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
      if (accessibilityTimer.current) clearTimeout(accessibilityTimer.current);
      indicatorX.stopAnimation();
      feedbackFlash.stopAnimation();
    };
  }, [active, feedbackFlash, indicatorX, resetKey]);

  const successful = feedback === "GOOD SWIPE!";
  const statusLabel = feedback ?? (swiping ? "KEEP SWIPING" : active ? "SWIPE!" : "WAITING");

  return (
    <View
      accessibilityActions={[{ name: "activate", label: "Take a bite" }]}
      accessibilityHint="Swipe left or right across the control to take a bite."
      accessibilityLabel={active ? "Swipe bite control" : "Swipe bite control, unavailable until gameplay starts"}
      accessibilityRole="button"
      accessibilityState={{ disabled: !active }}
      accessible
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "activate") performAccessibilityAction();
      }}
      onAccessibilityTap={performAccessibilityAction}
      style={styles.touchTarget}
      {...panResponder.panHandlers}
    >
      <Animated.View pointerEvents="none" style={[styles.feedbackGlow, successful ? styles.successGlow : styles.failureGlow, {
        opacity: feedbackFlash,
        transform: [{ scaleX: feedbackFlash.interpolate({ inputRange: [0, 1], outputRange: [1, reducedMotion ? 1 : successful ? 1.06 : 1.015] }) }],
      }]} />
      <View style={[
        styles.pad,
        combo >= 5 && styles.comboPad,
        swiping && styles.swipingPad,
        successful && styles.successPad,
        heatTier === "CRITICAL" || heatTier === "OVERHEATED" ? styles.criticalPad : null,
        overheatWarningActive && styles.warningPad,
        !active && styles.disabledPad,
      ]}>
        <View pointerEvents="none" style={styles.padInset}>
          <Text maxFontSizeMultiplier={1.25} numberOfLines={1} style={styles.title}>{statusLabel}</Text>
          <View style={styles.indicatorTrack}>
            <View style={styles.centerMark} />
            <Animated.View style={[styles.indicator, { transform: [{ translateX: indicatorX }] }]} />
          </View>
          <Text maxFontSizeMultiplier={1.35} numberOfLines={1} style={styles.subtitle}>{swiping ? "KEEP IT HORIZONTAL" : feedback ? (successful ? "BITE ACCEPTED" : "TRY AGAIN") : "SWIPE LEFT OR RIGHT"}</Text>
        </View>
      </View>
    </View>
  );
}

export default memo(SwipeActionControl);

const styles = StyleSheet.create({
  touchTarget: { alignItems: "center", height: 82, justifyContent: "center", maxWidth: 520, width: "78%" },
  feedbackGlow: { borderRadius: 24, bottom: 0, left: -6, position: "absolute", right: -6, top: 0 },
  successGlow: { backgroundColor: "rgba(255,208,76,0.48)" },
  failureGlow: { backgroundColor: "rgba(255,82,48,0.28)" },
  pad: { backgroundColor: "#24100B", borderColor: "#F09A37", borderRadius: 22, borderWidth: 3, elevation: 8, height: 76, justifyContent: "center", overflow: "hidden", shadowColor: "#FF6A21", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 12, width: "100%" },
  padInset: { alignItems: "center", backgroundColor: "#873017", borderColor: "#FFB04B", borderRadius: 17, borderWidth: 2, bottom: 6, justifyContent: "center", left: 6, paddingHorizontal: 16, position: "absolute", right: 6, top: 6 },
  comboPad: { borderColor: "#FFC75A" },
  swipingPad: { borderColor: "#FFD264", shadowOpacity: 0.72 },
  successPad: { borderColor: "#FFE48A" },
  criticalPad: { borderColor: "#FF663D" },
  warningPad: { borderColor: "#FF8B53", shadowOpacity: 0.38 },
  disabledPad: { opacity: 0.42, shadowOpacity: 0 },
  title: { color: "#FFF4D7", fontSize: 17, fontWeight: "900", letterSpacing: 1.1, lineHeight: 20 },
  indicatorTrack: { alignItems: "center", backgroundColor: "rgba(36,10,7,0.72)", borderColor: "rgba(255,221,154,0.38)", borderRadius: 5, borderWidth: 1, height: 10, justifyContent: "center", marginTop: 2, overflow: "hidden", width: "100%" },
  centerMark: { backgroundColor: "rgba(255,240,198,0.45)", bottom: 0, position: "absolute", top: 0, width: 2 },
  indicator: { backgroundColor: "#FFE58C", borderRadius: 5, height: 8, width: 28 },
  subtitle: { color: "#FFD18A", fontSize: 7, fontWeight: "900", letterSpacing: 0.8, marginTop: 2 },
});
