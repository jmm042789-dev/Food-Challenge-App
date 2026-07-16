import React from "react";
import { Animated, StyleSheet, View, type ViewStyle } from "react-native";
import { usePulse } from "../../animations";

export type ArenaMeterProps = {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  active?: boolean;
};

export default function ArenaMeter({ children, style, active = false }: ArenaMeterProps) {
  const pulse = usePulse({ enabled: active, min: 0.97, max: 1.03, duration: 900 });

  return (
    <Animated.View style={[style, { transform: [{ scale: pulse.pulse }] }]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: "flex-start",
  },
});
