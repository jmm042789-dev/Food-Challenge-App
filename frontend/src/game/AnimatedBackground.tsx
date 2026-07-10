import React, { useEffect, useMemo, useRef } from "react";
import {
  View,
  Animated,
  StyleSheet,
  Dimensions,
} from "react-native";

const { width, height } = Dimensions.get("window");

const PARTICLE_COUNT = 28;

type Ember = {
  left: number;
  size: number;
  delay: number;
  duration: number;
  opacity: number;
};

export default function AnimatedBackground() {
  const embers = useMemo<Ember[]>(
    () =>
      Array.from({ length: PARTICLE_COUNT }).map(() => ({
        left: Math.random() * width,
        size: 3 + Math.random() * 7,
        delay: Math.random() * 5000,
        duration: 6000 + Math.random() * 6000,
        opacity: 0.15 + Math.random() * 0.35,
      })),
    []
  );

  const animations = useRef(
    embers.map(() => new Animated.Value(height + 40))
  ).current;

  useEffect(() => {
    animations.forEach((anim, index) => {
      const ember = embers[index];

      const start = () => {
        anim.setValue(height + ember.size);

        Animated.loop(
          Animated.sequence([
            Animated.delay(ember.delay),
            Animated.timing(anim, {
              toValue: -60,
              duration: ember.duration,
              useNativeDriver: true,
            }),
          ])
        ).start();
      };

      start();
    });
  }, []);

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Base */}
      <View style={styles.base} />

      {/* Orange glow */}
      <View style={styles.orangeGlow} />

      {/* Red glow */}
      <View style={styles.redGlow} />

      {/* Top lighting */}
      <View style={styles.topLight} />

      {/* Embers */}
      {embers.map((ember, index) => (
        <Animated.View
          key={index}
          style={[
            styles.ember,
            {
              left: ember.left,
              width: ember.size,
              height: ember.size,
              opacity: ember.opacity,
              transform: [
                {
                  translateY: animations[index],
                },
              ],
            },
          ]}
        />
      ))}

      {/* Bottom flame glow */}
      <View style={styles.bottomGlow} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },

  base: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#090B10",
  },

  orangeGlow: {
    position: "absolute",
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: "#FF6A00",
    opacity: 0.12,
    top: -120,
    right: -120,
  },

  redGlow: {
    position: "absolute",
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: "#FF2D2D",
    opacity: 0.08,
    bottom: -80,
    left: -60,
  },

  topLight: {
    position: "absolute",
    top: 0,
    width: width,
    height: 180,
    backgroundColor: "rgba(255,170,60,0.05)",
  },

  bottomGlow: {
    position: "absolute",
    bottom: -60,
    width: width,
    height: 220,
    backgroundColor: "rgba(255,90,0,0.08)",
    borderTopLeftRadius: 250,
    borderTopRightRadius: 250,
  },

  ember: {
    position: "absolute",
    borderRadius: 100,
    backgroundColor: "#FFD26A",
  },
});