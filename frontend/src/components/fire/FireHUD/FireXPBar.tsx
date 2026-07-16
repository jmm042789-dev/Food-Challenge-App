import React from "react";
import { StyleSheet, Text, View } from "react-native";
import FireHUDFrame from "../FireHUDFrame";
import FireProgressBar from "../FireProgressBar";

type FireXPBarProps = { level: number; xp: number; nextLevelXp: number };

export default function FireXPBar({ level, xp, nextLevelXp }: FireXPBarProps) {
  return (
    <View style={styles.container}>
      <FireHUDFrame label={`LEVEL ${level}`} value={`${xp.toLocaleString()} / ${nextLevelXp.toLocaleString()} XP`} style={styles.frame}>
        <FireProgressBar value={xp} max={nextLevelXp} variant="xp" compact />
      </FireHUDFrame>
    </View>
  );
}

const styles = StyleSheet.create({ container: { marginBottom: 18 }, frame: { width: "100%" } });
