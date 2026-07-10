import React, { useRef } from "react";
import { Animated, Pressable, StyleSheet } from "react-native";

export default function ArcadeCard({
  children,
}: {
  children: React.ReactNode;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      friction: 6,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 5,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={styles.card}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#14161C",
    padding: 14,
    borderRadius: 18,
    marginBottom: 10,

    borderWidth: 1,
    borderColor: "rgba(255, 140, 26, 0.08)",

    shadowColor: "#FF6A00",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
});