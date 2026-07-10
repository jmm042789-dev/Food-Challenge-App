import React from "react";
import {
  View,
  Text,
  StyleSheet,
} from "react-native";

import ScoreBar from "./ScoreBar";

type Props = {
  score: number;
  combo: number;
};

export default function PlayerCard({
  score,
  combo,
}: Props) {

  return (
    <View style={styles.card}>

      <View style={styles.header}>

        <Text style={styles.avatar}>
          🔥
        </Text>

        <Text style={styles.name}>
          YOU
        </Text>

      </View>

      <ScoreBar
        label="Score"
        score={score}
        color="#FF7A18"
      />

      <View style={styles.bottom}>

        <Text style={styles.combo}>
          🔥 Combo x{combo}
        </Text>

      </View>

    </View>
  );
}

const styles = StyleSheet.create({

  card: {

    backgroundColor: "#171B22",

    borderRadius: 20,

    padding: 14,

    width: "100%",

    borderWidth: 2,

    borderColor: "#FF7A18",

    marginBottom: 16,

    shadowColor: "#FF7A18",

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

    fontSize: 28,

    marginRight: 10,

  },

  name: {

    color: "#FFFFFF",

    fontSize: 22,

    fontWeight: "900",

  },

  bottom: {

    marginTop: 10,

    alignItems: "center",

  },

  combo: {

    color: "#FFD166",

    fontWeight: "900",

    fontSize: 18,

  },

});