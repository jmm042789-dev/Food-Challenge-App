import React, { useEffect, useRef } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  View,
} from "react-native";

type Props = {
  combo: number;
};

export default function ComboBanner({
  combo,
}: Props) {

  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.08,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
      ])
    ).start();

  }, []);

  if (combo <= 1) {
    return null;
  }

  let message = "KEEP GOING";
  let color = "#4DA3FF";

  if (combo >= 20) {
    message = "🔥 FEAST MODE";
    color = "#FF2D2D";
  }
  else if (combo >= 15) {
    message = "💀 UNSTOPPABLE";
    color = "#FF4D4D";
  }
  else if (combo >= 10) {
    message = "🔥 ON FIRE";
    color = "#FF7A18";
  }
  else if (combo >= 5) {
    message = "⚡ HEATING UP";
    color = "#FFD166";
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [
            {
              scale: pulse,
            },
          ],
        },
      ]}
    >

      <Text
        style={[
          styles.combo,
          {
            color,
          },
        ]}
      >
        COMBO x{combo}
      </Text>

      <Text
        style={[
          styles.message,
          {
            color,
          },
        ]}
      >
        {message}
      </Text>

    </Animated.View>
  );
}

const styles = StyleSheet.create({

  container: {
    alignItems: "center",
    marginVertical: 12,
  },

  combo: {
    fontSize: 34,
    fontWeight: "900",

    textShadowColor: "#000",

    textShadowOffset: {
      width: 0,
      height: 2,
    },

    textShadowRadius: 8,
  },

  message: {
    marginTop: 4,

    fontSize: 18,

    fontWeight: "900",

    letterSpacing: 1.5,

    textShadowColor: "#000",

    textShadowOffset: {
      width: 0,
      height: 2,
    },

    textShadowRadius: 6,
  },

});