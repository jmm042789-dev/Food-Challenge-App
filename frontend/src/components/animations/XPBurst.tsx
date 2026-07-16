import React from "react";
import { Animated, StyleSheet, Text } from "react-native";
import { useSlideUp } from "../../animations/useSlideUp";
import { useFadeIn } from "../../animations/useFadeIn";

export type XPBurstProps = {
  label?: string;
  enabled?: boolean;
};

export default function XPBurst({ label = "+50 XP", enabled = true }: XPBurstProps) {
  const { translateY, animatedStyle: slideStyle } = useSlideUp({ enabled, duration: 520, offset: 10 });
  const { opacity, animatedStyle: fadeStyle } = useFadeIn({ enabled, duration: 520 });

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
    backgroundColor: "#4F46E5",
  },
  label: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
});
