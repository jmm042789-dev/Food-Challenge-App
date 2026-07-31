import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "../src/api";
import FireButton from "../src/components/fire/FireButton";
import FireEmptyState from "../src/components/fire/FireEmptyState";
import FireLoading from "../src/components/fire/FireLoading";
import ArcadeBackground from "../src/game/ui/ArcadeBackground";
import { useAppPreferences } from "../src/preferences/AppPreferences";
import {
  formatCountdown,
  landingRotationForReward,
  responsiveWheelSize,
  serverCountdownMs,
  type DailySpinClaim,
  type DailySpinStatus,
} from "../src/retention/DailyRewards";

const MAX_ROTATION_DEGREES = 7 * 360;
const RESULT_REGION_HEIGHT = 174;
const WEDGE_ACCENTS = ["#D79A4B", "#A96340", "#8FA568", "#C88A55", "#BA704B", "#D1AA62", "#87956A", "#C78042", "#A86A56", "#B99A61"];

type SpinPhase = "idle" | "claiming" | "spinning" | "finalizing";

function rewardLabel(kind: string, amount: number) {
  return `${amount} ${kind === "antacid" ? amount === 1 ? "Antacid" : "Antacids" : kind === "xp" ? "XP" : "Coins"}`;
}

function rewardIcon(kind: string) {
  return kind === "coins" ? "●" : kind === "xp" ? "✦" : "+";
}

function TableDecorations({ wheelSize }: { wheelSize: number }) {
  const clusterScale = wheelSize < 280 ? 0.82 : 1;
  return <View pointerEvents="none" style={styles.decorLayer} testID="stationary-charcuterie-decorations">
    <View style={[styles.decorCluster, styles.decorTopLeft, { transform: [{ scale: clusterScale }] }]}><Text style={styles.decorLarge}>🍇</Text><Text style={styles.decorMedium}>🧀</Text><Text style={styles.herb}>🌿</Text></View>
    <View style={[styles.decorCluster, styles.decorTopRight, { transform: [{ scale: clusterScale }] }]}><Text style={styles.decorMedium}>🥩</Text><Text style={styles.decorLarge}>🥖</Text><Text style={styles.herb}>🌿</Text></View>
    <View style={[styles.decorCluster, styles.decorBottomLeft, { transform: [{ scale: clusterScale }] }]}><Text style={styles.decorMedium}>🫒</Text><Text style={styles.decorLarge}>🫓</Text><Text style={styles.garnish}>• • •</Text></View>
    <View style={[styles.decorCluster, styles.decorBottomRight, { transform: [{ scale: clusterScale }] }]}><Text style={styles.decorLarge}>🧀</Text><Text style={styles.decorMedium}>🍇</Text><Text style={styles.garnish}>🍯</Text></View>
  </View>;
}

export default function DailyRewardsScreen() {
  const router = useRouter();
  const { fromPrompt } = useLocalSearchParams<{ fromPrompt?: string }>();
  const { preferences } = useAppPreferences();
  const dimensions = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Freeze the stage after initial layout. Settlement/result state can never
  // recalculate this value or move the wheel center.
  const [wheelSize] = useState(() => responsiveWheelSize(
    dimensions.width,
    dimensions.height - insets.top - insets.bottom,
  ));
  const rotation = useRef(new Animated.Value(0)).current;
  const responseReceivedAt = useRef(Date.now());
  const [status, setStatus] = useState<DailySpinStatus | null>(null);
  const [claim, setClaim] = useState<DailySpinClaim | null>(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<SpinPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const busy = phase !== "idle";

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
        duration: preferences.reducedMotion ? 420 : 3800 + Math.floor(Math.random() * 1000),
        easing: Easing.bezier(0.16, 0.72, 0.12, 1),
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
  const labelWidth = Math.max(43, Math.min(58, wheelSize * 0.18));
  const labelRadius = wheelSize * 0.36;
  const hubSize = wheelSize * 0.25;

  return <SafeAreaView style={styles.screen}>
    <LinearGradient colors={["#120806", "#28130D", "#0B0505"]} end={{ x: 1, y: 1 }} start={{ x: 0, y: 0 }} style={StyleSheet.absoluteFill} />
    <View pointerEvents="none" style={styles.tableGlow} /><View pointerEvents="none" style={styles.tableGrain} />
    <View style={styles.header}><FireButton title="BACK" size="compact" variant="ghost" onPress={() => router.back()} /><View style={styles.headerCopy}><Text accessibilityRole="header" numberOfLines={1} style={styles.title}>DAILY CHARCUTERIE BOARD</Text><Text style={styles.subtitle}>ONE FREE SPIN EVERY 24 HOURS</Text></View></View>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.composition}>
        <View style={[styles.wheelStage, { height: wheelSize + 44 }]} testID="fixed-square-wheel-stage">
          <TableDecorations wheelSize={wheelSize} />
          <View accessibilityLabel="Fixed reward pointer at twelve o'clock" pointerEvents="none" style={styles.pointer} testID="fixed-twelve-oclock-pointer"><View style={styles.pointerHandle} /><View style={styles.pointerCollar} /><View style={styles.pointerTip} /></View>
          <View style={{ height: wheelSize, marginTop: 40, width: wheelSize }}>
            <Animated.View accessibilityLabel="Premium Charcuterie reward wheel" testID="rotation-only-reward-wheel" style={[styles.board, { borderRadius: wheelSize / 2, height: wheelSize, transform: [{ rotate }], width: wheelSize }]}>
              <LinearGradient colors={["#9A592B", "#713819", "#3B1B0D"]} end={{ x: 1, y: 1 }} start={{ x: 0, y: 0 }} style={[StyleSheet.absoluteFill, { borderRadius: wheelSize / 2 }]} />
              <View style={[styles.innerRim, { borderRadius: wheelSize * 0.45, height: wheelSize * 0.9, left: wheelSize * 0.05, top: wheelSize * 0.05, width: wheelSize * 0.9 }]} />
              {status.reward_slices.map((slice, index) => <View key={`divider-${slice.id}`} pointerEvents="none" style={[styles.divider, { height: wheelSize * 0.43, left: center - 1, top: center - wheelSize * 0.43, transform: [{ rotate: `${index * (360 / status.reward_slices.length) - 180 / status.reward_slices.length}deg` }], transformOrigin: "50% 100%" }]} />)}
              {status.reward_slices.map((slice, index) => {
                const angle = (index / status.reward_slices.length) * Math.PI * 2 - Math.PI / 2;
                const selected = claim?.reward.id === slice.id;
                return <View key={slice.id} style={[styles.sliceLabel, { left: center + Math.cos(angle) * labelRadius - labelWidth / 2, top: center + Math.sin(angle) * labelRadius - 24, width: labelWidth }]}>
                  <Text style={[styles.rewardMark, selected && styles.winningMark, { color: WEDGE_ACCENTS[index % WEDGE_ACCENTS.length] }]}>{rewardIcon(slice.kind)}</Text>
                  <Text numberOfLines={2} style={[styles.sliceText, selected && styles.winningText, { fontSize: wheelSize >= 300 ? 9 : 8 }]}>{rewardLabel(slice.kind, slice.amount)}</Text>
                </View>;
              })}
              <View style={[styles.boardCenter, { borderRadius: hubSize / 2, height: hubSize, left: center - hubSize / 2, top: center - hubSize / 2, width: hubSize }]}><Text style={[styles.flame, { fontSize: hubSize * 0.35 }]}>🔥</Text><Text style={styles.centerText}>FIRE FEAST</Text></View>
            </Animated.View>
          </View>
        </View>

        <View style={styles.controlsRegion}>
          {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : <View style={styles.errorPlaceholder} />}
          <FireButton disabled={!status.eligible || busy} fullWidth title={phase === "claiming" ? "CHECKING YOUR SPIN..." : phase === "spinning" || phase === "finalizing" ? "SERVING YOUR REWARD..." : status.eligible ? "SPIN NOW" : "FREE SPIN REDEEMED"} variant="gold" onPress={() => { void spin(); }} />
          {!status.eligible ? <View style={styles.availability}><Text style={styles.availabilityLabel}>NEXT FREE SPIN</Text><Text style={styles.countdownValue}>{countdown}</Text></View> : <View style={styles.availability}><Text style={styles.readyText}>YOUR COMPLIMENTARY BOARD IS READY</Text></View>}
          {fromPrompt === "1" && status.eligible && !busy ? <FireButton fullWidth title="MAYBE LATER" variant="ghost" onPress={() => router.back()} /> : <View style={styles.maybeLaterPlaceholder} />}
        </View>

        <View style={[styles.resultRegion, { height: RESULT_REGION_HEIGHT }]} testID="reserved-result-region">
          {claim ? <View accessible accessibilityLiveRegion="polite" style={styles.rewardPanel}><View style={styles.resultGarnish}><Text>🌿</Text><Text>🫒</Text></View><Text style={styles.won}>YOU WON!</Text><Text style={styles.rewardResultIcon}>{claim.reward.kind === "coins" ? "🪙" : claim.reward.kind === "xp" ? "✨" : "💊"}</Text><Text style={styles.rewardText}>+{rewardLabel(claim.reward.kind, claim.reward.amount)}</Text><Text style={styles.balanceText}>Coins {claim.player.coins ?? 0}  ·  XP {claim.player.xp ?? 0}  ·  Antacids {claim.player.antacid ?? 0}</Text><FireButton fullWidth title="CONTINUE" size="compact" variant="secondary" onPress={() => router.back()} /></View> : <View style={styles.resultPlaceholder}><Text style={styles.resultPlaceholderText}>THE BOARD IS SET</Text></View>}
        </View>
        <Text style={styles.streak}>DAILY STREAK: {status.daily_spin_streak} · CLOSED BETA FREE SPIN</Text>
      </View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#0B0505", flex: 1 }, tableGlow: { alignSelf: "center", backgroundColor: "rgba(194,111,42,0.11)", borderRadius: 260, height: 520, position: "absolute", top: 80, width: 520 }, tableGrain: { borderColor: "rgba(255,196,115,0.08)", borderRadius: 220, borderWidth: 1, height: 440, left: "10%", position: "absolute", top: 130, width: "80%" },
  header: { alignItems: "center", flexDirection: "row", gap: 10, paddingHorizontal: 14, paddingTop: 4 }, headerCopy: { flex: 1 }, title: { color: "#FFD06A", fontSize: 18, fontWeight: "900", letterSpacing: 0.5 }, subtitle: { color: "#B88D61", fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  content: { alignItems: "center", paddingBottom: 24, paddingTop: 8, width: "100%" }, composition: { alignItems: "center", maxWidth: 520, width: "100%" }, wheelStage: { alignItems: "center", justifyContent: "flex-start", position: "relative", width: "100%" },
  decorLayer: { bottom: 0, left: 0, position: "absolute", right: 0, top: 0, zIndex: 0 }, decorCluster: { alignItems: "center", flexDirection: "row", gap: 1, position: "absolute" }, decorTopLeft: { left: 2, top: 52 }, decorTopRight: { right: 2, top: 58 }, decorBottomLeft: { bottom: 14, left: 2 }, decorBottomRight: { bottom: 10, right: 2 }, decorLarge: { fontSize: 32 }, decorMedium: { fontSize: 25 }, herb: { fontSize: 22, transform: [{ rotate: "-28deg" }] }, garnish: { color: "#B98B5F", fontSize: 17, fontWeight: "900" },
  pointer: { alignItems: "center", height: 54, left: 0, position: "absolute", right: 0, top: 0, zIndex: 6 }, pointerHandle: { backgroundColor: "#D8D2C8", borderColor: "#FFF7E4", borderRadius: 5, borderWidth: 1, height: 22, shadowColor: "#000", shadowOpacity: 0.65, shadowRadius: 4, width: 9 }, pointerCollar: { backgroundColor: "#9B7543", borderColor: "#F2D698", borderRadius: 5, borderWidth: 1, height: 7, width: 18 }, pointerTip: { borderLeftColor: "transparent", borderLeftWidth: 14, borderRightColor: "transparent", borderRightWidth: 14, borderTopColor: "#E8C16C", borderTopWidth: 20, height: 0, width: 0 },
  board: { borderColor: "#D8A45C", borderWidth: 7, elevation: 12, overflow: "hidden", shadowColor: "#000", shadowOffset: { height: 8, width: 0 }, shadowOpacity: 0.58, shadowRadius: 12 }, innerRim: { borderColor: "rgba(255,220,154,0.38)", borderWidth: 2, position: "absolute" }, divider: { backgroundColor: "rgba(255,224,172,0.3)", position: "absolute", width: 2 },
  sliceLabel: { alignItems: "center", height: 48, justifyContent: "center", position: "absolute" }, rewardMark: { fontSize: 19, fontWeight: "900", lineHeight: 20, textShadowColor: "#1D0904", textShadowOffset: { height: 1, width: 0 }, textShadowRadius: 2 }, winningMark: { color: "#FFF1A8" }, sliceText: { color: "#FFF5E5", fontWeight: "900", lineHeight: 10, textAlign: "center", textShadowColor: "#240D05", textShadowOffset: { height: 1, width: 0 }, textShadowRadius: 2 }, winningText: { color: "#FFF4A8" },
  boardCenter: { alignItems: "center", backgroundColor: "#271008", borderColor: "#F0BE6E", borderWidth: 3, justifyContent: "center", position: "absolute", shadowColor: "#000", shadowOpacity: 0.7, shadowRadius: 5 }, flame: { lineHeight: 27 }, centerText: { color: "#FFD06A", fontSize: 9, fontWeight: "900", letterSpacing: 0.4 },
  controlsRegion: { minHeight: 154, paddingHorizontal: 18, width: "100%" }, error: { color: "#FFAA91", fontSize: 11, height: 18, marginBottom: 4, textAlign: "center" }, errorPlaceholder: { height: 22 }, availability: { alignItems: "center", height: 47, justifyContent: "center" }, availabilityLabel: { color: "#C89A61", fontSize: 9, fontWeight: "900" }, countdownValue: { color: "#FFF0D8", fontSize: 20, fontVariant: ["tabular-nums"], fontWeight: "900", marginTop: 2 }, readyText: { color: "#D8B77D", fontSize: 9, fontWeight: "900" }, maybeLaterPlaceholder: { height: 43 },
  resultRegion: { paddingHorizontal: 18, width: "100%" }, rewardPanel: { alignItems: "center", backgroundColor: "rgba(76,34,16,0.96)", borderColor: "#D9A45B", borderRadius: 16, borderWidth: 1, height: "100%", padding: 10, shadowColor: "#000", shadowOpacity: 0.42, shadowRadius: 8 }, resultGarnish: { flexDirection: "row", gap: 4, position: "absolute", right: 10, top: 8 }, won: { color: "#FFD06A", fontSize: 20, fontWeight: "900" }, rewardResultIcon: { fontSize: 27 }, rewardText: { color: "#FFF0D8", fontSize: 16, fontWeight: "900", marginBottom: 3 }, balanceText: { color: "#D8C5B3", fontSize: 10, marginBottom: 7, textAlign: "center" }, resultPlaceholder: { alignItems: "center", borderColor: "rgba(210,154,88,0.16)", borderRadius: 16, borderWidth: 1, height: "100%", justifyContent: "center" }, resultPlaceholderText: { color: "rgba(217,174,115,0.3)", fontSize: 9, fontWeight: "900", letterSpacing: 1.4 }, streak: { color: "#A98B70", fontSize: 9, fontWeight: "800", marginTop: 9, textAlign: "center" },
});
