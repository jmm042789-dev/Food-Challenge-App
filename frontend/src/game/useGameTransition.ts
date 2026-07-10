import { useRef } from "react";
import { Animated } from "react-native";

export function useGameTransition() {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  // 🎮 GAME LAUNCH TRANSITION (standardized name)
  const launch = (onComplete: () => void) => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 1.06,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.92,
          duration: 160,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 1.12,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.85,
          duration: 120,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      onComplete();
    });
  };

  return { scale, opacity, launch };
}