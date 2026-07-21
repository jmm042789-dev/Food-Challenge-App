import React from "react";
import {
  StyleSheet,
  Text,
  Pressable,
  View,
} from "react-native";

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
  const percent = Math.min(progress / Math.max(maxProgress, 1), 1);

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

      <View style={styles.track}>

        <View
          style={[
            styles.fill,
            {
              width: `${percent * 100}%`,
            },
          ]}
        />

      </View>

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
    backgroundColor: "#1A1E27",

    borderRadius: 12,
    padding: 10,
    marginBottom: 7,
    borderWidth: 1,

    borderColor: "#343C48",
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

  track: {
    marginTop: 8,
    height: 6,

    backgroundColor: "#2A2F3A",

    borderRadius: 999,

    overflow: "hidden",
  },

  fill: {
    height: "100%",

    backgroundColor: "#FF8A00",

    borderRadius: 999,
  },

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
