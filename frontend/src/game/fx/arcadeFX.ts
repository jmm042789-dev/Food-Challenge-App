import { Animated, Easing } from "react-native";

class ArcadeFXClass {
  // ======================
  // SCREEN SHAKE
  // ======================
  screenShake = new Animated.Value(0);
  screenFlash = new Animated.Value(0);

  shake(intensity = 6) {
    this.screenShake.setValue(intensity);

    Animated.sequence([
      Animated.timing(this.screenShake, {
        toValue: -intensity,
        duration: 40,
        easing: Easing.bounce,
        useNativeDriver: true,
      }),
      Animated.timing(this.screenShake, {
        toValue: intensity / 2,
        duration: 40,
        useNativeDriver: true,
      }),
      Animated.timing(this.screenShake, {
        toValue: 0,
        duration: 60,
        useNativeDriver: true,
      }),
    ]).start();
  }

  // ======================
  // SCREEN FLASH
  // ======================
  flash() {
    this.screenFlash.setValue(0.8);

    Animated.timing(this.screenFlash, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }

  // ======================
  // COMBO BURST (BIG MOMENT)
  // ======================
  comboBurst(combo: number) {
    this.flash();

    const intensity = Math.min(combo * 2, 25);

    this.shake(intensity);
  }

  // ======================
  // SCORE POP EFFECT
  // ======================
  pop(value: Animated.Value) {
    Animated.sequence([
      Animated.timing(value, {
        toValue: 1.2,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(value, {
        toValue: 1,
        duration: 60,
        useNativeDriver: true,
      }),
    ]).start();
  }
}

export const ArcadeFX = new ArcadeFXClass();