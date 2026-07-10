import React from "react";
import {
  View,
  Text,
  StyleSheet,
} from "react-native";

type Props = {
  playerName?: string;
  opponentName: string;
  opponentAvatar: string;
  timeRemaining: number;
};

export default function MatchHUD({
  playerName = "YOU",
  opponentName,
  opponentAvatar,
  timeRemaining,
}: Props) {
  return (
    <View style={styles.container}>

      {/* PLAYER */}

      <View style={styles.side}>
        <Text style={styles.avatar}>🔥</Text>

        <Text style={styles.name}>
          {playerName}
        </Text>
      </View>

      {/* TIMER */}

      <View style={styles.center}>

        <Text style={styles.timerLabel}>
          TIME
        </Text>

        <Text style={styles.timer}>
          {timeRemaining}
        </Text>

      </View>

      {/* OPPONENT */}

      <View style={styles.side}>

        <Text style={styles.avatar}>
          {opponentAvatar}
        </Text>

        <Text
          style={styles.name}
          numberOfLines={1}
        >
          {opponentName}
        </Text>

      </View>

    </View>
  );
}

const styles = StyleSheet.create({

  container: {
    width: "100%",

    flexDirection: "row",

    justifyContent: "space-between",

    alignItems: "center",

    paddingHorizontal: 18,

    paddingTop: 18,

    marginBottom: 12,
  },

  side: {
    width: 110,

    alignItems: "center",
  },

  avatar: {
    fontSize: 32,

    marginBottom: 4,
  },

  name: {
    color: "#FFFFFF",

    fontSize: 16,

    fontWeight: "800",

    textAlign: "center",
  },

  center: {
    alignItems: "center",
  },

  timerLabel: {
    color: "#FFA726",

    fontSize: 13,

    fontWeight: "800",

    letterSpacing: 1,
  },

  timer: {
    color: "#FFFFFF",

    fontSize: 34,

    fontWeight: "900",

    textShadowColor: "#000",

    textShadowOffset: {
      width: 0,
      height: 2,
    },

    textShadowRadius: 8,
  },

});