import { useEffect, useRef } from "react";
import { Animated, Easing, type ViewStyle } from "react-native";

export type UsePulseOptions = {
  min?: number;
  max?: number;
  duration?: number;
  delay?: number;
  useNativeDriver?: boolean;
  enabled?: boolean;
};

export function usePulse(options: UsePulseOptions = {}) {
  const {
    min = 0.96,
    max = 1.04,
    duration = 1100,
    delay = 0,
    useNativeDriver = true,
    enabled = true,
  } = options;

  const pulse = useRef(new Animated.Value(min)).current;

  useEffect(() => {
    if (!enabled) {
      pulse.setValue(max);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: max,
          duration,
          delay,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver,
        }),
        Animated.timing(pulse, {
          toValue: min,
          duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver,
        }),
      ]),
    );

    animation.start();

    return () => animation.stop();
  }, [delay, duration, enabled, max, min, pulse, useNativeDriver]);

  return {
    pulse,
    animatedStyle: { transform: [{ scale: pulse }] } as ViewStyle,
  };
}
