import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import type { resolveOfficialProgression } from "../../ranks";

import FireHUDFrame from "./FireHUDFrame";
import FireProgressBar from "./FireProgressBar";

type Props = {
  progression: ReturnType<typeof resolveOfficialProgression>;
  coins: number;
};

const LOGO = require("../../assets/logo/fire-feast-logo-primary.png");
const COIN = require("../../assets/icons/coin.png");

export default function FireHeader({ progression, coins }: Props) {
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
          label={progression.level === null ? "LEVEL UNAVAILABLE" : `LEVEL ${progression.level}`}
          value={progression.xp === null ? "XP UNAVAILABLE" : `${progression.xp.toLocaleString()} XP`}
          style={styles.xpFrame}
        >
          {progression.intervalXp !== null && progression.intervalSize !== null ? <>
            <Text style={{ color: "#FFD54A" }}>{progression.nextBelt ? "NEXT BELT" : "MAX BELT"}</Text>
            <FireProgressBar value={progression.intervalXp} max={progression.intervalSize} variant="xp" compact />
          </> : null}
        </FireHUDFrame>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", flexDirection: "row", minHeight: 64, minWidth: 0 },
  logo: { flexShrink: 1, height: 70, marginLeft: -12, marginRight: -5, maxWidth: 160, width: "44%" },
  hud: { flex: 1, gap: 4, minWidth: 0 },
  coinFrame: { borderRadius: 9, minHeight: 34, paddingHorizontal: 8, paddingVertical: 5 },
  coinIcon: { height: 22, width: 22 },
  xpFrame: { borderRadius: 9, minHeight: 43, paddingHorizontal: 8, paddingVertical: 5 },
});
