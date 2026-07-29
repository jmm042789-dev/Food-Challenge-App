import React from "react";
import { StyleSheet, Text, View } from "react-native";
import AvatarRenderer from "./AvatarRenderer";
import type { PlayerIdentity } from "./PlayerIdentity";
import FireProgressBar from "../components/fire/FireProgressBar";

type Props = { identity: PlayerIdentity; rank: string; rankColor: string; level: number; xp: number; progress: number; progressMax: number; coins: number; wins: number; matches: number; streak: number; achievementCompleted: number; achievementTotal: number };
export default function PlayerProfileCard({ identity, rank, rankColor, level, xp, progress, progressMax, coins, wins, matches, streak, achievementCompleted, achievementTotal }: Props) {
  const winRate = matches > 0 ? Math.round((wins / matches) * 100) : 0;
  return <View style={[styles.card, { borderColor: rankColor }]}>
    <View style={styles.hero}><AvatarRenderer configuration={identity.avatar} size={116} /><View style={styles.identity}><Text style={styles.name}>{identity.gamerName}</Text><Text style={[styles.rank, { color: rankColor }]}>{rank.toUpperCase()}</Text><Text style={styles.level}>LEVEL {level} · {xp.toLocaleString()} XP</Text><FireProgressBar compact max={progressMax} value={progress} variant="xp" /></View></View>
    <View style={styles.metrics}><Metric label="COINS" value={coins.toLocaleString()} /><Metric label="WIN RATE" value={`${winRate}%`} /><Metric label="DAILY STREAK" value={`${streak} DAYS`} /></View>
    <View style={styles.details}><Detail label="FAVORITE FOOD" value="COMING SOON" /><Detail label="FAVORITE RESTAURANT" value="COMING SOON" /><Detail label="ACHIEVEMENTS" value={`${achievementCompleted} / ${achievementTotal}`} /><Detail label="SEASON" value="BETA SEASON" /></View>
  </View>;
}
function Metric({ label, value }: { label: string; value: string }) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }
function Detail({ label, value }: { label: string; value: string }) { return <View style={styles.detail}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>; }
const styles = StyleSheet.create({
  card: { backgroundColor: "rgba(13,9,10,0.98)", borderRadius: 17, borderWidth: 1.5, elevation: 8, overflow: "hidden", padding: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.4, shadowRadius: 11 },
  hero: { alignItems: "center", flexDirection: "row" }, identity: { flex: 1, marginLeft: 13, minWidth: 0 }, name: { color: "#FFF0D8", fontSize: 24, fontWeight: "900" }, rank: { fontSize: 11, fontWeight: "900", letterSpacing: 0.8, marginBottom: 8, marginTop: 2 }, level: { color: "#D1AF7E", fontSize: 9, fontWeight: "900", marginBottom: 5 },
  metrics: { flexDirection: "row", gap: 6, marginTop: 12 }, metric: { alignItems: "center", backgroundColor: "rgba(37,22,18,0.9)", borderColor: "rgba(226,142,53,0.35)", borderRadius: 9, borderWidth: 1, flex: 1, padding: 8 }, metricValue: { color: "#FFD06A", fontSize: 15, fontWeight: "900" }, metricLabel: { color: "#A68A73", fontSize: 7, fontWeight: "900", marginTop: 2 },
  details: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 7 }, detail: { backgroundColor: "rgba(8,7,8,0.7)", borderRadius: 7, padding: 7, width: "49%" }, detailLabel: { color: "#9C7F68", fontSize: 7, fontWeight: "900" }, detailValue: { color: "#E8C99D", fontSize: 9, fontWeight: "900", marginTop: 2 },
});
