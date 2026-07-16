import React, { useEffect, useRef } from "react";
import {
  Animated,
  Image,
  ImageSourcePropType,
  StyleSheet,
  View,
} from "react-native";

type Props = {
  image: ImageSourcePropType;
  glowColor?: string;
  size?: number;
};

export default function HeroFood({
  image,
  glowColor = "#FF6B00",
  size = 190,
}: Props) {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -12,
          duration: 2800,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2800,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.75,
          duration: 1800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.container}>

      <Animated.View
        style={[
          styles.glow,
          {
            width: size + 50,
            height: size + 50,
            borderRadius: size,
            backgroundColor: glowColor,
            opacity: glowAnim,
          },
        ]}
      />

      <Animated.Image
        source={image}
        resizeMode="contain"
        style={[
          styles.image,
          {
            width: size,
            height: size,
            transform: [
              {
                translateY: floatAnim,
              },
            ],
          },
        ]}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 14,
  },

  glow: {
    position: "absolute",
    opacity: 0.18,
  },

  image: {
    zIndex: 5,
  },
});