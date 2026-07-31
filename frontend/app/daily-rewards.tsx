import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "../src/api";
import ArcadeBackground from "../src/game/ui/ArcadeBackground";
import FireButton from "../src/components/fire/FireButton";
import FireEmptyState from "../src/components/fire/FireEmptyState";
import FireLoading from "../src/components/fire/FireLoading";
import FirePanel from "../src/components/fire/FirePanel";
import { useAppPreferences } from "../src/preferences/AppPreferences";
import {
  formatCountdown,
  landingRotation,
  serverCountdownMs,
  type DailySpinClaim,
  type DailySpinStatus,
} from "../src/retention/DailyRewards";

const BOARD_FOODS = ["🧀", "🍇", "🥖", "🫓", "🥩", "🍯", "🫒", "🧀", "🍇", "🥖"];

export default function DailyRewardsScreen() {
  const router = useRouter();
  const { preferences } = useAppPreferences();
  const rotation = useRef(new Animated.Value(0)).current;
  const responseReceivedAt = useRef(Date.now());
  const [status, setStatus] = useState<DailySpinStatus | null>(null);
  const [claim, setClaim] = useState<DailySpinClaim | null>(null);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

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
    if (!status?.eligible || spinning) return;
    setSpinning(true);
    setError(null);
    try {
      const result = await api.dailyClaim() as DailySpinClaim;
      if (!result.reward || result.reward_index < 0 || result.reward_index >= status.reward_slices.length) {
        throw new Error("invalid daily reward response");
      }
      const turns = preferences.reducedMotion ? 1 : 5 + Math.floor(Math.random() * 3);
      const duration = preferences.reducedMotion ? 500 : 2600 + Math.floor(Math.random() * 900);
      const target = landingRotation(result.reward_index, status.reward_slices.length, turns);
      rotation.setValue(0);
      Animated.timing(rotation, {
        toValue: target,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
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
        }
        setSpinning(false);
      });
    } catch {
      setSpinning(false);
      setError("This spin could not be completed. Your availability and balances remain server controlled.");
      void refresh();
    }
  }, [preferences.reducedMotion, refresh, rotation, spinning, status]);

  const rotate = rotation.interpolate({ inputRange: [0, 360], outputRange: ["0deg", "360deg"] });

  if (loading && !status) return <View style={styles.screen}><ArcadeBackground /><FireLoading title="Preparing the Board..." subtitle="Checking today's free spin." /></View>;
  if (!status) return <View style={styles.screen}><ArcadeBackground /><FireEmptyState icon="!" title="Board Unavailable" message={error ?? "Please try again."} buttonLabel="RETRY" onPress={() => { void refresh(); }} /></View>;

  return <SafeAreaView style={styles.screen}><ArcadeBackground />
    <View style={styles.header}><FireButton title="BACK" size="compact" variant="ghost" onPress={() => router.back()} /><View><Text accessibilityRole="header" style={styles.title}>DAILY CHARCUTERIE BOARD</Text><Text style={styles.subtitle}>ONE FREE SPIN EVERY 24 HOURS</Text></View></View>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <FirePanel accent="gold" elevated highlighted>
        <View style={styles.pointer}><Text style={styles.pointerText}>🔪</Text></View>
        <Animated.View accessibilityLabel="Charcuterie reward board" style={[styles.board, { transform: [{ rotate }] }]}>
          {status.reward_slices.map((slice, index) => {
            const angle = (index / status.reward_slices.length) * Math.PI * 2 - Math.PI / 2;
            return <View key={slice.id} style={[styles.slice, { left: 119 + Math.cos(angle) * 91, top: 119 + Math.sin(angle) * 91 }]}>
              <Text style={styles.food}>{BOARD_FOODS[index % BOARD_FOODS.length]}</Text>
              <Text numberOfLines={2} style={styles.sliceText}>{slice.amount} {slice.kind === "antacid" ? "ANTACID" : slice.kind.toUpperCase()}</Text>
            </View>;
          })}
          <View style={styles.boardCenter}><Text style={styles.centerText}>FIRE{`\n`}FEAST</Text></View>
        </Animated.View>

        {claim ? <View accessible accessibilityLiveRegion="polite" style={styles.rewardPanel}><Text style={styles.won}>YOU WON!</Text><Text style={styles.rewardText}>{claim.reward.label}: +{claim.reward.amount} {claim.reward.kind.toUpperCase()}</Text><Text style={styles.balanceText}>Coins {claim.player.coins ?? 0}  ·  XP {claim.player.xp ?? 0}  ·  Antacids {claim.player.antacid ?? 0}</Text></View> : null}
        {!status.eligible ? <View style={styles.countdown}><Text style={styles.countdownLabel}>NEXT FREE SPIN:</Text><Text style={styles.countdownValue}>{countdown}</Text></View> : null}
        {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
        <FireButton disabled={!status.eligible || spinning} fullWidth title={spinning ? "SERVING YOUR REWARD..." : status.eligible ? "SPIN NOW" : "FREE SPIN REDEEMED"} variant="gold" onPress={() => { void spin(); }} />
        <Text style={styles.streak}>DAILY STREAK: {status.daily_spin_streak} · Closed Beta free spin</Text>
      </FirePanel>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#070405", flex: 1 }, header: { alignItems: "center", flexDirection: "row", gap: 12, paddingHorizontal: 14, paddingTop: 4 },
  title: { color: "#FFD06A", fontSize: 19, fontWeight: "900", letterSpacing: 0.6 }, subtitle: { color: "#B88D61", fontSize: 9, fontWeight: "900", letterSpacing: 1 }, content: { alignSelf: "center", maxWidth: 480, padding: 14, width: "100%" },
  pointer: { alignItems: "center", height: 42, marginBottom: -18, zIndex: 3 }, pointerText: { fontSize: 38, transform: [{ rotate: "135deg" }] },
  board: { alignSelf: "center", backgroundColor: "#7B401D", borderColor: "#D59A50", borderRadius: 145, borderWidth: 7, height: 290, marginBottom: 18, position: "relative", shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 10, width: 290 },
  slice: { alignItems: "center", justifyContent: "center", marginLeft: -26, marginTop: -26, position: "absolute", width: 52 }, food: { fontSize: 24 }, sliceText: { color: "#FFF0D2", fontSize: 7, fontWeight: "900", lineHeight: 9, textAlign: "center" },
  boardCenter: { alignItems: "center", backgroundColor: "#3B190D", borderColor: "#F0BE6E", borderRadius: 38, borderWidth: 3, height: 76, justifyContent: "center", left: 100, position: "absolute", top: 100, width: 76 }, centerText: { color: "#FFD06A", fontSize: 13, fontWeight: "900", textAlign: "center" },
  rewardPanel: { backgroundColor: "rgba(91,39,12,0.9)", borderColor: "#FFD06A", borderRadius: 12, borderWidth: 1, marginBottom: 12, padding: 12 }, won: { color: "#FFD06A", fontSize: 22, fontWeight: "900", textAlign: "center" }, rewardText: { color: "#FFF0D8", fontSize: 15, fontWeight: "900", marginTop: 4, textAlign: "center" }, balanceText: { color: "#D8C5B3", fontSize: 10, marginTop: 7, textAlign: "center" },
  countdown: { alignItems: "center", marginBottom: 12 }, countdownLabel: { color: "#C89A61", fontSize: 10, fontWeight: "900" }, countdownValue: { color: "#FFF0D8", fontSize: 24, fontVariant: ["tabular-nums"], fontWeight: "900", marginTop: 3 }, error: { color: "#FFAA91", fontSize: 11, marginBottom: 10, textAlign: "center" }, streak: { color: "#A98B70", fontSize: 9, fontWeight: "800", marginTop: 9, textAlign: "center" },
});
