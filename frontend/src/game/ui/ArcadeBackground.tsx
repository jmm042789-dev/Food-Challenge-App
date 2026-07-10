import React from "react";
import { View, StyleSheet } from "react-native";

export default function ArcadeBackground() {
  return (
    <View pointerEvents="none" style={styles.container}>
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />
      <View style={styles.glowCenter} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0B0F17",
  },

  glowTop: {
    position: "absolute",
    width: 350,
    height: 350,
    borderRadius: 175,
    backgroundColor: "rgba(0,255,255,0.12)",
    top: -120,
    left: -120,
  },

  glowBottom: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(255,0,128,0.10)",
    bottom: -100,
    right: -100,
  },

  glowCenter: {
    position: "absolute",
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: "rgba(255,215,0,0.06)",
    top: "35%",
    alignSelf: "center",
  },
});