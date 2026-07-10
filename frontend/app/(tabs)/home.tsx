import React from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
} from "react-native";

import { router } from "expo-router";

import AnimatedBackground from "../../src/game/AnimatedBackground";

import { FireHUD } from "../../src/components/fire/FireHUD";

import FireButton from "../../src/components/fire/FireButton";
import FireCard from "../../src/components/fire/FireCard";
import FeaturedChallengeCard from "../../src/components/fire/FeaturedChallengeCard";

export default function Home() {

  const startGame = () => {

    console.log("🏁 Navigating to contest...");
console.log("➡️ Navigating to play/demo");

router.push("/play/demo");

  };

  return (
    <View style={styles.container}>
      <AnimatedBackground />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <FireHUD
          level={1}
          xp={25}
          nextLevelXp={100}
          coins={120}
        />

        <FeaturedChallengeCard
          title="TODAY'S FOOD BATTLE"
          food="🍔 Mega Burger Speed Run"
          difficulty="Hard"
          coins={250}
          xp={120}
          timeLeft="2h 14m"
          isLive
          onPress={startGame}
        />

        <View style={styles.buttonArea}>
          <FireButton
            title="START CHALLENGE"
            onPress={startGame}
          />
        </View>

        <FireCard>
          <View style={styles.cardContent}>
            <Text style={styles.sectionTitle}>
              📅 DAILY GOALS
            </Text>

            <Text style={styles.item}>
              ✅ Complete 3 Matches
            </Text>

            <Text style={styles.reward}>
              🪙 Reward: 100 Coins
            </Text>

            <Text style={styles.item}>
              ✅ Win 1 Hard Challenge
            </Text>

            <Text style={styles.reward}>
              ⭐ Reward: 50 XP
            </Text>
          </View>
        </FireCard>

        <FireCard>
          <View style={styles.cardContent}>
            <Text style={styles.sectionTitle}>
              ⚡ MORE CHALLENGES
            </Text>

            <Text style={styles.item}>
              🌮 Taco Speed Run
            </Text>

            <Text style={styles.item}>
              🍕 Pizza Stack Battle
            </Text>

            <Text style={styles.item}>
              🌭 Hot Dog Blitz
            </Text>

            <Text style={styles.item}>
              🌯 Burrito Inferno
            </Text>
          </View>
        </FireCard>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#08090F",
  },

  content: {
    paddingTop: 24,
    paddingBottom: 70,
    alignItems: "center",
  },

  buttonArea: {
    width: "100%",
    alignItems: "center",
    marginTop: 10,
    marginBottom: 22,
  },

  cardContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 16,
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowOffset: {
      width: 0,
      height: 2,
    },
    textShadowRadius: 5,
  },

  item: {
    color: "#FFD166",
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 6,
  },

  reward: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 10,
  },

  bottomSpacer: {
    height: 60,
  },
});