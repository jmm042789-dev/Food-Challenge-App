import React from "react";
import { Animated, Pressable, StyleSheet, type ViewStyle } from "react-native";
import { useScalePop } from "../../animations/useScalePop";

export type AnimatedButtonProps = {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  onPress?: () => void;
  enabled?: boolean;
};

export default function AnimatedButton({
  children,
  style,
  onPress,
  enabled = true,
}: AnimatedButtonProps) {
  const { scale, animatedStyle } = useScalePop({ enabled });

  return (
    <Pressable onPress={onPress} style={styles.pressable}>
      <Animated.View style={[style, animatedStyle, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    alignSelf: "flex-start",
  },
});
