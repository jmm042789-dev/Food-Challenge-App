import React from "react";
import { StyleSheet, Text, View } from "react-native";
import FireHUDFrame from "../FireHUDFrame";

type FireCoinBarProps = { coins: number };

export default function FireCoinBar({ coins }: FireCoinBarProps) {
  return (
    <View style={styles.container}>
      <FireHUDFrame label="COINS" value={coins.toLocaleString()} icon={<Text style={styles.icon}>🪙</Text>} style={styles.frame} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", marginBottom: 8 },
  frame: { minWidth: 190 },
  icon: { fontSize: 16 },
});
