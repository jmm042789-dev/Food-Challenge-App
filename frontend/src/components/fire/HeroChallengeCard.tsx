import React from "react";
import {
  StyleSheet,
  Text,
  View,
} from "react-native";

import FireBadge from "./FireBadge";
import FireButton from "./FireButton";
import FirePanel from "./FirePanel";
import HeroFood from "./HeroFood";

import { getFoodArtwork } from "../../assets/foodArtwork";

type Contest = {
  id: string;
  name: string;
  location: string;
  difficulty: string;
  prize_pool: number;
  entry_fee: number;
  duration_sec: number;
  color: string;
};

type Props = {
  contest: Contest;
  onPress: () => void;
};

export default function HeroChallengeCard({
  contest,
  onPress,
}: Props) {
  const artwork = getFoodArtwork(contest.id);

  return (
    <FirePanel
      highlighted
      borderColor={contest.color}
    >
      <View style={styles.container}>

        <HeroFood
          image={artwork}
          glowColor={contest.color}
          size={200}
        />

        <FireBadge
          icon="🏆"
          label={contest.difficulty.toUpperCase()}
          backgroundColor={contest.color}
        />

        <Text style={styles.title}>
          {contest.name}
        </Text>

        <View
          style={[
            styles.divider,
            {
              backgroundColor: contest.color,
            },
          ]}
        />

        <View style={styles.statsGrid}>

          <View style={styles.statCard}>
            <Text style={styles.label}>
              PRIZE
            </Text>

            <Text style={styles.goldValue}>
              ${contest.prize_pool.toLocaleString()}
            </Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.label}>
              ENTRY
            </Text>

            <Text style={styles.value}>
              {contest.entry_fee} Coins
            </Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.label}>
              LOCATION
            </Text>

            <Text
              style={styles.value}
              numberOfLines={1}
            >
              {contest.location}
            </Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.label}>
              TIME
            </Text>

            <Text style={styles.value}>
              {contest.duration_sec} sec
            </Text>
          </View>

        </View>

        <FireButton
          title="ENTER CHALLENGE"
          size="medium"
          onPress={onPress}
        />

      </View>
    </FirePanel>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },

  title: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 18,
    marginBottom: 8,
    letterSpacing: 0.6,
  },

  divider: {
    width: "100%",
    height: 3,
    borderRadius: 999,
    opacity: 0.7,
    marginVertical: 22,
  },

  statsGrid: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  statCard: {
    width: "48%",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 14,

    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  label: {
    color: "#9AA3AF",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },

  goldValue: {
    color: "#FFD54A",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 6,
  },

  value: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
    marginTop: 6,
  },
});