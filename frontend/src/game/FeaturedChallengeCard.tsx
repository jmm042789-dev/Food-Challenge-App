import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";

type Props = {
  title: string;
  food: string;
  difficulty: "Easy" | "Medium" | "Hard";
  coins: number;
  xp: number;
  timeLeft: string;
  isLive?: boolean;
};

export default function FeaturedChallengeCard({
  title,
  food,
  difficulty,
  coins,
  xp,
  timeLeft,
  isLive = true,
}: Props) {
  const glow = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0.6,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const difficultyColor =
    difficulty === "Easy"
      ? "#2ECC71"
      : difficulty === "Medium"
      ? "#F39C12"
      : "#E74C3C";

  return (
    <Animated.View
      style={[
        styles.card,
        {
          opacity: glow,
          shadowOpacity: glow,
        },
      ]}
    >
      {/* LIVE badge */}
      {isLive && (
        <View style={styles.liveBadge}>
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      )}

      {/* Title */}
      <Text style={styles.title}>{title}</Text>

      {/* Food theme */}
      <Text style={styles.food}>{food}</Text>

      {/* Difficulty */}
      <View style={[styles.difficulty, { borderColor: difficultyColor }]}>
        <Text style={[styles.difficultyText, { color: difficultyColor }]}>
          {difficulty.toUpperCase()} CHALLENGE
        </Text>
      </View>

      {/* Rewards */}
      <View style={styles.row}>
        <Text style={styles.reward}>🪙 {coins}</Text>
        <Text style={styles.reward}>⭐ {xp} XP</Text>
      </View>

      {/* Timer */}
      <View style={styles.timerBox}>
        <Text style={styles.timerText}>⏱ Ends in {timeLeft}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#14161C",
    borderRadius: 22,
    padding: 18,
    marginTop: 14,

    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",

    shadowColor: "#FF7A18",
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },

  liveBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "#FF3B30",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },

  liveText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 12,
  },

  title: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 6,
  },

  food: {
    color: "#FFB347",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 12,
  },

  difficulty: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: "flex-start",
    marginBottom: 14,
  },

  difficultyText: {
    fontWeight: "900",
    fontSize: 12,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  reward: {
    color: "#FFD54A",
    fontWeight: "900",
    fontSize: 16,
  },

  timerBox: {
    backgroundColor: "#0E1117",
    padding: 10,
    borderRadius: 12,
    alignItems: "center",
  },

  timerText: {
    color: "#9AA4B2",
    fontWeight: "700",
  },
});