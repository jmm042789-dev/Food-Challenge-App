import React from "react";
import {
  StyleSheet,
  Text,
  Pressable,
  View,
} from "react-native";
import FireProgressBar from "./FireProgressBar";

type Props = {
  icon: string;
  title: string;
  progress: number;
  maxProgress: number;
  reward: string;
  completed?: boolean;
  claimed?: boolean;
  onClaim?: () => void;
};

export default function DailyMissionCard({
  icon,
  title,
  progress,
  maxProgress,
  reward,
  completed = false,
  claimed = false,
  onClaim,
}: Props) {
  return (
    <View style={styles.card}>

      <View style={styles.header}>

        <Text style={styles.icon}>
          {icon}
        </Text>

        <View style={{ flex: 1 }}>

          <Text style={styles.title}>
            {title}
          </Text>

          <Text style={styles.reward}>{reward}</Text>

        </View>

      </View>

      <FireProgressBar compact max={Math.max(maxProgress, 1)} value={progress} variant="xp" style={styles.progressBar} />

      <View style={styles.footer}>
        <Text style={styles.progress}>{progress} / {maxProgress}</Text>
        {claimed ? <Text style={styles.claimed}>CLAIMED</Text> : completed ? (
          <Pressable accessibilityLabel={`Claim reward for ${title}`} accessibilityRole="button" onPress={onClaim} style={styles.claimButton}>
            <Text style={styles.claimText}>CLAIM</Text>
          </Pressable>
        ) : null}
      </View>

    </View>
  );
}

const styles = StyleSheet.create({

  card: {
    backgroundColor: "rgba(22,13,13,0.94)",

    borderRadius: 12,
    padding: 10,
    marginBottom: 7,
    borderWidth: 1,

    borderColor: "rgba(218,130,42,0.42)",
  },

  header: {
    flexDirection: "row",

    alignItems: "center",
  },

  icon: {
    fontSize: 16,
    fontWeight: "900",
    marginRight: 9,
  },

  title: {
    color: "#FFFFFF",

    fontSize: 11,

    fontWeight: "900",
  },

  reward: {
    color: "#FFD54A",

    fontSize: 8,
    marginTop: 2,

    fontWeight: "700",
  },

  progressBar: { marginTop: 8 },

  progress: {
    fontSize: 8,
    color: "#AAAAAA",
    fontWeight: "700",
  },
  footer: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 5 },
  claimButton: { alignItems: "center", backgroundColor: "#A64713", borderColor: "#F6B354", borderRadius: 7, borderWidth: 1, justifyContent: "center", minHeight: 44, minWidth: 44, paddingHorizontal: 10 },
  claimText: { color: "#FFF2D2", fontSize: 8, fontWeight: "900", letterSpacing: 0.7 },
  claimed: { color: "#6DC889", fontSize: 8, fontWeight: "900", letterSpacing: 0.6 },

});
