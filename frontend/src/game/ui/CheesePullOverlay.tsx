import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { useSwipeCompletion, type SwipeCompletionResult } from "./useSwipeCompletion";

type Props = {
  reducedMotion: boolean;
  onComplete: (result: SwipeCompletionResult) => void;
};

const SWIPE_DISTANCE = 36;
const AUTO_RESUME_MS = 850;

export default function CheesePullOverlay({ reducedMotion, onComplete }: Props) {
  const stretch = useRef(new Animated.Value(1)).current;
  const drift = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(reducedMotion ? 0.55 : 0.35)).current;

  const swipeHandlers = useSwipeCompletion({
    direction: "any",
    minDistance: SWIPE_DISTANCE,
    timeoutMs: AUTO_RESUME_MS,
    onComplete,
  });

  useEffect(() => {
    if (reducedMotion) {
      stretch.setValue(1);
      drift.setValue(0);
      glow.setValue(0.55);
      return;
    }

    const animation = Animated.loop(Animated.sequence([
      Animated.parallel([
        Animated.timing(stretch, { toValue: 1.16, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(drift, { toValue: 8, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.72, duration: 180, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(stretch, { toValue: 1, duration: 180, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration: 180, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.35, duration: 180, useNativeDriver: true }),
      ]),
    ]));
    animation.start();
    return () => animation.stop();
  }, [drift, glow, reducedMotion, stretch]);

  return (
    <View
      accessible
      accessibilityLabel="Cheese pull. Swipe in any direction."
      style={styles.overlay}
      {...swipeHandlers}
    >
      <Animated.View pointerEvents="none" style={[styles.glow, { opacity: glow }]} />
      <Animated.View
        pointerEvents="none"
        style={[styles.ribbon, { transform: [{ translateX: drift }, { scaleX: stretch }] }]}
      />
      <View pointerEvents="none" style={styles.hint}>
        <Text style={styles.title}>CHEESE PULL!</Text>
        <Text style={styles.arrow}>SWIPE →</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 30,
  },
  glow: {
    backgroundColor: "#FFD45C",
    borderRadius: 999,
    height: 76,
    position: "absolute",
    width: 190,
  },
  ribbon: {
    backgroundColor: "#FFE28A",
    borderColor: "#FFB83E",
    borderRadius: 999,
    borderWidth: 2,
    height: 12,
    width: 128,
  },
  hint: {
    alignItems: "center",
    backgroundColor: "rgba(35,15,4,0.86)",
    borderColor: "rgba(255,205,91,0.8)",
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  title: {
    color: "#FFF3C2",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1,
  },
  arrow: {
    color: "#FFD45C",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginTop: 2,
  },
});
