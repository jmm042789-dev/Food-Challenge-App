import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { theme } from "../../src/theme";

export default function LeaderboardScreen() {
  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* HEADER */}
        <Text style={styles.header}>🏆 FIRE FEAST RANKINGS</Text>

        {/* TOP 3 PODIUM */}
        <View style={styles.podium}>
          <View style={styles.second}>
            <Text style={styles.rank}>2</Text>
            <Text style={styles.name}>Player Two</Text>
            <Text style={styles.score}>2,450 pts</Text>
          </View>

          <View style={styles.first}>
            <Text style={styles.rank}>1</Text>
            <Text style={styles.name}>Player One</Text>
            <Text style={styles.score}>3,120 pts</Text>
          </View>

          <View style={styles.third}>
            <Text style={styles.rank}>3</Text>
            <Text style={styles.name}>Player Three</Text>
            <Text style={styles.score}>2,100 pts</Text>
          </View>
        </View>

        {/* LIST */}
        <View style={styles.listItem}>
          <Text style={styles.listRank}>4</Text>
          <Text style={styles.listName}>You</Text>
          <Text style={styles.listScore}>1,980 pts</Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listRank}>5</Text>
          <Text style={styles.listName}>Rival Chef</Text>
          <Text style={styles.listScore}>1,870 pts</Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listRank}>6</Text>
          <Text style={styles.listName}>Spice Lord</Text>
          <Text style={styles.listScore}>1,640 pts</Text>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  header: {
    color: theme.colors.primary,
    fontSize: 22,
    fontWeight: "900",
    marginTop: 60,
    marginLeft: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },

  podium: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },

  first: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.radius.lg,
    alignItems: "center",
    borderWidth: 2,
    borderColor: theme.colors.gold,
  },

  second: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.radius.lg,
    alignItems: "center",
    opacity: 0.9,
  },

  third: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.radius.lg,
    alignItems: "center",
    opacity: 0.8,
  },

  rank: {
    color: theme.colors.primary,
    fontWeight: "900",
    fontSize: 18,
  },

  name: {
    color: theme.colors.text,
    fontWeight: "800",
    marginTop: 4,
  },

  score: {
    color: theme.colors.gold,
    marginTop: 2,
    fontWeight: "700",
  },

  listItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    marginBottom: 10,
  },

  listRank: {
    color: theme.colors.primary,
    fontWeight: "900",
  },

  listName: {
    color: theme.colors.text,
    fontWeight: "700",
  },

  listScore: {
    color: theme.colors.textMuted,
  },
});
