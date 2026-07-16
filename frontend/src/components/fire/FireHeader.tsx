import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import FireHUDFrame from "./FireHUDFrame";
import FireProgressBar from "./FireProgressBar";

type Props = {
  level: number;
  xp: number;
  nextLevelXp: number;
  coins: number;
};

const LOGO = require("../../assets/logo/fire-feast-logo-primary.png");
const COIN = require("../../assets/icons/coin.png");

export default function FireHeader({ level, xp, nextLevelXp, coins }: Props) {
  return (
    <View style={styles.container}>
      <Image source={LOGO} resizeMode="contain" style={styles.logo} />

      <View style={styles.hud}>
        <FireHUDFrame
          compact
          label="COINS"
          value={coins.toLocaleString()}
          icon={<Image source={COIN} resizeMode="contain" style={styles.coinIcon} />}
          style={styles.coinFrame}
        />

        <FireHUDFrame
          compact
          label={`LV ${level} · ARENA XP`}
          value={`${xp.toLocaleString()} / ${nextLevelXp.toLocaleString()}`}
          style={styles.xpFrame}
        >
          <FireProgressBar value={xp} max={nextLevelXp} variant="xp" compact />
        </FireHUDFrame>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", flexDirection: "row", minHeight: 78 },
  logo: { height: 86, marginLeft: -16, marginRight: -7, width: "48%" },
  hud: { flex: 1, gap: 4 },
  coinFrame: { borderRadius: 9, minHeight: 34, paddingHorizontal: 8, paddingVertical: 5 },
  coinIcon: { height: 22, width: 22 },
  xpFrame: { borderRadius: 9, minHeight: 43, paddingHorizontal: 8, paddingVertical: 5 },
});
