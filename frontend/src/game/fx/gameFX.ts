
import { Animated } from "react-native";

export const gameFX = {
  fireBurst(scale: Animated.Value) {
    scale.setValue(0.6);
    Animated.spring(scale, {
      toValue: 1,
      friction: 4,
      tension: 180,
      useNativeDriver: true,
    }).start();
  },

  comboExplosion(scale: Animated.Value) {
    scale.setValue(0.8);
    Animated.sequence([
      Animated.spring(scale,{
        toValue:1.25,
        friction:3,
        tension:220,
        useNativeDriver:true,
      }),
      Animated.spring(scale,{
        toValue:1,
        friction:5,
        tension:180,
        useNativeDriver:true,
      }),
    ]).start();
  },

  screenFlash(opacity: Animated.Value) {
    opacity.setValue(0.9);
    Animated.sequence([
      Animated.timing(opacity,{
        toValue:0,
        duration:180,
        useNativeDriver:true,
      }),
    ]).start();
  },

  floatUp(y: Animated.Value, opacity: Animated.Value) {
    y.setValue(0);
    opacity.setValue(1);
    Animated.parallel([
      Animated.timing(y,{
        toValue:-40,
        duration:700,
        useNativeDriver:true,
      }),
      Animated.timing(opacity,{
        toValue:0,
        duration:700,
        useNativeDriver:true,
      }),
    ]).start();
  },

  shake(offset: Animated.Value) {
    Animated.sequence([
      Animated.timing(offset,{toValue:-6,duration:30,useNativeDriver:true}),
      Animated.timing(offset,{toValue:6,duration:30,useNativeDriver:true}),
      Animated.timing(offset,{toValue:-4,duration:30,useNativeDriver:true}),
      Animated.timing(offset,{toValue:4,duration:30,useNativeDriver:true}),
      Animated.timing(offset,{toValue:0,duration:30,useNativeDriver:true}),
    ]).start();
  },
};

export default gameFX;
