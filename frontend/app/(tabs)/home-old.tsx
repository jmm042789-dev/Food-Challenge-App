import ArcadeBackground from "../../src/game/ui/ArcadeBackground";
import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";

export default function Home() {
  const router = useRouter();

  const startGame = () => {
  router.push("/matchmaking");
};

  return (
    <View style={styles.container}>
      <ArcadeBackground />

      <View style={styles.content}>
        <Text style={styles.title}>🎮 FOOD ARCADE</Text>

        <Text style={styles.subtitle}>
          Tap. Eat. Compete. Dominate.
        </Text>

        <Pressable style={styles.button} onPress={startGame}>
          <Text style={styles.buttonText}>START CHALLENGE</Text>
        </Pressable>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>🔥 Featured Challenge</Text>
          <Text style={styles.cardText}>Mega Burger Speed Run</Text>
          <Text style={styles.cardText}>Difficulty: Hard</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>🏆 Daily Goal</Text>
          <Text style={styles.cardText}>Complete 3 Matches</Text>
          <Text style={styles.cardText}>Reward: 100 Coins</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>⭐ Player Progress</Text>
          <Text style={styles.cardText}>Level 1</Text>
          <View style={styles.xpBar}>
            <View style={styles.xpFill} />
          </View>
          <Text style={styles.cardText}>25 / 100 XP</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0F17",
  },

  content: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },

  title: {
    fontSize: 38,
    fontWeight: "900",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 10,
    letterSpacing: 1,
  },

  subtitle: {
    color: "#A0A0A0",
    fontSize: 15,
    textAlign: "center",
    marginBottom: 30,
  },

  button: {
    backgroundColor: "#FFD700",
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: "center",
    marginBottom: 25,
  },

  buttonText: {
    color: "#000",
    fontWeight: "900",
    fontSize: 16,
  },

  card: {
    backgroundColor: "rgba(28,31,38,0.88)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
  },

  cardTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
  },

  cardText: {
    color: "#B0B0B0",
    fontSize: 14,
    marginBottom: 4,
  },

  xpBar: {
    height: 12,
    backgroundColor: "#1A1D24",
    borderRadius: 999,
    overflow: "hidden",
    marginVertical: 10,
  },

  xpFill: {
    width: "25%",
    height: "100%",
    backgroundColor: "#FFD700",
  },
});