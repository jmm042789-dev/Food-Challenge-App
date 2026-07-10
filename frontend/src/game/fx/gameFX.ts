import { Animated } from "react-native";

export const GameFX = {
  screenShake: new Animated.Value(0),
  flash: new Animated.Value(0),

  shake(intensity = 5) {
    Animated.sequence([
      Animated.timing(this.screenShake, {
        toValue: intensity,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(this.screenShake, {
        toValue: -intensity,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(this.screenShake, {
        toValue: 0,
        duration: 50,
        useNativeDriver: true,
      }),
    ]).start();
  },

  flashScreen() {
    Animated.sequence([
      Animated.timing(this.flash, {
        toValue: 1,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(this.flash, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();
  },
};