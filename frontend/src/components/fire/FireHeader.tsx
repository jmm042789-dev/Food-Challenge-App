import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Dimensions,
  Image,
  ImageBackground,
  StyleSheet,
  Text,
  View,
} from "react-native";

type Props = {
  level: number;
  xp: number;
  nextLevelXp: number;
  coins: number;
};

const LOGO = require("../../assets/logo/fire-feast-logo-primary.png");
const COIN_BAR = require("../../assets/ui/coin-bar.png");
const XP_BAR = require("../../assets/ui/xp-bar.png");

const { width } = Dimensions.get("window");

export default function FireHeader({
  level,
  xp,
  nextLevelXp,
  coins,
}: Props) {
  const logoScale = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0.9)).current;
  const xpAnim = useRef(new Animated.Value(0)).current;

  const percent = useMemo(() => {
    return Math.max(
      0,
      Math.min(1, xp / Math.max(nextLevelXp, 1))
    );
  }, [xp, nextLevelXp]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(logoScale, {
          toValue: 1.025,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, {
          toValue: 1,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          toValue: 0.85,
          duration: 1600,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    Animated.timing(xpAnim, {
      toValue: percent,
      duration: 700,
      useNativeDriver: false,
    }).start();
  }, [percent]);

  const xpWidth = xpAnim.interpolate({
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
            opacity: glowOpacity,
            transform: [{ scale: logoScale }],
          },
        ]}
      />

      <Text style={styles.tagline}>
        EAT • COMPETE • CONQUER
      </Text>

      {/* COIN BAR */}

      <ImageBackground
        source={COIN_BAR}
        resizeMode="contain"
        style={styles.coinBar}
      >
        <Text style={styles.coinText}>
          {coins.toLocaleString()}
        </Text>
      </ImageBackground>

      {/* XP BAR */}

      <ImageBackground
        source={XP_BAR}
        resizeMode="contain"
        style={styles.xpBar}
      >

        <Text style={styles.levelNumber}>
          {level}
        </Text>

        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: xpWidth,
              },
            ]}
          />
        </View>

        <Text style={styles.progressText}>
          {xp.toLocaleString()} / {nextLevelXp.toLocaleString()} XP
        </Text>

      </ImageBackground>

    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingTop: 18,
    paddingBottom: 18,
  },

  logo: {
    width: Math.min(width * 0.62, 300),
    height: 140,
    marginBottom: 6,
  },

  tagline: {
    color: "#F7D08A",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 3,
    marginBottom: 18,
  },

  coinBar: {
    width: Math.min(width - 36, 360),
    aspectRatio: 1536 / 768,

    justifyContent: "center",
    alignItems: "center",

    marginBottom: 14,
  },

  coinText: {
    position: "absolute",

    right: 82,

    color: "#FFFFFF",

    fontSize: 28,
    fontWeight: "900",

    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: {
      width: 0,
      height: 2,
    },
    textShadowRadius: 6,
  },

  xpBar: {
    width: Math.min(width - 36, 360),
    aspectRatio: 1536 / 768,

    justifyContent: "center",

    marginBottom: 10,
  },

  levelNumber: {
    position: "absolute",

    left: 34,
    top: 28,

    width: 74,

    textAlign: "center",

    color: "#FFFFFF",

    fontSize: 34,
    fontWeight: "900",

    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: {
      width: 0,
      height: 2,
    },
    textShadowRadius: 6,
  },

  progressTrack: {
    position: "absolute",

    left: 118,
    right: 145,

    top: 54,

    height: 18,

    borderRadius: 10,

    overflow: "hidden",
  },

  progressFill: {
    height: "100%",

    backgroundColor: "#FFB300",

    borderRadius: 10,
  },

  progressText: {
    position: "absolute",

    right: 78,
    top: 40,

    color: "#FFFFFF",

    fontSize: 18,
    fontWeight: "900",

    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: {
      width: 0,
      height: 2,
    },
    textShadowRadius: 6,
  },
});