import React from "react";
import {
  View,
  Image,
  StyleSheet,
  Dimensions,
} from "react-native";

import FireCoinBar from "./FireCoinBar";
import FireXPBar from "./FireXPBar";

type FireHUDProps = {
  level: number;
  xp: number;
  nextLevelXp: number;
  coins: number;
};

const LOGO = require("../../../assets/logo/fire-feast-logo-primary.png");

const { width } = Dimensions.get("window");

export default function FireHUD({
  level,
  xp,
  nextLevelXp,
  coins,
}: FireHUDProps) {
  return (
    <View style={styles.container}>

      {/* FIRE FEAST LOGO */}

      <Image
        source={LOGO}
        resizeMode="contain"
        style={styles.logo}
      />

      {/* COINS */}

      <FireCoinBar
        coins={coins}
      />

      {/* XP */}

      <FireXPBar
        level={level}
        xp={xp}
        nextLevelXp={nextLevelXp}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignItems: "center",

    paddingTop: 8,
    paddingBottom: 10,
    marginBottom: 8,
  },

  logo: {
    width: Math.min(width * 0.72, 310),
    height: 135,

    marginBottom: -8,
  },
});