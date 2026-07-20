import React, { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  holdDurationMs?: number;
  reducedMotion: boolean;
  onComplete: () => void;
};

const clampDuration = (duration?: number): number =>
  Math.round(Math.min(700, Math.max(250, duration ?? 450)));

export default function BurgerHeavyBiteOverlay({ holdDurationMs, reducedMotion, onComplete }: Props) {
  const progress = useRef(new Animated.Value(0)).current;
  const pressure = useRef(new Animated.Value(0)).current;
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holding = useRef(false);
  const completed = useRef(false);
  const duration = clampDuration(holdDurationMs);

  const clearHoldTimer = () => {
    if (!holdTimer.current) return;
    clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };

  const cancelHold = () => {
    if (completed.current) return;
    holding.current = false;
    clearHoldTimer();
    progress.stopAnimation();
    pressure.stopAnimation();
    progress.setValue(0);
    pressure.setValue(0);
  };

  const startHold = () => {
    if (holding.current || completed.current) return;
    holding.current = true;
    progress.setValue(0);
    pressure.setValue(0);

    Animated.timing(progress, {
      toValue: 1,
      duration,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();

    if (!reducedMotion) {
      Animated.timing(pressure, {
        toValue: 1,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }

    holdTimer.current = setTimeout(() => {
      if (!holding.current || completed.current) return;
      completed.current = true;
      holding.current = false;
      holdTimer.current = null;
      onComplete();
    }, duration);
  };

  useEffect(() => () => {
    clearHoldTimer();
    progress.stopAnimation();
    pressure.stopAnimation();
  }, [pressure, progress]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Heavy bite. Hold for ${duration} milliseconds.`}
      onPressIn={startHold}
      onPressOut={cancelHold}
      style={styles.overlay}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.pressureGlow,
          {
            opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.72] }),
            transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1.08] }) }],
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.holdRing,
          {
            opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.38, 1] }),
            transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }) }],
          },
        ]}
      >
        <View style={styles.ringCenter} />
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.prompt,
          {
            transform: reducedMotion
              ? []
              : [
                  { translateY: pressure.interpolate({ inputRange: [0, 1], outputRange: [0, 6] }) },
                  { scale: pressure.interpolate({ inputRange: [0, 1], outputRange: [1, 0.96] }) },
                ],
          },
        ]}
      >
        <Text style={styles.title}>HEAVY BITE!</Text>
        <Text style={styles.holdText}>HOLD!</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 30,
  },
  pressureGlow: {
    backgroundColor: "#FF8A32",
    borderRadius: 999,
    height: 150,
    position: "absolute",
    width: 150,
  },
  holdRing: {
    alignItems: "center",
    borderColor: "#FFD071",
    borderRadius: 999,
    borderWidth: 7,
    height: 132,
    justifyContent: "center",
    position: "absolute",
    width: 132,
  },
  ringCenter: {
    backgroundColor: "rgba(69,24,7,0.7)",
    borderRadius: 999,
    height: 102,
    width: 102,
  },
  prompt: {
    alignItems: "center",
    backgroundColor: "rgba(34,13,5,0.9)",
    borderColor: "rgba(255,190,85,0.86)",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  title: {
    color: "#FFF1C4",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  holdText: {
    color: "#FFB34D",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.8,
    marginTop: 2,
  },
});
