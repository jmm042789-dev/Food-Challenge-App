import React from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { usePulse } from "../../animations";

type VictoryBurstProps = {
  label?: string;
};

export default function VictoryBurst({ label }: VictoryBurstProps) {
  const { animatedStyle } = usePulse({ enabled: true, min: 0.95, max: 1.08, duration: 900 });

  return (
    <Animated.View style={[styles.container, animatedStyle]} pointerEvents="none">
      <View style={styles.ring} />
      <View style={styles.ringSmall} />
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 999,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 133, 0, 0.08)",
    borderWidth: 2,
    borderColor: "rgba(255, 212, 74, 0.35)",
  },
  ring: {
    position: "absolute",
    width: 198,
    height: 198,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "rgba(255, 212, 74, 0.5)",
  },
  ringSmall: {
    position: "absolute",
    width: 98,
    height: 98,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255, 133, 0, 0.75)",
  },
  label: {
    color: "#FFD54A",
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
    textShadowColor: "#FF6A00",
    textShadowRadius: 12,
  },
});
