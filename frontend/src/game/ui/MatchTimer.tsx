import React from "react";
import {
  View,
  Text,
  StyleSheet,
} from "react-native";

type Props = {
  timeRemaining: number;
};

export default function MatchTimer({
  timeRemaining,
}: Props) {

  const color =
    timeRemaining <= 10
      ? "#FF2D2D"
      : timeRemaining <= 20
      ? "#FF7A18"
      : "#FFFFFF";

  return (
    <View style={styles.container}>

      <Text style={styles.label}>
        TIME
      </Text>

      <View
        style={[
          styles.circle,
          {
            borderColor: color,
          },
        ]}
      >
        <Text
          style={[
            styles.time,
            {
              color,
            },
          ]}
        >
          {timeRemaining}
        </Text>
      </View>

      <Text style={styles.seconds}>
        Seconds
      </Text>

    </View>
  );
}

const styles = StyleSheet.create({

  container: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 16,
  },

  label: {
    color: "#FFA726",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 2,
    marginBottom: 8,
  },

  circle: {
    width: 90,
    height: 90,

    borderRadius: 45,

    borderWidth: 4,

    backgroundColor: "#171B22",

    justifyContent: "center",
    alignItems: "center",

    shadowColor: "#FFA726",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 0,
    },

    elevation: 8,
  },

  time: {
    fontSize: 38,
    fontWeight: "900",

    textShadowColor: "#000",
    textShadowOffset: {
      width: 0,
      height: 2,
    },
    textShadowRadius: 6,
  },

  seconds: {
    color: "#AAAAAA",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 8,
  },

});