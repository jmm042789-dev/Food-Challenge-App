import { useCallback, useEffect, useRef } from "react";
import { Animated, Easing, type ViewStyle } from "react-native";

export type UseScreenFlashOptions = {
  duration?: number;
  delay?: number;
  from?: number;
  to?: number;
  useNativeDriver?: boolean;
  enabled?: boolean;
};

export function useScreenFlash(options: UseScreenFlashOptions = {}) {
  const {
    duration = 220,
    delay = 0,
    from = 0,
    to = 0.24,
    useNativeDriver = true,
    enabled = true,
  } = options;

  const opacity = useRef(new Animated.Value(from)).current;

  const start = useCallback(() => {
    if (!enabled) {
      opacity.setValue(from);
      return;
    }

    opacity.setValue(from);

    Animated.sequence([
      Animated.timing(opacity, {
        toValue: to,
        duration: Math.max(80, duration / 2),
        delay,
        easing: Easing.out(Easing.ease),
        useNativeDriver,
      }),
      Animated.timing(opacity, {
        toValue: from,
        duration: Math.max(120, duration / 2),
        easing: Easing.in(Easing.ease),
        useNativeDriver,
      }),
    ]).start();
  }, [delay, duration, enabled, from, opacity, to, useNativeDriver]);

  useEffect(() => {
    start();
  }, [start]);

  return {
    opacity,
    start,
    animatedStyle: { opacity } as ViewStyle,
  };
}
