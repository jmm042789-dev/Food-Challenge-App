import { useEffect, useRef } from "react";
import { Animated, Easing, type ViewStyle } from "react-native";

export type UseFloatingOptions = {
  amplitude?: number;
  duration?: number;
  delay?: number;
  useNativeDriver?: boolean;
  enabled?: boolean;
};

export function useFloating(options: UseFloatingOptions = {}) {
  const {
    amplitude = 8,
    duration = 1400,
    delay = 0,
    useNativeDriver = true,
    enabled = true,
  } = options;

  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!enabled) {
      translateY.setValue(0);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, {
          toValue: -amplitude,
          duration,
          delay,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver,
        }),
        Animated.timing(translateY, {
          toValue: amplitude,
          duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver,
        }),
      ]),
    );

    animation.start();

    return () => animation.stop();
  }, [amplitude, delay, duration, enabled, translateY, useNativeDriver]);

  return {
    translateY,
    animatedStyle: { transform: [{ translateY }] } as ViewStyle,
  };
}
