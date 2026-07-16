import React from "react";
import { StyleSheet, Text, View } from "react-native";
import FireHUDFrame from "./FireHUDFrame";

type FireCurrencyBarProps = { coins?: number; gems?: number; tickets?: number };

function Stat({ icon, label, value }: { icon: string; label: string; value: number }) {
  return <FireHUDFrame compact label={label.toUpperCase()} value={value.toLocaleString()} icon={<Text style={styles.icon}>{icon}</Text>} style={styles.item} />;
}

export default function FireCurrencyBar({ coins = 0, gems = 0, tickets = 0 }: FireCurrencyBarProps) {
  return <View style={styles.container}><Stat icon="🪙" label="Coins" value={coins} /><Stat icon="💎" label="Gems" value={gems} /><Stat icon="🎟️" label="Tickets" value={tickets} /></View>;
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", gap: 8, justifyContent: "space-between" },
  item: { flex: 1 },
  icon: { fontSize: 14 },
});
