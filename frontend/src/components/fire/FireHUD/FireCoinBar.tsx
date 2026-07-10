import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  ImageBackground,
  StyleSheet,
  Text,
  View,
} from "react-native";

type FireCoinBarProps = {
  coins: number;
};

const COIN_BAR = require("../../../assets/ui/coin-bar-v2.png");

const { width } = Dimensions.get("window");

export default function FireCoinBar({
  coins,
}: FireCoinBarProps) {
  const glow = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 0.92,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View
        style={{
          opacity: glow,
        }}
      >
        <ImageBackground
          source={COIN_BAR}
          resizeMode="contain"
          style={styles.bar}
        >
          <Text style={styles.coinText}>
            {coins.toLocaleString()}
          </Text>
        </ImageBackground>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    marginBottom: 8,
  },

  bar: {
    width: Math.min(width * 0.88, 360),
    aspectRatio: 4.2,

    justifyContent: "center",
    alignItems: "center",
  },

  coinText: {
    position: "absolute",

    right: 82,

    fontSize: 30,
    fontWeight: "900",

    color: "#FFF7D6",

    textShadowColor: "#000",
    textShadowOffset: {
      width: 0,
      height: 2,
    },
    textShadowRadius: 8,
  },
});