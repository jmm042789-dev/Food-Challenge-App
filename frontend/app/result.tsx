import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { theme } from "../src/theme";

export default function ResultScreen() {
  return (
    <View style={styles.container}>

      {/* TITLE */}
      <Text style={styles.title}>🔥 MATCH RESULT</Text>

      {/* RESULT CARD */}
      <View style={styles.card}>
        <Text style={styles.status}>VICTORY</Text>

        <Text style={styles.score}>
          You scored <Text style={styles.highlight}>2,450</Text> points
        </Text>

        <Text style={styles.subtext}>
          Great performance in the Fire Feast Arena
        </Text>
      </View>

      {/* STATS */}
      <View style={styles.statsBox}>
        <Text style={styles.stat}>+120 XP</Text>
        <Text style={styles.stat}>+50 Coins</Text>
        <Text style={styles.stat}>Streak: 3 🔥</Text>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  title: {
    fontSize: 24,
    fontWeight: "900",
    color: theme.colors.primary,
    marginBottom: 20,
  },

  card: {
    width: "100%",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.surface2,
  },

  status: {
    fontSize: 22,
    fontWeight: "900",
    color: theme.colors.gold,
    marginBottom: 10,
  },

  score: {
    fontSize: 16,
    color: theme.colors.text,
    textAlign: "center",
  },

  highlight: {
    color: theme.colors.primary,
    fontWeight: "900",
  },

  subtext: {
    marginTop: 10,
    color: theme.colors.textMuted,
    textAlign: "center",
  },

  statsBox: {
    marginTop: 20,
    width: "100%",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 15,
    borderColor: theme.colors.surface2,
    borderWidth: 1,
  },

  stat: {
    color: theme.colors.text,
    marginBottom: 5,
    fontWeight: "600",
  },
});
