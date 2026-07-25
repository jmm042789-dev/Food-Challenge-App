import React, { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, View } from "react-native";

type Variant = "bite" | "combo" | "completion" | "warning";
type Props = { trigger: number; variant?: Variant; size?: number };

const PARTICLES = [
  { x: -0.46, y: -0.18, size: 4 },
  { x: -0.3, y: -0.42, size: 3 },
  { x: -0.06, y: -0.5, size: 4 },
  { x: 0.22, y: -0.44, size: 3 },
  { x: 0.44, y: -0.22, size: 4 },
  { x: 0.38, y: 0.04, size: 3 },
  { x: -0.38, y: 0.08, size: 3 },
] as const;

const sources = {
  bite: require("../../assets/ui/animations/button-click-ring.png"),
  combo: require("../../assets/ui/effects/combo-explosion.png"),
  completion: require("../../assets/ui/effects/sparkle.png"),
  warning: require("../../assets/ui/effects/fire-burst.png"),
};

/** Fixed-cost, one-shot impact art. A changed trigger restarts the same native-driven values. */
export default function ImpactEffect({ trigger, variant = "bite", size = 96 }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.45)).current;
  const translateY = useRef(new Animated.Value(6)).current;
  const particleProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (trigger <= 0) return;
    opacity.stopAnimation();
    scale.stopAnimation();
    translateY.stopAnimation();
    particleProgress.stopAnimation();
    opacity.setValue(0.9);
    scale.setValue(0.45);
    translateY.setValue(6);
    particleProgress.setValue(0);

    const animation = Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: variant === "combo" ? 360 : 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(scale, { toValue: variant === "combo" ? 1.35 : 1.1, duration: variant === "combo" ? 360 : 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -8, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(particleProgress, {
        toValue: 1,
        duration: variant === "combo" ? 440 : 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [opacity, particleProgress, scale, translateY, trigger, variant]);

  if (trigger <= 0) return null;
  return (
    <View pointerEvents="none" style={styles.layer}>
      <Animated.View style={{ opacity, transform: [{ translateY }, { scale }] }}>
        <Image source={sources[variant]} resizeMode="contain" style={{ height: size, width: size }} />
      </Animated.View>
      {PARTICLES.slice(0, variant === "combo" || variant === "warning" ? 7 : 5).map((particle, index) => (
        <Animated.View
          key={index}
          style={[
            styles.particle,
            variant === "completion" && styles.coolParticle,
            {
              height: particle.size + (variant === "combo" ? 2 : 0),
              opacity: particleProgress.interpolate({
                inputRange: [0, 0.12, 0.72, 1],
                outputRange: [0, 0.92, 0.5, 0],
              }),
              transform: [
                { translateX: particleProgress.interpolate({ inputRange: [0, 1], outputRange: [0, particle.x * size] }) },
                { translateY: particleProgress.interpolate({ inputRange: [0, 1], outputRange: [0, particle.y * size] }) },
                { rotate: `${index * 23}deg` },
                { scale: particleProgress.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0.45, 1.15, 0.7] }) },
              ],
              width: particle.size + (variant === "combo" ? 2 : 0),
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", zIndex: 4 },
  particle: { backgroundColor: "#FFB13B", borderRadius: 4, position: "absolute", shadowColor: "#FF6A00", shadowOpacity: 0.8, shadowRadius: 4 },
  coolParticle: { backgroundColor: "#C8FAFF", shadowColor: "#62DFF2" },
});
