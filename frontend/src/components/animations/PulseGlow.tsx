import React from "react";
import { Animated, StyleSheet, type ViewStyle } from "react-native";
import { usePulse } from "../../animations/usePulse";

export type PulseGlowProps = {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  enabled?: boolean;
};

export default function PulseGlow({ children, style, enabled = true }: PulseGlowProps) {
  const { pulse, animatedStyle } = usePulse({ enabled });

  return (
    <Animated.View style={[style, animatedStyle, { transform: [{ scale: pulse }] }]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: "flex-start",
  },
});
