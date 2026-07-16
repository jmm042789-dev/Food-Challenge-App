import { useCallback, useEffect, useRef } from "react";
import { Animated, Easing, type ViewStyle } from "react-native";

export type UseScreenShakeOptions = {
  intensity?: number;
  duration?: number;
  delay?: number;
  useNativeDriver?: boolean;
  enabled?: boolean;
};

export function useScreenShake(options: UseScreenShakeOptions = {}) {
  const {
    intensity = 8,
    duration = 320,
    delay = 0,
    useNativeDriver = true,
    enabled = true,
  } = options;

  const translateX = useRef(new Animated.Value(0)).current;

  const start = useCallback(() => {
    if (!enabled) {
      translateX.setValue(0);
      return;
    }

    const sequence = Animated.sequence([
      Animated.timing(translateX, {
        toValue: -intensity,
        duration: duration / 5,
        delay,
        easing: Easing.linear,
        useNativeDriver,
      }),
      Animated.timing(translateX, {
        toValue: intensity,
        duration: duration / 5,
        easing: Easing.linear,
        useNativeDriver,
      }),
      Animated.timing(translateX, {
        toValue: -intensity / 2,
        duration: duration / 5,
        easing: Easing.linear,
        useNativeDriver,
      }),
      Animated.timing(translateX, {
        toValue: intensity / 2,
        duration: duration / 5,
        easing: Easing.linear,
        useNativeDriver,
      }),
      Animated.timing(translateX, {
        toValue: 0,
        duration: duration / 5,
        easing: Easing.linear,
        useNativeDriver,
      }),
    ]);

    sequence.start();
  }, [delay, duration, enabled, intensity, translateX, useNativeDriver]);

  useEffect(() => {
    start();
  }, [start]);

  return {
    translateX,
    start,
    animatedStyle: { transform: [{ translateX }] } as ViewStyle,
  };
}
