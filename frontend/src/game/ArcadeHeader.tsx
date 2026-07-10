import React, { useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  Animated,
  ImageBackground,
  StyleSheet,
  Dimensions,
} from "react-native";

type Props = {
  level: number;
  xp: number;
  nextLevelXp: number;
  coins: number;
  streak: number;
};

const LOGO = require("../assets/logo/fire-feast-logo-primary.png");
const COIN_BAR = require("../assets/ui/coin-bar.png");
const XP_BAR = require("../assets/ui/xp-bar.png");

const { width } = Dimensions.get("window");

export default function ArcadeHeader({
  level,
  xp,
  nextLevelXp,
  coins,
}: Props) {
  const logoScale = useRef(new Animated.Value(1)).current;
  const logoOpacity = useRef(new Animated.Value(0.9)).current;
  const xpAnim = useRef(new Animated.Value(0)).current;

  const headerWidth = Math.min(width - 32, 420);

  const xpPercent = useMemo(() => {
    return Math.max(
      0,
      Math.min(1, xp / Math.max(nextLevelXp, 1))
    );
  }, [xp, nextLevelXp]);

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(logoScale, {
            toValue: 1.02,
            duration: 1800,
            useNativeDriver: true,
          }),
          Animated.timing(logoScale, {
            toValue: 1,
            duration: 1800,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(logoOpacity, {
            toValue: 1,
            duration: 1600,
            useNativeDriver: true,
          }),
          Animated.timing(logoOpacity, {
            toValue: 0.88,
            duration: 1600,
            useNativeDriver: true,
          }),
        ]),
      ])
    ).start();
  }, []);

  useEffect(() => {
    Animated.timing(xpAnim, {
      toValue: xpPercent,
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [xpPercent]);

  const fillWidth = xpAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={styles.container}>

      <Animated.Image
        source={LOGO}
        resizeMode="contain"
        style={[
          styles.logo,
          {
            width: headerWidth * 0.9,
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          },
        ]}
      />

      <Text style={styles.tagline}>
        EAT • COMPETE • CONQUER
      </Text>

      <ImageBackground
        source={COIN_BAR}
        resizeMode="stretch"
        style={[
          styles.coinBar,
          {
            width: headerWidth,
          },
        ]}
      >
        <Text style={styles.coinText}>
          {coins.toLocaleString()}
        </Text>
      </ImageBackground>

      <ImageBackground
        source={XP_BAR}
        resizeMode="stretch"
        style={[
          styles.xpBar,
          {
            width: headerWidth,
          },
        ]}
      >
        <Text style={styles.levelText}>
          LV {level}
        </Text>

        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: fillWidth,
              },
            ]}
          />
        </View>

        <Text style={styles.xpText}>
          {xp} / {nextLevelXp} XP
        </Text>

      </ImageBackground>

    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 10,
    paddingBottom: 12,
  },

  logo: {
    height: 115,
    alignSelf: "center",
    marginBottom: 8,
  },

  tagline: {
    color: "#FFD48A",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 16,
    textAlign: "center",
  },

  coinBar: {
    height: 72,
    alignSelf: "center",

    justifyContent: "center",
    alignItems: "flex-end",

    paddingRight: 34,

    marginBottom: 14,
  },

  coinText: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",

    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: {
      width: 0,
      height: 2,
    },
    textShadowRadius: 6,
  },

  xpBar: {
    height: 88,
    alignSelf: "center",

    justifyContent: "center",
    alignItems: "center",
  },

  levelText: {
    position: "absolute",

    left: 20,
    top: 18,

    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",

    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 5,
  },

  progressTrack: {
    width: "58%",
    height: 12,

    borderRadius: 999,
    overflow: "hidden",

    backgroundColor: "rgba(18,18,18,0.95)",

    marginTop: 4,
  },

  progressFill: {
    height: "100%",
    borderRadius: 999,

    backgroundColor: "#FDB913",
  },

  xpText: {
    marginTop: 8,

    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",

    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 5,
  },
});