import React from "react";
import { Animated, StyleSheet, View } from "react-native";
import { useScalePop } from "../../animations/useScalePop";

export type FireBurstProps = {
  color?: string;
  size?: number;
  enabled?: boolean;
};

export default function FireBurst({ color = "#FF7A1A", size = 40, enabled = true }: FireBurstProps) {
  const { scale, animatedStyle } = useScalePop({ enabled, duration: 220, from: 0.2, to: 1.05 });

  return (
    <Animated.View style={[styles.wrapper, animatedStyle, { transform: [{ scale }] }] }>
      <View style={[styles.burst, { width: size, height: size, backgroundColor: color }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  burst: {
    borderRadius: 999,
    opacity: 0.9,
  },
});
