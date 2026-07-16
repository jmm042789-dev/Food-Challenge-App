import React from "react";
import { Animated, StyleSheet, View, type ViewStyle } from "react-native";
import { useFloating } from "../../animations/useFloating";

export type FloatingCardProps = {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  amplitude?: number;
  duration?: number;
  enabled?: boolean;
};

export default function FloatingCard({
  children,
  style,
  amplitude = 8,
  duration = 1400,
  enabled = true,
}: FloatingCardProps) {
  const { translateY, animatedStyle } = useFloating({
    amplitude,
    duration,
    enabled,
  });

  return (
    <Animated.View style={[styles.base, style, animatedStyle, { transform: [{ translateY }] }] }>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: "flex-start",
  },
});
