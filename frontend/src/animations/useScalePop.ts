import { useCallback, useEffect, useRef } from "react";
import { Animated, type ViewStyle } from "react-native";

export type UseScalePopOptions = {
  duration?: number;
  delay?: number;
  from?: number;
  to?: number;
  useNativeDriver?: boolean;
  enabled?: boolean;
  autoStart?: boolean;
};

export function useScalePop(options: UseScalePopOptions = {}) {
  const {
    duration = 260,
    delay = 0,
    from = 0.94,
    to = 1,
    useNativeDriver = true,
    enabled = true,
    autoStart = true,
  } = options;

  const scale = useRef(new Animated.Value(autoStart ? from : to)).current;

  const start = useCallback(() => {
    if (!enabled) {
      scale.setValue(to);
      return;
    }

    scale.setValue(from);

    Animated.spring(scale, {
      toValue: to,
      delay,
      useNativeDriver,
      friction: 6,
      tension: 180,
    }).start();
  }, [delay, enabled, from, scale, to, useNativeDriver]);

  useEffect(() => {
    if (autoStart) {
      start();
    }
  }, [autoStart, start]);

  return {
    scale,
    start,
    animatedStyle: { transform: [{ scale }] } as ViewStyle,
  };
}
