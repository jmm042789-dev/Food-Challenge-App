import React, { useRef } from "react";
import { View, Text, Animated, Pressable, StyleSheet } from "react-native";
import { theme } from "../theme";

export default function GameCard({ title, subtitle, onPress }: any) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
    }).start();
  };

  const pressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable onPress={onPress} onPressIn={pressIn} onPressOut={pressOut}>
      <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    padding: 16,
    borderRadius: theme.radius.lg,
    marginBottom: 12,
    borderColor: theme.colors.surface2,
    borderWidth: 1,
  },

  title: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "900",
  },

  subtitle: {
    color: theme.colors.textMuted,
    marginTop: 4,
  },
});