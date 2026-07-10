import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";

type Props = {
  countdown: number | string | null;
  visible: boolean;
};

export function CountdownOverlay({ countdown, visible }: Props) {
  const scale = useRef(new Animated.Value(0.5)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!countdown) return;

    // reset animation each time countdown changes
    scale.setValue(0.5);
    opacity.setValue(1);

    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 4,
    }).start();

    const fade = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }, 700);

    return () => clearTimeout(fade);
  }, [countdown]);

  if (!visible || !countdown) return null;

  const isGo = countdown === "GO";

  return (
    <View style={styles.overlay}>
      <Animated.Text
        style={[
          styles.text,
          {
            transform: [{ scale }],
            opacity,
            color: isGo ? "#00ff88" : "#ffffff",
            textShadowColor: isGo ? "#00ff88" : "#000",
          },
        ]}
      >
        {countdown}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },
  text: {
    fontSize: 72,
    fontWeight: "900",
    letterSpacing: 2,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
});