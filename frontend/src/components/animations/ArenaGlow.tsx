import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, type ViewStyle } from "react-native";

export type ArenaGlowProps = {
  size?: number;
  color?: string;
  style?: ViewStyle | ViewStyle[];
};

export default function ArenaGlow({ size = 300, color = "#FF7A1A", style }: ArenaGlowProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.84)).current;

  useEffect(() => {
    opacity.setValue(0.56);
    scale.setValue(0.84);

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 680,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1.18,
        friction: 7,
        tension: 120,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, scale]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.glow,
        style,
        {
          width: size,
          height: size,
          borderColor: color,
          opacity,
          transform: [{ scale }],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  glow: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 3,
    backgroundColor: "rgba(255, 122, 26, 0.12)",
  },
});
