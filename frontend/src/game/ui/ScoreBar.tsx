import React from "react";
import {
  View,
  Text,
  StyleSheet,
} from "react-native";

type Props = {
  label: string;
  score: number;
  color?: string;
  maxScore?: number;
};

export default function ScoreBar({
  label,
  score,
  color = "#FF7A18",
  maxScore = 250,
}: Props) {

  const progress = Math.max(
    0,
    Math.min(score / maxScore, 1)
  );

  return (
    <View style={styles.container}>

      <View style={styles.header}>

        <Text style={styles.label}>
          {label}
        </Text>

        <Text style={styles.score}>
          {Math.floor(score)}
        </Text>

      </View>

      <View style={styles.track}>

        <View
          style={[
            styles.fill,
            {
              width: `${progress * 100}%`,
              backgroundColor: color,
            },
          ]}
        />

      </View>

    </View>
  );
}

const styles = StyleSheet.create({

  container: {
    width: "100%",
    marginBottom: 14,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",

    marginBottom: 5,
  },

  label: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },

  score: {
    color: "#FFD166",
    fontSize: 20,
    fontWeight: "900",
  },

  track: {
    height: 16,

    borderRadius: 10,

    overflow: "hidden",

    backgroundColor: "#222831",
  },

  fill: {
    height: "100%",
    borderRadius: 10,
  },

});