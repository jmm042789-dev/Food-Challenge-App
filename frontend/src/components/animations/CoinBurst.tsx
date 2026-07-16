import React from "react";
import { Animated, StyleSheet, Text } from "react-native";
import { useSlideUp } from "../../animations/useSlideUp";
import { useFadeIn } from "../../animations/useFadeIn";

export type CoinBurstProps = {
  label?: string;
  enabled?: boolean;
};

export default function CoinBurst({ label = "+1", enabled = true }: CoinBurstProps) {
  const { translateY, animatedStyle: slideStyle } = useSlideUp({ enabled, duration: 480, offset: 8 });
  const { opacity, animatedStyle: fadeStyle } = useFadeIn({ enabled, duration: 480 });

  return (
    <Animated.View style={[styles.token, slideStyle, fadeStyle, { transform: [{ translateY }] }]}>
      <Text style={styles.label}>{label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  token: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#FFD54A",
  },
  label: {
    color: "#111827",
    fontWeight: "800",
  },
});
