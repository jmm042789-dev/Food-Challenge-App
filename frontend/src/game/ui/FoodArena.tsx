import React, { useEffect, useRef } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

type Props = {
  food?: string;
  combo: number;
  onTap: () => void;
};

export default function FoodArena({
  food = "🍔",
  combo,
  onTap,
}: Props) {

  const bounce = useRef(new Animated.Value(1)).current;
  const idle = useRef(new Animated.Value(0)).current;

  // ------------------------
  // Idle Floating Animation
  // ------------------------

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(idle, {
          toValue: -8,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(idle, {
          toValue: 0,
          duration: 1400,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // ------------------------
  // Tap Bounce
  // ------------------------

  const handlePress = () => {

    Animated.sequence([
      Animated.timing(bounce, {
        toValue: 0.88,
        duration: 45,
        useNativeDriver: true,
      }),
      Animated.spring(bounce, {
        toValue: 1,
        friction: 3,
        tension: 160,
        useNativeDriver: true,
      }),
    ]).start();

    onTap();
  };

  const comboColor =
    combo >= 15
      ? "#FF2D2D"
      : combo >= 10
      ? "#FF7A18"
      : combo >= 5
      ? "#FFD700"
      : "#FFFFFF";

  return (
    <View style={styles.container}>

      <Text
        style={[
          styles.combo,
          {
            color: comboColor,
          },
        ]}
      >
        COMBO x{combo}
      </Text>

      <Pressable
        onPress={handlePress}
      >

        <Animated.View
          style={{
            transform: [
              { translateY: idle },
              { scale: bounce },
            ],
          }}
        >

          <Text style={styles.food}>
            {food}
          </Text>

        </Animated.View>

      </Pressable>

      <Text style={styles.tapText}>
        TAP TO EAT
      </Text>

    </View>
  );
}

const styles = StyleSheet.create({

  container: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 25,
  },

  combo: {
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 20,

    textShadowColor: "#000",
    textShadowOffset: {
      width: 0,
      height: 2,
    },
    textShadowRadius: 6,
  },

  food: {
    fontSize: 120,

    textShadowColor: "#000",

    textShadowOffset: {
      width: 0,
      height: 6,
    },

    textShadowRadius: 18,
  },

  tapText: {
    marginTop: 18,

    color: "#FFD166",

    fontSize: 18,

    fontWeight: "900",

    letterSpacing: 1.5,
  },

});