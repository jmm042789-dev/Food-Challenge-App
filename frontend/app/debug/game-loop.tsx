import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from "react-native";

import { useGameLoop } from "../../src/game/useGameLoop";

export default function GameLoopDebugScreen() {

  const {
    state,
    timeRemaining,
    opponentScore,
    winner,
    startGame,
    tap,
  } = useGameLoop();

  return (
    <View style={styles.container}>

      <Text style={styles.title}>
        🔥 Fire Feast Engine Test
      </Text>

      <View style={styles.card}>

        <Text style={styles.label}>
          Status: {state.status}
        </Text>

        <Text style={styles.label}>
          Time: {timeRemaining}
        </Text>

        <Text style={styles.label}>
          Player Score: {state.score}
        </Text>

        <Text style={styles.label}>
          Combo: {state.combo}
        </Text>

        <Text style={styles.label}>
          Opponent Score: {Math.floor(opponentScore)}
        </Text>

        <Text style={styles.label}>
          Winner: {winner}
        </Text>

      </View>

      <Pressable
        style={styles.button}
        onPress={startGame}
      >
        <Text style={styles.buttonText}>
          START GAME
        </Text>
      </Pressable>

      <Pressable
        style={styles.button}
        onPress={tap}
      >
        <Text style={styles.buttonText}>
          TAP
        </Text>
      </Pressable>

    </View>
  );

}

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: "#10131A",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },

  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FF8A00",
    marginBottom: 30,
  },

  card: {
    width: "100%",
    backgroundColor: "#1C2230",
    borderRadius: 16,
    padding: 20,
    marginBottom: 30,
  },

  label: {
    color: "#FFFFFF",
    fontSize: 20,
    marginVertical: 6,
  },

  button: {
    width: "100%",
    backgroundColor: "#FF6A00",
    paddingVertical: 16,
    borderRadius: 14,
    marginVertical: 8,
    alignItems: "center",
  },

  buttonText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
  },

});