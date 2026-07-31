import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "../src/api";
import ArcadeBackground from "../src/game/ui/ArcadeBackground";
import FireButton from "../src/components/fire/FireButton";
import FireEmptyState from "../src/components/fire/FireEmptyState";
import FireLoading from "../src/components/fire/FireLoading";
import FirePanel from "../src/components/fire/FirePanel";
import { useAppPreferences } from "../src/preferences/AppPreferences";
import {
  formatCountdown,
  landingRotationForReward,
  responsiveWheelSize,
  serverCountdownMs,
  type DailySpinClaim,
  type DailySpinStatus,
} from "../src/retention/DailyRewards";

const BOARD_FOODS = ["🧀", "🍇", "🥖", "🫓", "🥩", "🍯", "🫒", "🧀", "🍇", "🌿"];
const SLICE_COLORS = ["#633018", "#85431F", "#573424", "#7B3A25", "#4F2A1B", "#8A5127", "#493425", "#71351E", "#614024", "#793D23"];
const MAX_ROTATION_DEGREES = 7 * 360;

type SpinPhase = "idle" | "claiming" | "spinning" | "finalizing";

function rewardLabel(kind: string, amount: number) {
  return `${amount} ${kind === "antacid" ? amount === 1 ? "Antacid" : "Antacids" : kind === "xp" ? "XP" : "Coins"}`;
}

export default function DailyRewardsScreen() {
  const router = useRouter();
  const { fromPrompt } = useLocalSearchParams<{ fromPrompt?: string }>();
  const { preferences } = useAppPreferences();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const rotation = useRef(new Animated.Value(0)).current;
  const responseReceivedAt = useRef(Date.now());
  const [status, setStatus] = useState<DailySpinStatus | null>(null);
  const [claim, setClaim] = useState<DailySpinClaim | null>(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<SpinPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const busy = phase !== "idle";
  const wheelSize = responsiveWheelSize(width, height - insets.top - insets.bottom);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await api.dailyStatus() as DailySpinStatus;
      responseReceivedAt.current = Date.now();
      setElapsed(0);
      setStatus(next);
    } catch {
      setError("The Charcuterie Board could not be loaded. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!status || status.eligible) return;
    const timer = setInterval(() => setElapsed(Date.now() - responseReceivedAt.current), 1000);
    return () => clearInterval(timer);
  }, [status]);
  useEffect(() => () => rotation.stopAnimation(), [rotation]);

  const countdown = useMemo(() => status
    ? formatCountdown(serverCountdownMs(status.server_time, status.next_daily_spin, elapsed))
    : "00:00:00", [elapsed, status]);

  const spin = useCallback(async () => {
    if (!status?.eligible || busy) return;
    setPhase("claiming");
    setError(null);
    try {
      const result = await api.dailyClaim() as DailySpinClaim;
      const rewardIndex = status.reward_slices.findIndex((slice) => slice.id === result.reward?.id);
      if (rewardIndex < 0 || result.reward_index !== rewardIndex) throw new Error("invalid daily reward response");
      const turns = preferences.reducedMotion ? 1 : 4 + Math.floor(Math.random() * 3);
      const target = landingRotationForReward(result.reward.id, status.reward_slices, turns);
      if (target === null) throw new Error("unknown daily reward");
      setPhase("spinning");
      rotation.setValue(0);
      Animated.timing(rotation, {
        toValue: target,
        duration: preferences.reducedMotion ? 450 : 3600 + Math.floor(Math.random() * 1200),
        easing: Easing.bezier(0.12, 0.72, 0.16, 1),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) {
          setPhase("idle");
          return;
        }
        setPhase("finalizing");
        setClaim(result);
        responseReceivedAt.current = Date.now();
        setElapsed(0);
        setStatus((current) => current ? {
          ...current,
          eligible: false,
          server_time: result.server_time,
          next_daily_spin: result.next_daily_spin,
          daily_spin_streak: result.daily_spin_streak,
          free_spins_available: 0,
        } : current);
        setPhase("idle");
      });
    } catch {
      setPhase("idle");
      setError("This spin could not be completed. Please retry after eligibility is refreshed.");
      void refresh();
    }
  }, [busy, preferences.reducedMotion, refresh, rotation, status]);

  const rotate = rotation.interpolate({
    inputRange: [0, MAX_ROTATION_DEGREES],
    outputRange: ["0deg", `${MAX_ROTATION_DEGREES}deg`],
  });

  if (loading && !status) return <View style={styles.screen}><ArcadeBackground /><FireLoading title="Preparing the Board..." subtitle="Checking today's free spin." /></View>;
  if (!status) return <View style={styles.screen}><ArcadeBackground /><FireEmptyState icon="!" title="Board Unavailable" message={error ?? "Please try again."} buttonLabel="RETRY" onPress={() => { void refresh(); }} /></View>;

  const center = wheelSize / 2;
  const itemSize = Math.max(42, Math.min(62, wheelSize * 0.19));
  const itemRadius = wheelSize * 0.36;
  const hubSize = wheelSize * 0.25;

  return <SafeAreaView style={styles.screen}><ArcadeBackground />
    <View style={styles.header}><FireButton title="BACK" size="compact" variant="ghost" onPress={() => router.back()} /><View style={styles.headerCopy}><Text accessibilityRole="header" numberOfLines={1} style={styles.title}>DAILY CHARCUTERIE BOARD</Text><Text style={styles.subtitle}>ONE FREE SPIN EVERY 24 HOURS</Text></View></View>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <FirePanel accent="gold" elevated highlighted style={styles.panel}>
        <View style={[styles.wheelStage, { height: wheelSize + 42 }]}>
          <View accessibilityLabel="Fixed reward pointer at twelve o'clock" pointerEvents="none" style={styles.pointer}>
            <View style={styles.pointerHandle} /><View style={styles.pointerTip} />
          </View>
          <View style={{ height: wheelSize, marginTop: 38, width: wheelSize }}>
          <Animated.View accessibilityLabel="Premium Charcuterie reward wheel" style={[styles.board, { borderRadius: wheelSize / 2, height: wheelSize, transform: [{ rotate }], width: wheelSize }]}>
            <LinearGradient colors={["#9B5A2A", "#713A1B", "#3D1D10"]} end={{ x: 1, y: 1 }} start={{ x: 0, y: 0 }} style={[StyleSheet.absoluteFill, { borderRadius: wheelSize / 2 }]} />
            <View style={[styles.innerRim, { borderRadius: wheelSize * 0.45, height: wheelSize * 0.9, left: wheelSize * 0.05, top: wheelSize * 0.05, width: wheelSize * 0.9 }]} />
            {status.reward_slices.map((slice, index) => <View key={`divider-${slice.id}`} pointerEvents="none" style={[styles.divider, {
              height: wheelSize * 0.43,
              left: center - 1,
              top: center - wheelSize * 0.43,
              transform: [{ rotate: `${index * (360 / status.reward_slices.length) - 180 / status.reward_slices.length}deg` }],
              transformOrigin: "50% 100%",
            }]} />)}
            {status.reward_slices.map((slice, index) => {
              const angle = (index / status.reward_slices.length) * Math.PI * 2 - Math.PI / 2;
              const selected = claim?.reward.id === slice.id;
              return <View key={slice.id} style={[styles.slice, selected && styles.winningSlice, {
                backgroundColor: SLICE_COLORS[index % SLICE_COLORS.length],
                borderRadius: itemSize * 0.24,
                height: itemSize,
                left: center + Math.cos(angle) * itemRadius - itemSize / 2,
                top: center + Math.sin(angle) * itemRadius - itemSize / 2,
                width: itemSize,
              }]}>
                <Text style={[styles.food, { fontSize: Math.max(17, wheelSize * 0.066) }]}>{BOARD_FOODS[index % BOARD_FOODS.length]}</Text>
                <Text numberOfLines={2} style={[styles.sliceText, { fontSize: wheelSize >= 300 ? 9 : 8 }]}>{rewardLabel(slice.kind, slice.amount)}</Text>
              </View>;
            })}
            <View style={[styles.boardCenter, { borderRadius: hubSize / 2, height: hubSize, left: center - hubSize / 2, top: center - hubSize / 2, width: hubSize }]}><Text style={[styles.flame, { fontSize: hubSize * 0.35 }]}>🔥</Text><Text style={styles.centerText}>FIRE FEAST</Text></View>
          </Animated.View>
          </View>
        </View>

        {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
        <FireButton disabled={!status.eligible || busy} fullWidth title={phase === "claiming" ? "CHECKING YOUR SPIN..." : phase === "spinning" || phase === "finalizing" ? "SERVING YOUR REWARD..." : status.eligible ? "SPIN NOW" : "FREE SPIN REDEEMED"} variant="gold" onPress={() => { void spin(); }} />
        {!status.eligible ? <View style={styles.countdown}><Text style={styles.countdownLabel}>NEXT FREE SPIN</Text><Text style={styles.countdownValue}>{countdown}</Text></View> : <Text style={styles.available}>YOUR COMPLIMENTARY BOARD IS READY</Text>}
        {fromPrompt === "1" && status.eligible && !busy ? <FireButton fullWidth title="MAYBE LATER" variant="ghost" onPress={() => router.back()} /> : null}

        {claim ? <View accessible accessibilityLiveRegion="polite" style={styles.rewardPanel}>
          <Text style={styles.won}>YOU WON!</Text><Text style={styles.rewardIcon}>{claim.reward.kind === "coins" ? "🪙" : claim.reward.kind === "xp" ? "✨" : "💊"}</Text>
          <Text style={styles.rewardText}>+{rewardLabel(claim.reward.kind, claim.reward.amount)}</Text>
          <Text style={styles.balanceText}>Coins {claim.player.coins ?? 0}  ·  XP {claim.player.xp ?? 0}  ·  Antacids {claim.player.antacid ?? 0}</Text>
          <FireButton fullWidth title="CONTINUE" size="compact" variant="secondary" onPress={() => router.back()} />
        </View> : null}
        <Text style={styles.streak}>DAILY STREAK: {status.daily_spin_streak} · CLOSED BETA FREE SPIN</Text>
      </FirePanel>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#070405", flex: 1 }, header: { alignItems: "center", flexDirection: "row", gap: 10, paddingHorizontal: 14, paddingTop: 4 }, headerCopy: { flex: 1 },
  title: { color: "#FFD06A", fontSize: 18, fontWeight: "900", letterSpacing: 0.5 }, subtitle: { color: "#B88D61", fontSize: 9, fontWeight: "900", letterSpacing: 1 }, content: { alignSelf: "center", flexGrow: 1, justifyContent: "center", maxWidth: 520, padding: 12, width: "100%" }, panel: { paddingHorizontal: 12 },
  wheelStage: { alignItems: "center", alignSelf: "center", justifyContent: "flex-start", position: "relative", width: "100%" },
  pointer: { alignItems: "center", height: 52, left: 0, position: "absolute", right: 0, top: 0, zIndex: 5 }, pointerHandle: { backgroundColor: "#D9D5CE", borderColor: "#FFF8E9", borderRadius: 5, borderWidth: 1, height: 26, shadowColor: "#000", shadowOpacity: 0.6, shadowRadius: 4, width: 10 }, pointerTip: { borderLeftColor: "transparent", borderLeftWidth: 15, borderRightColor: "transparent", borderRightWidth: 15, borderTopColor: "#E8C16C", borderTopWidth: 22, height: 0, marginTop: -2, width: 0 },
  board: { borderColor: "#D9A45B", borderWidth: 6, elevation: 12, overflow: "hidden", shadowColor: "#000", shadowOffset: { height: 8, width: 0 }, shadowOpacity: 0.55, shadowRadius: 12 }, innerRim: { borderColor: "rgba(255,220,154,0.36)", borderWidth: 2, position: "absolute" }, divider: { backgroundColor: "rgba(255,220,154,0.28)", position: "absolute", width: 2 },
  slice: { alignItems: "center", borderColor: "rgba(255,222,166,0.42)", borderWidth: 1, justifyContent: "center", paddingHorizontal: 2, position: "absolute", shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 2 }, winningSlice: { borderColor: "#FFF0A8", borderWidth: 3, elevation: 8, shadowColor: "#FFD65A", shadowOpacity: 0.95, shadowRadius: 9 }, food: { lineHeight: 23 }, sliceText: { color: "#FFF7E7", fontWeight: "900", lineHeight: 10, textAlign: "center", textShadowColor: "#250E06", textShadowOffset: { height: 1, width: 0 }, textShadowRadius: 2 },
  boardCenter: { alignItems: "center", backgroundColor: "#271008", borderColor: "#F0BE6E", borderWidth: 3, justifyContent: "center", position: "absolute", shadowColor: "#000", shadowOpacity: 0.7, shadowRadius: 5 }, flame: { lineHeight: 27 }, centerText: { color: "#FFD06A", fontSize: 9, fontWeight: "900", letterSpacing: 0.4 },
  available: { color: "#D8B77D", fontSize: 9, fontWeight: "900", marginTop: 9, textAlign: "center" }, countdown: { alignItems: "center", marginTop: 10 }, countdownLabel: { color: "#C89A61", fontSize: 9, fontWeight: "900" }, countdownValue: { color: "#FFF0D8", fontSize: 20, fontVariant: ["tabular-nums"], fontWeight: "900", marginTop: 2 },
  rewardPanel: { alignItems: "center", backgroundColor: "rgba(91,39,12,0.94)", borderColor: "#FFD06A", borderRadius: 14, borderWidth: 1, marginTop: 12, padding: 12 }, won: { color: "#FFD06A", fontSize: 22, fontWeight: "900" }, rewardIcon: { fontSize: 30, marginTop: 2 }, rewardText: { color: "#FFF0D8", fontSize: 17, fontWeight: "900", marginBottom: 5 }, balanceText: { color: "#D8C5B3", fontSize: 10, marginBottom: 10, textAlign: "center" }, error: { color: "#FFAA91", fontSize: 11, marginBottom: 10, textAlign: "center" }, streak: { color: "#A98B70", fontSize: 9, fontWeight: "800", marginTop: 9, textAlign: "center" },
});
