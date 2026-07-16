import { useCallback, useEffect, useRef } from "react";
import { Animated, Easing, type ViewStyle } from "react-native";

export type UseSlideUpOptions = {
  duration?: number;
  delay?: number;
  offset?: number;
  useNativeDriver?: boolean;
  enabled?: boolean;
  easing?: (value: number) => number;
};

export function useSlideUp(options: UseSlideUpOptions = {}) {
  const {
    duration = 420,
    delay = 0,
    offset = 20,
    useNativeDriver = true,
    enabled = true,
    easing = Easing.out(Easing.cubic),
  } = options;

  const translateY = useRef(new Animated.Value(offset)).current;

  const start = useCallback(() => {
    if (!enabled) {
      translateY.setValue(0);
      return;
    }

    translateY.setValue(offset);

    Animated.timing(translateY, {
      toValue: 0,
      duration,
      delay,
      easing,
      useNativeDriver,
    }).start();
  }, [delay, duration, easing, enabled, offset, translateY, useNativeDriver]);

  useEffect(() => {
    start();
  }, [start]);

  return {
    translateY,
    start,
    animatedStyle: { transform: [{ translateY }] } as ViewStyle,
  };
}
