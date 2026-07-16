import React from "react";
import {
  StyleSheet,
  Text,
  View,
} from "react-native";

type Props = {
  icon: string;
  title: string;
  progress: number;
  maxProgress: number;
  reward: string;
};

export default function DailyMissionCard({
  icon,
  title,
  progress,
  maxProgress,
  reward,
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

          <Text style={styles.reward}>
            Reward: {reward}
          </Text>

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

      <Text style={styles.progress}>
        {progress} / {maxProgress}
      </Text>

    </View>
  );
}

const styles = StyleSheet.create({

  card: {
    backgroundColor: "#1A1E27",

    borderRadius: 20,

    padding: 18,

    marginBottom: 14,

    borderWidth: 2,

    borderColor: "#343C48",
  },

  header: {
    flexDirection: "row",

    alignItems: "center",
  },

  icon: {
    fontSize: 36,

    marginRight: 14,
  },

  title: {
    color: "#FFFFFF",

    fontSize: 18,

    fontWeight: "900",
  },

  reward: {
    color: "#FFD54A",

    marginTop: 4,

    fontWeight: "700",
  },

  track: {
    marginTop: 18,

    height: 12,

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
    marginTop: 10,

    color: "#AAAAAA",

    fontWeight: "700",

    textAlign: "right",
  },

});