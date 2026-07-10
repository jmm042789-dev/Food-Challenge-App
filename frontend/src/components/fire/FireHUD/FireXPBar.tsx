import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Dimensions,
  ImageBackground,
  StyleSheet,
  Text,
  View,
} from "react-native";

type FireXPBarProps = {
  level: number;
  xp: number;
  nextLevelXp: number;
};

const XP_BAR = require("../../../assets/ui/xp-bar-v2.png");

const { width } = Dimensions.get("window");

export default function FireXPBar({
  level,
  xp,
  nextLevelXp,
}: FireXPBarProps) {

  const progress = useMemo(() => {
    return Math.max(
      0,
      Math.min(1, xp / Math.max(nextLevelXp, 1))
    );
  }, [xp, nextLevelXp]);

  const fillAnim = useRef(new Animated.Value(progress)).current;

  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue: progress,
      duration: 700,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const fillWidth = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={styles.container}>

      <ImageBackground
        source={XP_BAR}
        resizeMode="contain"
        style={styles.bar}
      >

        {/* LEVEL */}

        <Text style={styles.levelNumber}>
          {level}
        </Text>

        {/* XP FILL */}

        <View style={styles.track}>
          <Animated.View
            style={[
              styles.fill,
              {
                width: fillWidth,
              },
            ]}
          />
        </View>

      </ImageBackground>

      <Text style={styles.xpText}>
        {xp.toLocaleString()} / {nextLevelXp.toLocaleString()} XP
      </Text>

    </View>
  );
}

const styles = StyleSheet.create({

  container: {
    alignItems: "center",
    marginBottom: 18,
  },

  bar: {
    width: Math.min(width * 0.90, 370),
    aspectRatio: 4.25,

    justifyContent: "center",
    alignItems: "center",
  },

  levelNumber: {
    position: "absolute",

    left: 48,
    top: 34,

    width: 56,

    textAlign: "center",

    color: "#FFF8E7",

    fontSize: 30,
    fontWeight: "900",

    textShadowColor: "#000",

    textShadowOffset: {
      width: 0,
      height: 2,
    },

    textShadowRadius: 6,
  },

  track: {
    position: "absolute",

    left: 120,
    right: 82,

    top: 48,

    height: 16,

    borderRadius: 8,

    overflow: "hidden",
  },

  fill: {
    height: "100%",

    backgroundColor: "#FFB100",

    borderRadius: 8,
  },

  xpText: {
    marginTop: -8,

    color: "#FFFFFF",

    fontSize: 18,

    fontWeight: "800",

    textShadowColor: "#000",

    textShadowOffset: {
      width: 0,
      height: 2,
    },

    textShadowRadius: 6,
  },

});