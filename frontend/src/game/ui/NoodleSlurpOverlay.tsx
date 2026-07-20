import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { useSwipeCompletion, type SwipeCompletionResult } from "./useSwipeCompletion";

type Props = {
  reducedMotion: boolean;
  onComplete: (result: SwipeCompletionResult) => void;
};

const SWIPE_DISTANCE = 36;
const AUTO_RESUME_MS = 900;

export default function NoodleSlurpOverlay({ reducedMotion, onComplete }: Props) {
  const stretch = useRef(new Animated.Value(1)).current;
  const drift = useRef(new Animated.Value(0)).current;
  const steam = useRef(new Animated.Value(reducedMotion ? 0.45 : 0.25)).current;
  const swipeHandlers = useSwipeCompletion({
    direction: "down",
    minDistance: SWIPE_DISTANCE,
    timeoutMs: AUTO_RESUME_MS,
    onComplete,
  });

  useEffect(() => {
    if (reducedMotion) {
      stretch.setValue(1);
      drift.setValue(0);
      steam.setValue(0.45);
      return;
    }

    const animation = Animated.loop(Animated.sequence([
      Animated.parallel([
        Animated.timing(stretch, { toValue: 1.2, duration: 190, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(drift, { toValue: 9, duration: 190, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(steam, { toValue: 0.68, duration: 190, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(stretch, { toValue: 1, duration: 190, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration: 190, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(steam, { toValue: 0.25, duration: 190, useNativeDriver: true }),
      ]),
    ]));
    animation.start();
    return () => animation.stop();
  }, [drift, reducedMotion, steam, stretch]);

  return (
    <View
      accessible
      accessibilityLabel="Noodle slurp. Swipe down."
      style={styles.overlay}
      {...swipeHandlers}
    >
      <Animated.View pointerEvents="none" style={[styles.steamGlow, { opacity: steam }]} />
      <Animated.View
        pointerEvents="none"
        style={[styles.noodles, { transform: [{ translateY: drift }, { scaleY: stretch }] }]}
      >
        <View style={[styles.noodle, styles.noodleLeft]} />
        <View style={styles.noodleCenter} />
        <View style={[styles.noodle, styles.noodleRight]} />
      </Animated.View>
      <View pointerEvents="none" style={styles.hint}>
        <Text style={styles.title}>SLURP!</Text>
        <Text style={styles.arrow}>SWIPE DOWN ↓</Text>
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
  steamGlow: {
    backgroundColor: "#FFE0A3",
    borderRadius: 999,
    height: 110,
    position: "absolute",
    width: 150,
  },
  noodles: {
    flexDirection: "row",
    height: 78,
    justifyContent: "center",
    width: 84,
  },
  noodle: {
    backgroundColor: "#FFD46A",
    borderColor: "#F3A83A",
    borderRadius: 999,
    borderWidth: 1,
    height: 66,
    width: 7,
  },
  noodleLeft: {
    marginRight: 12,
  },
  noodleCenter: {
    backgroundColor: "#FFE38A",
    borderColor: "#F3A83A",
    borderRadius: 999,
    borderWidth: 1,
    height: 78,
    width: 7,
  },
  noodleRight: {
    marginLeft: 12,
  },
  hint: {
    alignItems: "center",
    backgroundColor: "rgba(31,18,7,0.88)",
    borderColor: "rgba(255,210,116,0.78)",
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 10,
    paddingHorizontal: 18,
    paddingVertical: 7,
  },
  title: {
    color: "#FFF2C8",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 1.3,
  },
  arrow: {
    color: "#FFD46A",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginTop: 2,
  },
});
