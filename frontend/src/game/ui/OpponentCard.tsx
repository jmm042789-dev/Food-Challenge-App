import React from "react";
import {
  View,
  Text,
  StyleSheet,
} from "react-native";

import ScoreBar from "./ScoreBar";

type Props = {
  name: string;
  avatar: string;
  difficulty?: string;
  score: number;
};

export default function OpponentCard({
  name,
  avatar,
  difficulty = "Easy",
  score,
}: Props) {

  const difficultyColor =
    difficulty === "Legend"
      ? "#FF2D2D"
      : difficulty === "Elite"
      ? "#FF7A18"
      : difficulty === "Hard"
      ? "#FFD166"
      : difficulty === "Medium"
      ? "#7ED957"
      : "#4DA3FF";

  return (
    <View style={styles.card}>

      <View style={styles.header}>

        <Text style={styles.avatar}>
          {avatar}
        </Text>

        <View style={styles.headerText}>

          <Text
            style={styles.name}
            numberOfLines={1}
          >
            {name}
          </Text>

          <Text
            style={[
              styles.difficulty,
              { color: difficultyColor },
            ]}
          >
            {difficulty}
          </Text>

        </View>

      </View>

      <ScoreBar
        label="Score"
        score={score}
        color="#4DA3FF"
      />

    </View>
  );
}

const styles = StyleSheet.create({

  card: {
    width: "100%",

    backgroundColor: "#171B22",

    borderRadius: 20,

    padding: 14,

    borderWidth: 2,

    borderColor: "#4DA3FF",

    marginBottom: 16,

    shadowColor: "#4DA3FF",

    shadowOpacity: 0.35,

    shadowRadius: 12,

    shadowOffset: {
      width: 0,
      height: 0,
    },

    elevation: 8,
  },

  header: {
    flexDirection: "row",

    alignItems: "center",

    marginBottom: 12,
  },

  avatar: {
    fontSize: 30,

    marginRight: 10,
  },

  headerText: {
    flex: 1,
  },

  name: {
    color: "#FFFFFF",

    fontSize: 21,

    fontWeight: "900",
  },

  difficulty: {
    fontSize: 14,

    fontWeight: "800",

    marginTop: 2,
  },

});