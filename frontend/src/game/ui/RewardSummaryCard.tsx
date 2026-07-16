import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";

type RewardSummaryCardProps = {
  result: "victory" | "defeat";
  coins: number;
  xp: number;
  highestCombo: number;
  foodName: string;
  matchTime: number;
};

const COIN = require("../../assets/icons/coin.png");
const XP = require("../../assets/icons/xp-crystal.png");
const STREAK = require("../../assets/icons/win-streak.png");

function RewardRow({ icon, label, value, emphasized = false }: { icon: number; label: string; value: string; emphasized?: boolean }) {
  return (
    <View style={styles.row}>
      <View style={styles.iconFrame}><Image source={icon} resizeMode="contain" style={styles.icon} /></View>
      <Text style={styles.label}>{label}</Text>
      <Text numberOfLines={1} style={[styles.value, emphasized && styles.emphasized]}>{value}</Text>
    </View>
  );
}

export default function RewardSummaryCard({ result, coins, xp, highestCombo, foodName, matchTime }: RewardSummaryCardProps) {
  return (
    <View style={[styles.card, result === "victory" ? styles.victoryCard : styles.defeatCard]}>
      <View style={styles.headingRow}>
        <Text style={styles.title}>MATCH REWARDS</Text>
        <Text style={styles.resultTag}>{result.toUpperCase()}</Text>
      </View>
      <RewardRow icon={COIN} label="COINS EARNED" value={`+${coins}`} emphasized />
      <RewardRow icon={XP} label="XP EARNED" value={`+${xp} XP`} emphasized />
      <RewardRow icon={STREAK} label="HIGHEST COMBO" value={`x${highestCombo}`} />
      <View style={styles.detailRow}>
        <Text numberOfLines={1} style={styles.detail}>{foodName}</Text>
        <Text style={styles.detail}>MATCH TIME  {matchTime}s</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "rgba(13,9,10,0.96)", borderRadius: 12, borderWidth: 1, marginTop: 7, padding: 9, width: "100%" },
  victoryCard: { borderColor: "rgba(237,157,54,0.72)" },
  defeatCard: { borderColor: "rgba(176,67,57,0.72)" },
  headingRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 5, paddingHorizontal: 2 },
  title: { color: "#E9C58E", fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  resultTag: { color: "#9D806A", fontSize: 7, fontWeight: "900", letterSpacing: 0.8 },
  row: { alignItems: "center", backgroundColor: "rgba(28,17,16,0.9)", borderColor: "rgba(213,126,43,0.28)", borderRadius: 8, borderWidth: 1, flexDirection: "row", minHeight: 37, marginTop: 4, paddingHorizontal: 7 },
  iconFrame: { alignItems: "center", backgroundColor: "rgba(7,6,7,0.75)", borderRadius: 6, height: 27, justifyContent: "center", marginRight: 7, width: 27 },
  icon: { height: 22, width: 22 },
  label: { color: "#D7C2AA", flex: 1, fontSize: 8, fontWeight: "900", letterSpacing: 0.7 },
  value: { color: "#FFF0D7", fontSize: 13, fontWeight: "900" },
  emphasized: { color: "#FFC657", fontSize: 16 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 3, paddingTop: 6 },
  detail: { color: "#9D8878", flexShrink: 1, fontSize: 7, fontWeight: "800", maxWidth: "58%", textTransform: "uppercase" },
});
