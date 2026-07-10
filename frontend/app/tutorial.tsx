import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { theme } from "../src/theme";

export default function TutorialScreen() {
  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>

        <Text style={styles.title}>🔥 FIRE FEAST GUIDE</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>How to Play</Text>
          <Text style={styles.text}>
            Enter contests, compete in food challenges, and earn points in the Fire Feast Arena.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Scoring</Text>
          <Text style={styles.text}>
            Your performance is ranked based on speed, completion, and bonus objectives.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Rewards</Text>
          <Text style={styles.text}>
            Win coins, XP, and unlock higher ranked arenas as you progress.
          </Text>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: 16,
  },

  title: {
    fontSize: 22,
    fontWeight: "900",
    color: theme.colors.primary,
    marginTop: 60,
    marginBottom: 20,
  },

  card: {
    backgroundColor: theme.colors.surface,
    padding: 16,
    borderRadius: theme.radius.lg,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.surface2,
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: theme.colors.text,
    marginBottom: 6,
  },

  text: {
    color: theme.colors.textMuted,
    lineHeight: 20,
  },
});