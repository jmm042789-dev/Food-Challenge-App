import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, type ViewStyle } from "react-native";
import { useFadeIn, useScalePop } from "../../animations";

export type FlyingBurstProps = {
  children: React.ReactNode;
  offsetX?: number;
  offsetY?: number;
  delay?: number;
  enabled?: boolean;
  style?: ViewStyle | ViewStyle[];
};

export default function FlyingBurst({
  children,
  offsetX = 0,
  offsetY = -180,
  delay = 0,
  enabled = true,
  style,
}: FlyingBurstProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const { opacity } = useFadeIn({ enabled, duration: 260, delay });
  const { scale, start: popStart } = useScalePop({ enabled, duration: 260, from: 0.72, to: 1, autoStart: false });

  useEffect(() => {
    if (!enabled) return;

    popStart();

    Animated.parallel([
      Animated.timing(translateX, {
        toValue: offsetX,
        duration: 650,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: offsetY,
        duration: 650,
        delay,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, enabled, offsetX, offsetY, popStart, translateX, translateY]);

  return (
    <Animated.View
      style={[
        styles.container,
        style,
        {
          opacity,
          transform: [
            { translateX },
            { translateY },
            { scale },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
});
