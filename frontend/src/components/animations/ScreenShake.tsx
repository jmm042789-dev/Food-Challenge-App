import React from "react";
import { Animated, StyleSheet, type ViewStyle } from "react-native";
import { useScreenShake } from "../../animations/useScreenShake";

export type ScreenShakeProps = {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  enabled?: boolean;
};

export default function ScreenShake({ children, style, enabled = true }: ScreenShakeProps) {
  const { translateX, animatedStyle } = useScreenShake({ enabled });

  return (
    <Animated.View style={[style, animatedStyle, { transform: [{ translateX }] }]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
