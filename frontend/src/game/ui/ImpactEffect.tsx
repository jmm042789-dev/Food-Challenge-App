import React, { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, View } from "react-native";

type Variant = "bite" | "combo" | "completion" | "warning";
type Props = { trigger: number; variant?: Variant; size?: number };

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

  useEffect(() => {
    if (trigger <= 0) return;
    opacity.stopAnimation();
    scale.stopAnimation();
    translateY.stopAnimation();
    opacity.setValue(0.9);
    scale.setValue(0.45);
    translateY.setValue(6);

    const animation = Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: variant === "combo" ? 360 : 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(scale, { toValue: variant === "combo" ? 1.35 : 1.1, duration: variant === "combo" ? 360 : 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -8, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [opacity, scale, translateY, trigger, variant]);

  if (trigger <= 0) return null;
  return (
    <View pointerEvents="none" style={styles.layer}>
      <Animated.View style={{ opacity, transform: [{ translateY }, { scale }] }}>
        <Image source={sources[variant]} resizeMode="contain" style={{ height: size, width: size }} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", zIndex: 4 },
});
