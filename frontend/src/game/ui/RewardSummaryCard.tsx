import React, { useEffect, useRef } from "react";
import { Animated, Image, StyleSheet, Text, View } from "react-native";
import CinematicCount from "./CinematicCount";

type RewardSummaryCardProps = {
  result: "victory" | "defeat" | "draw";
  coins?: number;
  xp?: number;
  totalCoins: number;
  rewardReady: boolean;
  highestCombo: number;
  foodName: string;
  matchTime: number;
  showXp?: boolean;
  showCoins?: boolean;
  showCombo?: boolean;
  showTotal?: boolean;
  immediate?: boolean;
};

const COIN = require("../../assets/icons/coin.png");
const XP = require("../../assets/icons/xp-crystal.png");
const STREAK = require("../../assets/icons/win-streak.png");
const COIN_BURST = require("../../assets/ui/effects/coin-burst.png");
const XP_BURST = require("../../assets/ui/effects/xp-burst.png");
const SPARKLE = require("../../assets/ui/effects/sparkle.png");

function RewardRow({ icon, label, value, emphasized = false }: { icon: number; label: string; value: React.ReactNode; emphasized?: boolean }) {
  return (
    <View style={styles.row}>
      <View style={styles.iconFrame}><Image source={icon} resizeMode="contain" style={styles.icon} /></View>
      <Text style={styles.label}>{label}</Text>
      {typeof value === "string" ? <Text numberOfLines={1} style={[styles.value, emphasized && styles.emphasized]}>{value}</Text> : value}
    </View>
  );
}

function RewardEffect({ source, reducedMotion }: { source: number; reducedMotion: boolean }) {
  const progress = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;

  useEffect(() => {
    progress.stopAnimation();
    progress.setValue(reducedMotion ? 1 : 0);
    if (reducedMotion) return;
    const animation = Animated.timing(progress, { toValue: 1, duration: 620, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [progress, reducedMotion]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.rewardEffect,
        {
          opacity: progress.interpolate({ inputRange: [0, 0.18, 1], outputRange: [0, 0.9, 0] }),
          transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1.35] }) }],
        },
      ]}
    >
      <Image source={source} resizeMode="contain" style={styles.rewardEffectImage} />
      <Image source={SPARKLE} resizeMode="contain" style={styles.sparkle} />
    </Animated.View>
  );
}

export default function RewardSummaryCard({ result, coins, xp, totalCoins, rewardReady, highestCombo, foodName, matchTime, showXp = true, showCoins = true, showCombo = true, showTotal = true, immediate = false }: RewardSummaryCardProps) {
  return (
    <View style={[styles.card, result === "victory" ? styles.victoryCard : result === "draw" ? styles.drawCard : styles.defeatCard]}>
      <View style={styles.headingRow}>
        <Text style={styles.title}>MATCH REWARDS</Text>
        <Text style={styles.resultTag}>{result.toUpperCase()}</Text>
      </View>
      <View style={!showCoins ? styles.hidden : undefined}>
        {showCoins && rewardReady ? <RewardEffect source={COIN_BURST} reducedMotion={immediate} /> : null}
        <RewardRow icon={COIN} label="COINS EARNED" value={rewardReady && coins !== undefined ? <CinematicCount value={coins} active={showCoins} immediate={immediate} prefix="+" style={[styles.value, styles.emphasized]} /> : <Text style={styles.pending}>SYNCING</Text>} emphasized />
      </View>
      <View style={!showXp ? styles.hidden : undefined}>
        {showXp && rewardReady ? <RewardEffect source={XP_BURST} reducedMotion={immediate} /> : null}
        <RewardRow icon={XP} label="XP EARNED" value={rewardReady && xp !== undefined ? <CinematicCount value={xp} active={showXp} immediate={immediate} prefix="+" suffix=" XP" style={[styles.value, styles.emphasized]} /> : <Text style={styles.pending}>SYNCING</Text>} emphasized />
      </View>
      {rewardReady && showTotal ? <RewardRow icon={COIN} label="TOTAL COINS" value={totalCoins.toLocaleString()} /> : null}
      <View style={!showCombo ? styles.hidden : undefined}><RewardRow icon={STREAK} label="HIGHEST COMBO" value={<CinematicCount value={highestCombo} active={showCombo} immediate={immediate} prefix="x" style={styles.value} />} /></View>
      <View style={styles.detailRow}>
        <Text numberOfLines={1} style={styles.detail}>{foodName}</Text>
        <Text style={styles.detail}>MATCH TIME  {matchTime}s</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "rgba(13,9,10,0.98)", borderRadius: 14, borderWidth: 1, elevation: 7, marginTop: 8, padding: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.34, shadowRadius: 9, width: "100%" },
  victoryCard: { borderColor: "rgba(237,157,54,0.72)" },
  defeatCard: { borderColor: "rgba(176,67,57,0.72)" },
  drawCard: { borderColor: "rgba(185,162,117,0.65)" },
  headingRow: { alignItems: "center", borderBottomColor: "rgba(232,169,84,0.18)", borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", marginBottom: 5, paddingBottom: 6, paddingHorizontal: 2 },
  title: { color: "#F0CD96", fontSize: 10, fontWeight: "900", letterSpacing: 1.35 },
  resultTag: { color: "#B99A7D", fontSize: 8, fontWeight: "900", letterSpacing: 0.9 },
  row: { alignItems: "center", backgroundColor: "rgba(30,18,16,0.94)", borderColor: "rgba(225,148,65,0.32)", borderRadius: 9, borderWidth: 1, flexDirection: "row", minHeight: 40, marginTop: 5, paddingHorizontal: 8 },
  iconFrame: { alignItems: "center", backgroundColor: "rgba(7,6,7,0.82)", borderColor: "rgba(255,210,133,0.16)", borderRadius: 7, borderWidth: 1, height: 29, justifyContent: "center", marginRight: 8, width: 29 },
  icon: { height: 23, width: 23 },
  label: { color: "#DDC8B0", flex: 1, fontSize: 9, fontWeight: "900", letterSpacing: 0.75 },
  value: { color: "#FFF0D7", fontSize: 14, fontWeight: "900" },
  emphasized: { color: "#FFC657", fontSize: 17, textShadowColor: "rgba(255,126,24,0.55)", textShadowRadius: 6 },
  pending: { color: "#A99076", fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  hidden: { opacity: 0.18 },
  rewardEffect: { height: 70, position: "absolute", right: -3, top: -13, width: 70, zIndex: 4 },
  rewardEffectImage: { height: "100%", width: "100%" },
  sparkle: { height: 30, position: "absolute", right: 2, top: 0, width: 30 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 3, paddingTop: 6 },
  detail: { color: "#AF9887", flexShrink: 1, fontSize: 8, fontWeight: "800", letterSpacing: 0.25, maxWidth: "58%", textTransform: "uppercase" },
});
