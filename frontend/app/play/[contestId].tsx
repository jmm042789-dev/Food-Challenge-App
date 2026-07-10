console.log("✅ ContestScreen rendered");
import React from "react";
import {
  View,
  Text,
  StyleSheet,
} from "react-native";

import ArcadeBackground from "../../src/game/ui/ArcadeBackground";
import FoodArena from "../../src/game/ui/FoodArena";
import MatchTimer from "../../src/game/ui/MatchTimer";

import FireHUD from "../../src/components/fire/FireHUD/FireHUD";
import FireButton from "../../src/components/fire/FireButton";

import { useGameLoop } from "../../src/game/useGameLoop";

export default function ContestScreen() {

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

      <ArcadeBackground />

      <View style={styles.content}>

        {/* ==========================
            TOP HUD
        ========================== */}

        <FireHUD
          level={1}
          xp={25}
          nextLevelXp={100}
          coins={250}
        />

        {/* ==========================
            MATCH INFO
        ========================== */}

        <View style={styles.infoRow}>

          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>
              TIME
            </Text>

            <MatchTimer
              timeRemaining={timeRemaining}
            />
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>
              OPPONENT
            </Text>

            <Text style={styles.infoValue}>
              {opponentScore}
            </Text>
          </View>

        </View>

        {/* ==========================
            FOOD AREA
        ========================== */}

        <View style={styles.foodArea}>

          <FoodArena
            food="🍔"
            combo={state.combo}
            onTap={tap}
          />

        </View>

        {/* ==========================
            PLAYER SCORE
        ========================== */}

        <View style={styles.scorePanel}>

          <Text style={styles.scoreTitle}>
            YOUR SCORE
          </Text>

          <Text style={styles.scoreValue}>
            {state.score}
          </Text>

        </View>

        {/* ==========================
            STATUS
        ========================== */}

        <Text style={styles.statusText}>
          {state.status}
        </Text>

        {state.status === "FINISHED" && (

          <Text style={styles.winnerText}>
            WINNER: {winner}
          </Text>

        )}

        {/* ==========================
            START BUTTON
        ========================== */}

        <FireButton
          title={
            state.status === "IDLE"
              ? "START CHALLENGE"
              : state.status === "COUNTDOWN"
              ? "GET READY..."
              : state.status === "PLAYING"
              ? "MATCH IN PROGRESS"
              : "PLAY AGAIN"
          }
          disabled={
            state.status === "COUNTDOWN" ||
            state.status === "PLAYING"
          }
          onPress={startGame}
        />

      </View>

    </View>
  );

}const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: "#0B0F17",
  },

  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",

    paddingTop: 18,
    paddingBottom: 30,
    paddingHorizontal: 18,
  },

  // ==========================
  // Top Match Info
  // ==========================

  infoRow: {
    width: "100%",

    flexDirection: "row",

    justifyContent: "space-between",

    alignItems: "center",

    marginTop: 8,
    marginBottom: 10,
  },

  infoCard: {
    width: "47%",

    backgroundColor: "rgba(0,0,0,0.35)",

    borderRadius: 14,

    paddingVertical: 10,

    alignItems: "center",
  },

  infoLabel: {
    color: "#FFD166",

    fontWeight: "900",

    fontSize: 15,

    marginBottom: 4,

    letterSpacing: 1,
  },

  infoValue: {
    color: "#FFFFFF",

    fontWeight: "900",

    fontSize: 28,
  },

  // ==========================
  // Food Area
  // ==========================

  foodArea: {
    flex: 1,

    width: "100%",

    justifyContent: "center",

    alignItems: "center",

    minHeight: 220,
  },

  // ==========================
  // Score
  // ==========================

  scorePanel: {
    alignItems: "center",

    marginBottom: 10,
  },

  scoreTitle: {
    color: "#FFD166",

    fontSize: 18,

    fontWeight: "900",
  },

  scoreValue: {
    color: "#FFFFFF",

    fontSize: 44,

    fontWeight: "900",
  },

  // ==========================
  // Status
  // ==========================

  statusText: {
    color: "#FFFFFF",

    fontSize: 18,

    fontWeight: "800",

    marginBottom: 6,
  },

  winnerText: {
    color: "#FFB703",

    fontSize: 22,

    fontWeight: "900",

    marginBottom: 10,
  },

});