import { useCallback, useRef } from "react";
import { Animated, type ViewStyle } from "react-native";

export type UseSquashBounceOptions = {
  duration?: number;
  fromX?: number;
  fromY?: number;
  to?: number;
  useNativeDriver?: boolean;
  enabled?: boolean;
};

export function useSquashBounce(options: UseSquashBounceOptions = {}) {
  const {
    duration = 180,
    fromX = 1.1,
    fromY = 0.86,
    to = 1,
    useNativeDriver = true,
    enabled = true,
  } = options;

  const scaleX = useRef(new Animated.Value(to)).current;
  const scaleY = useRef(new Animated.Value(to)).current;

  const start = useCallback(() => {
    if (!enabled) {
      scaleX.setValue(to);
      scaleY.setValue(to);
      return;
    }

    scaleX.setValue(fromX);
    scaleY.setValue(fromY);

    Animated.parallel([
      Animated.spring(scaleX, {
        toValue: to,
        friction: 8,
        tension: 220,
        useNativeDriver,
      }),
      Animated.spring(scaleY, {
        toValue: to,
        friction: 8,
        tension: 220,
        useNativeDriver,
      }),
    ]).start();
  }, [enabled, fromX, fromY, scaleX, scaleY, to, useNativeDriver]);

  return {
    start,
    animatedStyle: { transform: [{ scaleX }, { scaleY }] } as ViewStyle,
  };
}
