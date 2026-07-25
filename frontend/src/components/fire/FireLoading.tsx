
import React, { useEffect, useRef } from "react";
import { ActivityIndicator, Animated, Easing, StyleSheet, Text, View } from "react-native";
import { useReducedMotionPreference } from "./FireProgressBar";

type FireLoadingProps = {
  title?: string;
  subtitle?: string;
};

export default function FireLoading({
  title = "Loading...",
  subtitle = "Preparing your feast",
}: FireLoadingProps) {
  const pulse = useRef(new Animated.Value(0)).current;
  const reducedMotion = useReducedMotionPreference();
  useEffect(() => {
    pulse.stopAnimation();
    pulse.setValue(0);
    if (reducedMotion) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [pulse, reducedMotion]);
  return (
    <View accessibilityLabel={`${title}. ${subtitle}`} accessibilityLiveRegion="polite" accessibilityRole="progressbar" accessibilityState={{ busy: true }} style={styles.container}>
      <Animated.View style={[styles.loaderStage, { transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] }) }] }]}>
        <Animated.View pointerEvents="none" style={[styles.loaderGlow, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.48] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1.18] }) }] }]} />
        <View pointerEvents="none" style={styles.loaderRing} />
        <ActivityIndicator accessible={false} size="large" color="#FF9D32" />
      </Animated.View>

      <Text style={styles.title}>{title}</Text>

      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 220,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  title: {
    marginTop: 14,
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
  },
  subtitle: {
    marginTop: 8,
    color: "#A9A9A9",
    fontSize: 14,
    textAlign: "center",
  },
  loaderStage: { alignItems: "center", height: 74, justifyContent: "center", width: 74 },
  loaderGlow: { backgroundColor: "rgba(255,91,20,0.35)", borderRadius: 40, height: 72, position: "absolute", width: 72 },
  loaderRing: { borderColor: "rgba(255,190,83,0.52)", borderRadius: 28, borderWidth: 1, height: 56, position: "absolute", width: 56 },
});
