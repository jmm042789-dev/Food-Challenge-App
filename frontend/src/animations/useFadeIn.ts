import { useCallback, useEffect, useRef } from "react";
import { Animated, Easing, type ViewStyle } from "react-native";

export type UseFadeInOptions = {
  duration?: number;
  delay?: number;
  from?: number;
  to?: number;
  useNativeDriver?: boolean;
  enabled?: boolean;
  easing?: (value: number) => number;
};

export function useFadeIn(options: UseFadeInOptions = {}) {
  const {
    duration = 350,
    delay = 0,
    from = 0,
    to = 1,
    useNativeDriver = true,
    enabled = true,
    easing = Easing.out(Easing.cubic),
  } = options;

  const opacity = useRef(new Animated.Value(from)).current;

  const start = useCallback(() => {
    if (!enabled) {
      opacity.setValue(to);
      return;
    }

    opacity.setValue(from);

    Animated.timing(opacity, {
      toValue: to,
      duration,
      delay,
      easing,
      useNativeDriver,
    }).start();
  }, [delay, duration, easing, enabled, from, opacity, to, useNativeDriver]);

  useEffect(() => {
    start();
  }, [start]);

  return {
    opacity,
    start,
    animatedStyle: { opacity } as ViewStyle,
  };
}
