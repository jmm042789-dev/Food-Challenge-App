import React from "react";
import { Animated, StyleSheet, View, type ViewStyle } from "react-native";
import { useScreenFlash } from "../../animations/useScreenFlash";

export type ScreenFlashProps = {
  style?: ViewStyle | ViewStyle[];
  enabled?: boolean;
};

export default function ScreenFlash({ style, enabled = true }: ScreenFlashProps) {
  const { opacity, animatedStyle } = useScreenFlash({ enabled });

  return (
    <Animated.View style={[styles.overlay, style, animatedStyle, { opacity }]} />
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#FFFFFF",
    pointerEvents: "none",
  },
});
