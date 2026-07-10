import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from "react-native";

import FireCard from "./FireCard";

type Props = {
  title: string;
  food: string;
  difficulty: string;
  coins: number;
  xp: number;
  timeLeft: string;
  isLive?: boolean;
  onPress?: () => void;
};

export default function FeaturedChallengeCard({
  title,
  food,
  difficulty,
  coins,
  xp,
  timeLeft,
  isLive = true,
  onPress,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pressable,
        pressed && styles.pressed,
      ]}
    >
      <FireCard>
        <View style={styles.container}>
          {isLive && (
            <View style={styles.liveBadge}>
              <Text style={styles.liveText}>
                🔥 LIVE EVENT
              </Text>
            </View>
          )}

          <Text style={styles.title}>
            {title}
          </Text>

          <Text style={styles.food}>
            {food}
          </Text>

          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                ⭐ {difficulty}
              </Text>
            </View>

            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                🪙 {coins}
              </Text>
            </View>

            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                ⭐ {xp} XP
              </Text>
            </View>
          </View>

          <Text style={styles.timer}>
            ⏱ {timeLeft} Remaining
          </Text>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              TAP TO PLAY
            </Text>
          </View>
        </View>
      </FireCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    width: "100%",
    alignItems: "center",
    marginBottom: 18,
  },

  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.95,
  },

  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    paddingBottom: 8,
  },

  liveBadge: {
    backgroundColor: "#D62828",
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 10,

    shadowColor: "#FF3B30",
    shadowOpacity: 0.8,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 0,
    },
    elevation: 8,
  },

  liveText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
  },

  title: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 6,

    textShadowColor: "rgba(0,0,0,0.75)",
    textShadowOffset: {
      width: 0,
      height: 2,
    },
    textShadowRadius: 8,
  },

  food: {
    color: "#FFD166",
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 16,
  },

  badgeRow: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    width: "100%",
    marginBottom: 14,
  },

  badge: {
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
    minWidth: 78,
    alignItems: "center",
  },

  badgeText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },

  timer: {
    color: "#8BE9FD",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 16,
  },

  footer: {
    backgroundColor: "#FF7A18",
    borderRadius: 999,
    paddingHorizontal: 28,
    paddingVertical: 12,

    shadowColor: "#FF7A18",
    shadowOpacity: 0.75,
    shadowRadius: 14,
    shadowOffset: {
      width: 0,
      height: 0,
    },
    elevation: 10,
  },

  footerText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
});