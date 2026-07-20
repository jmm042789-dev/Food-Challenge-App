import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

export type HotDogSpeedSprintHandle = {
  start: (initialTapCount?: number) => boolean;
  registerTap: () => void;
  reset: () => void;
};

type Props = {
  active: boolean;
  durationMs?: number;
  reducedMotion: boolean;
  resetKey: string;
  tapTarget?: number;
  onSuccess?: () => void;
};

type SprintPhase = "idle" | "active" | "success";

const clampDuration = (duration?: number): number =>
  Math.round(Math.min(2200, Math.max(1000, duration ?? 1500)));

const resolveTapTarget = (target: number | undefined, duration: number): number =>
  Math.round(Math.min(10, Math.max(4, target ?? Math.round(duration / 250))));

const HotDogSpeedSprintOverlay = forwardRef<HotDogSpeedSprintHandle, Props>(function HotDogSpeedSprintOverlay(
  { active, durationMs, reducedMotion, resetKey, tapTarget, onSuccess },
  ref,
) {
  const duration = clampDuration(durationMs);
  const target = resolveTapTarget(tapTarget, duration);
  const [phase, setPhase] = useState<SprintPhase>("idle");
  const [tapCount, setTapCount] = useState(0);
  const phaseRef = useRef<SprintPhase>("idle");
  const tapCountRef = useRef(0);
  const mounted = useRef(true);
  const sprintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeProgress = useRef(new Animated.Value(1)).current;
  const speedPulse = useRef(new Animated.Value(0)).current;

  const clearTimers = () => {
    if (sprintTimer.current) clearTimeout(sprintTimer.current);
    if (successTimer.current) clearTimeout(successTimer.current);
    sprintTimer.current = null;
    successTimer.current = null;
  };

  const resetSprint = () => {
    clearTimers();
    timeProgress.stopAnimation();
    speedPulse.stopAnimation();
    timeProgress.setValue(1);
    speedPulse.setValue(0);
    phaseRef.current = "idle";
    tapCountRef.current = 0;
    if (mounted.current) {
      setPhase("idle");
      setTapCount(0);
    }
  };

  const finishSuccess = () => {
    if (phaseRef.current !== "active") return;
    if (sprintTimer.current) clearTimeout(sprintTimer.current);
    sprintTimer.current = null;
    timeProgress.stopAnimation();
    phaseRef.current = "success";
    setPhase("success");
    onSuccess?.();
    successTimer.current = setTimeout(() => {
      if (mounted.current) resetSprint();
    }, 420);
  };

  const registerTap = () => {
    if (phaseRef.current !== "active") return;
    const nextCount = Math.min(target, tapCountRef.current + 1);
    tapCountRef.current = nextCount;
    setTapCount(nextCount);
    if (nextCount >= target) finishSuccess();
  };

  useImperativeHandle(ref, () => ({
    start: (initialTapCount = 0) => {
      if (!active || phaseRef.current !== "idle") return false;
      clearTimers();
      const initialCount = Math.min(target, Math.max(0, Math.round(initialTapCount)));
      phaseRef.current = "active";
      tapCountRef.current = initialCount;
      setPhase("active");
      setTapCount(initialCount);
      timeProgress.setValue(1);
      Animated.timing(timeProgress, {
        toValue: 0,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start();
      sprintTimer.current = setTimeout(() => {
        if (mounted.current && phaseRef.current === "active") resetSprint();
      }, duration);
      if (initialCount >= target) finishSuccess();
      return true;
    },
    registerTap,
    reset: resetSprint,
  }));

  useEffect(() => {
    if (phase !== "active" || reducedMotion) {
      speedPulse.stopAnimation();
      speedPulse.setValue(0);
      return;
    }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(speedPulse, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.timing(speedPulse, { toValue: 0, duration: 120, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [phase, reducedMotion, speedPulse]);

  useEffect(() => {
    resetSprint();
  }, [active, resetKey]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimers();
      timeProgress.stopAnimation();
      speedPulse.stopAnimation();
    };
  }, [speedPulse, timeProgress]);

  if (phase === "idle") return null;

  return (
    <View pointerEvents="none" style={[styles.overlay, phase === "success" && styles.overlaySuccess]}>
      {!reducedMotion && phase === "active" ? (
        <Animated.View
          style={[
            styles.speedLines,
            {
              opacity: speedPulse.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.5] }),
              transform: [{ scaleX: speedPulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.08] }) }],
            },
          ]}
        />
      ) : null}
      <Text style={styles.title}>{phase === "success" ? "SPEED BONUS!" : "SPEED SPRINT!"}</Text>
      <Text style={styles.subtitle}>{phase === "success" ? "NICE!" : "TAP FAST!"}</Text>
      <Text style={styles.progressText}>{Math.min(tapCount, target)} / {target}</Text>
      <View style={styles.timerTrack}>
        <Animated.View
          style={[
            styles.timerFill,
            phase === "success" && styles.timerFillSuccess,
            { transform: [{ scaleX: phase === "success" ? 1 : timeProgress }] },
          ]}
        />
      </View>
    </View>
  );
});

export default HotDogSpeedSprintOverlay;

const styles = StyleSheet.create({
  overlay: {
    alignItems: "center",
    backgroundColor: "rgba(39,13,5,0.84)",
    borderColor: "rgba(255,126,40,0.78)",
    borderRadius: 13,
    borderWidth: 1,
    left: "20%",
    paddingHorizontal: 14,
    paddingVertical: 8,
    position: "absolute",
    right: "20%",
    top: "8%",
    zIndex: 19,
  },
  overlaySuccess: {
    backgroundColor: "rgba(62,35,5,0.9)",
    borderColor: "#FFD45C",
  },
  speedLines: {
    backgroundColor: "rgba(255,108,30,0.28)",
    borderColor: "rgba(255,195,78,0.5)",
    borderRadius: 999,
    borderWidth: 1,
    height: 42,
    position: "absolute",
    top: 12,
    width: "125%",
  },
  title: {
    color: "#FFF0C5",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  subtitle: {
    color: "#FF9A42",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.4,
    marginTop: 1,
  },
  progressText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 3,
  },
  timerTrack: {
    backgroundColor: "rgba(12,5,3,0.78)",
    borderRadius: 999,
    height: 6,
    marginTop: 5,
    overflow: "hidden",
    width: 142,
  },
  timerFill: {
    backgroundColor: "#FF6A24",
    borderRadius: 999,
    height: "100%",
    width: "100%",
  },
  timerFillSuccess: {
    backgroundColor: "#FFD45C",
  },
});
