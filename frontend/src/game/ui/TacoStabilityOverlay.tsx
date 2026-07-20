import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

export type TacoStabilityHandle = {
  registerTap: (biteCount: number) => void;
};

type Props = {
  active: boolean;
  reducedMotion: boolean;
  resetKey: string;
  triggerEveryBites: number;
  onStabilityChange: (stability: number) => void;
  onChallengeCompleted?: () => void;
};

const clampStability = (value: number): number => Math.min(1, Math.max(0, value));
const CHALLENGE_MS = 1200;
const TICK_MS = 100;
const INACTIVITY_GRACE_MS = 320;
const NORMAL_DRAIN_PER_SECOND = 0.055;
const CHALLENGE_DRAIN_PER_SECOND = 0.32;
const NORMAL_TAP_RESTORE = 0.1;
const CHALLENGE_TAP_RESTORE = 0.16;

const TacoStabilityOverlay = forwardRef<TacoStabilityHandle, Props>(function TacoStabilityOverlay(
  { active, reducedMotion, resetKey, triggerEveryBites, onStabilityChange, onChallengeCompleted },
  ref,
) {
  const [stability, setStability] = useState(1);
  const [challengeActive, setChallengeActive] = useState(false);
  const [crackTrigger, setCrackTrigger] = useState(0);
  const stabilityRef = useRef(1);
  const challengeRef = useRef(false);
  const challengeEndsAt = useRef(0);
  const lastTapAt = useRef(Date.now());
  const lastTickAt = useRef(Date.now());
  const crackLocked = useRef(false);
  const tickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const crackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const crackOpacity = useRef(new Animated.Value(0)).current;
  const crackScale = useRef(new Animated.Value(1)).current;

  const updateStability = useCallback((value: number) => {
    const next = clampStability(value);
    stabilityRef.current = next;
    setStability(next);
    onStabilityChange(next);
  }, [onStabilityChange]);

  useImperativeHandle(ref, () => ({
    registerTap: (biteCount: number) => {
      const now = Date.now();
      lastTapAt.current = now;
      updateStability(stabilityRef.current + (challengeRef.current ? CHALLENGE_TAP_RESTORE : NORMAL_TAP_RESTORE));

      if (biteCount > 0 && biteCount % Math.max(1, triggerEveryBites) === 0) {
        challengeRef.current = true;
        challengeEndsAt.current = now + CHALLENGE_MS;
        setChallengeActive(true);
      }
    },
  }), [triggerEveryBites, updateStability]);

  useEffect(() => {
    if (tickTimer.current) clearTimeout(tickTimer.current);
    if (crackTimer.current) clearTimeout(crackTimer.current);
    challengeRef.current = false;
    challengeEndsAt.current = 0;
    crackLocked.current = false;
    lastTapAt.current = Date.now();
    lastTickAt.current = Date.now();
    setChallengeActive(false);
    updateStability(1);

    if (!active) return;
    let mounted = true;

    const tick = () => {
      if (!mounted) return;
      const now = Date.now();
      const elapsedSeconds = Math.min(0.25, Math.max(0, now - lastTickAt.current) / 1000);
      lastTickAt.current = now;

      if (challengeRef.current && now >= challengeEndsAt.current) {
        challengeRef.current = false;
        setChallengeActive(false);
        onChallengeCompleted?.();
      }

      const inactive = now - lastTapAt.current >= INACTIVITY_GRACE_MS;
      const drainRate = challengeRef.current
        ? CHALLENGE_DRAIN_PER_SECOND
        : inactive
          ? NORMAL_DRAIN_PER_SECOND
          : 0;

      if (drainRate > 0) {
        const drained = stabilityRef.current - drainRate * elapsedSeconds;
        if (drained <= 0 && !crackLocked.current) {
          crackLocked.current = true;
          setCrackTrigger((value) => value + 1);
          updateStability(0.45);
          crackTimer.current = setTimeout(() => {
            if (mounted) crackLocked.current = false;
          }, 240);
        } else if (drained > 0) {
          updateStability(drained);
        }
      }

      tickTimer.current = setTimeout(tick, TICK_MS);
    };

    tickTimer.current = setTimeout(tick, TICK_MS);
    return () => {
      mounted = false;
      if (tickTimer.current) clearTimeout(tickTimer.current);
      if (crackTimer.current) clearTimeout(crackTimer.current);
    };
  }, [active, resetKey, updateStability]);

  useEffect(() => {
    if (crackTrigger <= 0) return;
    crackOpacity.stopAnimation();
    crackScale.stopAnimation();
    crackOpacity.setValue(1);
    crackScale.setValue(reducedMotion ? 1 : 0.9);

    if (reducedMotion) {
      const timeout = setTimeout(() => crackOpacity.setValue(0), 220);
      return () => clearTimeout(timeout);
    }

    const animation = Animated.parallel([
      Animated.timing(crackOpacity, { toValue: 0, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(crackScale, { toValue: 1.08, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [crackOpacity, crackScale, crackTrigger, reducedMotion]);

  useEffect(() => () => {
    crackOpacity.stopAnimation();
    crackScale.stopAnimation();
  }, [crackOpacity, crackScale]);

  const level = stability < 0.3 ? "danger" : stability < 0.65 ? "warning" : "stable";
  const meterColor = level === "danger" ? "#FF4A2E" : level === "warning" ? "#FFB13B" : "#7DDB72";

  return (
    <View pointerEvents="none" style={[styles.overlay, challengeActive && styles.overlayChallenge]}>
      {challengeActive ? <Text style={styles.challengeText}>KEEP TAPPING!</Text> : null}
      <View style={[styles.meterFrame, level === "danger" && styles.meterDanger]}>
        <View style={[styles.meterFill, { backgroundColor: meterColor, width: `${Math.round(stability * 100)}%` as `${number}%` }]} />
      </View>
      <Text style={[styles.label, level === "danger" && styles.labelDanger]}>SHELL STABILITY</Text>
      <Animated.View style={[styles.crack, { opacity: crackOpacity, transform: [{ scale: crackScale }] }]}>
        <Text style={styles.crackText}>CRACK!</Text>
      </Animated.View>
    </View>
  );
});

export default TacoStabilityOverlay;

const styles = StyleSheet.create({
  overlay: {
    alignItems: "center",
    left: "18%",
    position: "absolute",
    right: "18%",
    top: "9%",
    zIndex: 18,
  },
  overlayChallenge: {
    backgroundColor: "rgba(49,20,6,0.74)",
    borderColor: "rgba(255,177,59,0.7)",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  challengeText: {
    color: "#FFF0BB",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1.2,
    marginBottom: 5,
  },
  meterFrame: {
    backgroundColor: "rgba(20,9,5,0.82)",
    borderColor: "rgba(255,198,96,0.52)",
    borderRadius: 999,
    borderWidth: 1,
    height: 9,
    overflow: "hidden",
    width: 150,
  },
  meterDanger: {
    borderColor: "#FF5638",
    borderWidth: 2,
  },
  meterFill: {
    borderRadius: 999,
    height: "100%",
  },
  label: {
    color: "rgba(255,232,185,0.82)",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.1,
    marginTop: 3,
  },
  labelDanger: {
    color: "#FF856D",
  },
  crack: {
    alignItems: "center",
    backgroundColor: "rgba(48,12,5,0.86)",
    borderColor: "#FF684A",
    borderRadius: 999,
    borderWidth: 2,
    height: 58,
    justifyContent: "center",
    position: "absolute",
    top: 72,
    width: 90,
  },
  crackText: {
    color: "#FFE0AA",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
});
