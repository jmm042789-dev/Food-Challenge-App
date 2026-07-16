import React, { useEffect, useRef } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useAnimationContext } from "../../animations/AnimationProvider";

type Props = {
  children: React.ReactNode;
  delay?: number;
  duration?: "fast" | "standard" | number;
  distance?: number;
  scaleFrom?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

const durations = { fast: 180, standard: 280 } as const;

/** One-shot, native-driven entrance motion for major screen sections. */
export default function FireScreenEntrance({
  children,
  delay = 0,
  duration = "standard",
  distance = 12,
  scaleFrom = 1,
  disabled = false,
  style,
}: Props) {
  const { enabled } = useAnimationContext();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(distance)).current;
  const scale = useRef(new Animated.Value(scaleFrom)).current;

  useEffect(() => {
    let mounted = true;
    let animation: Animated.CompositeAnimation | undefined;

    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (!mounted) return;
      if (disabled || !enabled || reduceMotion) {
        opacity.setValue(1);
        translateY.setValue(0);
        scale.setValue(1);
        return;
      }

      const milliseconds = typeof duration === "number" ? duration : durations[duration];
      opacity.setValue(0);
      translateY.setValue(distance);
      scale.setValue(scaleFrom);
      animation = Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: milliseconds, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: milliseconds, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: milliseconds, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]);
      animation.start();
    });

    return () => {
      mounted = false;
      animation?.stop();
      opacity.stopAnimation();
      translateY.stopAnimation();
      scale.stopAnimation();
    };
  }, [delay, disabled, distance, duration, enabled, opacity, scale, scaleFrom, translateY]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }, { scale }] }]}>
      {children}
    </Animated.View>
  );
}
