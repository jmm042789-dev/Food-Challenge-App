import React from "react";
import { StyleSheet, Text, View } from "react-native";
import FireHUDFrame from "../FireHUDFrame";
import FireProgressBar from "../FireProgressBar";

type Props = { level: number; xp: number; nextLevelXp: number; coins: number };

export default function FireHUD({ level, xp, nextLevelXp, coins }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <FireHUDFrame compact label="FIRE FEAST" value={`LEVEL ${level}`} style={styles.levelFrame} />
        <FireHUDFrame compact label="COINS" value={coins.toLocaleString()} icon={<Text style={styles.icon}>🪙</Text>} style={styles.coinFrame} />
      </View>
      <FireHUDFrame label="ARENA XP" value={`${xp} / ${nextLevelXp}`} style={styles.xpFrame}>
        <FireProgressBar value={xp} max={nextLevelXp} variant="xp" />
      </FireHUDFrame>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8, width: "100%" },
  topRow: { flexDirection: "row", gap: 8 },
  levelFrame: { flex: 1 },
  coinFrame: { minWidth: 116 },
  xpFrame: { width: "100%" },
  icon: { fontSize: 14 },
});
