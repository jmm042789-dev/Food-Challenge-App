import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "../src/api";
import FireButton from "../src/components/fire/FireButton";
import FireEmptyState from "../src/components/fire/FireEmptyState";
import FireLoading from "../src/components/fire/FireLoading";
import FirePanel from "../src/components/fire/FirePanel";
import { useAppPreferences } from "../src/preferences/AppPreferences";
import { DAILY_REWARD_ARTWORK, DAILY_REWARD_ARTWORK_VALIDITY } from "../src/assets/daily-rewards/artwork";
import {
  centerImageContentInSquare,
  formatCountdown,
  landingRotation,
  serverCountdownMs,
  rewardPosition,
  wheelStageSize,
  type DailySpinClaim,
  type DailySpinStatus,
} from "../src/retention/DailyRewards";

export default function DailyRewardsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { preferences } = useAppPreferences();
  const rotation = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
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
  useEffect(() => () => { rotation.stopAnimation(); glowOpacity.stopAnimation(); }, [glowOpacity, rotation]);

  const countdown = useMemo(() => status
    ? formatCountdown(serverCountdownMs(status.server_time, status.next_daily_spin, elapsed))
    : "00:00:00", [elapsed, status]);

  const spin = useCallback(async () => {
    if (!status?.eligible || spinning) return;
    setSpinning(true);
    setError(null);
    try {
      const result = await api.dailyClaim() as DailySpinClaim;
      const mappedIndex = status.reward_slices.findIndex((slice) => slice.id === result.reward?.id);
      if (!result.reward || mappedIndex < 0 || mappedIndex !== result.reward_index) {
        throw new Error("invalid daily reward response");
      }
      const turns = preferences.reducedMotion ? 0 : 5;
      const duration = preferences.reducedMotion ? 280 : 3200;
      const target = landingRotation(mappedIndex, status.reward_slices.length, turns);
      rotation.setValue(0);
      Animated.timing(rotation, {
        toValue: target,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setClaim(result);
          if (preferences.reducedMotion) Animated.sequence([
            Animated.timing(glowOpacity, { toValue: 0.7, duration: 100, useNativeDriver: true }),
            Animated.timing(glowOpacity, { toValue: 0, delay: 350, duration: 150, useNativeDriver: true }),
          ]).start();
          else Animated.sequence([
            Animated.timing(glowOpacity, { toValue: 0.82, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(glowOpacity, { toValue: 0, delay: 700, duration: 420, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          ]).start();
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
      glowOpacity.setValue(0);
      setSpinning(false);
      setError("This spin could not be completed. Your availability and balances remain server controlled.");
      void refresh();
    }
  }, [glowOpacity, preferences.reducedMotion, refresh, rotation, spinning, status]);

  const rotate = rotation.interpolate({ inputRange: [0, 360], outputRange: ["0deg", "360deg"] });

  if (loading && !status) return <View style={styles.screen}><FireLoading title="Preparing the Board..." subtitle="Checking today's free spin." /></View>;
  if (!status) return <View style={styles.screen}><FireEmptyState icon="!" title="Board Unavailable" message={error ?? "Please try again."} buttonLabel="RETRY" onPress={() => { void refresh(); }} /></View>;

  const stageSize = wheelStageSize(Math.min(width, 480) - 28);
  const wheelSize = stageSize * 0.88;
  const wheelInset = (stageSize - wheelSize) / 2;
  const hubSize = stageSize * 0.22;
  const pointerHeight = wheelSize * 0.32;
  const wheelImageLayout = centerImageContentInSquare({
    canvasWidth: DAILY_REWARD_ARTWORK.wheel.canvas.width,
    canvasHeight: DAILY_REWARD_ARTWORK.wheel.canvas.height,
    bounds: DAILY_REWARD_ARTWORK.wheel.contentBounds,
  }, wheelSize);
  const pointerScale = pointerHeight / DAILY_REWARD_ARTWORK.pointer.contentBounds.height;
  const pointerArtworkWidth = DAILY_REWARD_ARTWORK.pointer.canvas.width * pointerScale;
  const pointerArtworkHeight = DAILY_REWARD_ARTWORK.pointer.canvas.height * pointerScale;
  const pointerLayout = {
    height: pointerArtworkHeight,
    left: stageSize / 2 - (DAILY_REWARD_ARTWORK.pointer.contentBounds.x + DAILY_REWARD_ARTWORK.pointer.contentBounds.width / 2) * pointerScale,
    top: wheelInset - (DAILY_REWARD_ARTWORK.pointer.contentBounds.y + DAILY_REWARD_ARTWORK.pointer.contentBounds.height) * pointerScale,
    width: pointerArtworkWidth,
  };
  const hubImageLayout = centerImageContentInSquare({
    canvasWidth: DAILY_REWARD_ARTWORK.hub.canvas.width,
    canvasHeight: DAILY_REWARD_ARTWORK.hub.canvas.height,
    bounds: DAILY_REWARD_ARTWORK.hub.contentBounds,
  }, hubSize);

  return <SafeAreaView style={styles.screen}>
    <Image resizeMode="cover" source={DAILY_REWARD_ARTWORK.background} style={styles.backgroundArtwork} />
    <View style={styles.header}><FireButton title="BACK" size="compact" variant="ghost" onPress={() => router.back()} /><View><Text accessibilityRole="header" style={styles.title}>DAILY CHARCUTERIE BOARD</Text><Text style={styles.subtitle}>ONE FREE SPIN EVERY 24 HOURS</Text></View></View>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <FirePanel accent="gold" elevated highlighted>
        <View testID="board-scene" style={[styles.boardScene, { height: stageSize, width: stageSize }]}>
          {DAILY_REWARD_ARTWORK_VALIDITY.decorations ? <View pointerEvents="none" style={styles.decorationsLayer} testID="food-decorations">
            <Image resizeMode="contain" source={DAILY_REWARD_ARTWORK.decorations.grapesTopLeft} style={[styles.decoration, styles.grapesTopLeft]} testID="grapes-top-left" />
            <Image resizeMode="contain" source={DAILY_REWARD_ARTWORK.decorations.salamiTopRight} style={[styles.decoration, styles.salamiTopRight]} testID="salami-top-right" />
            <Image resizeMode="contain" source={DAILY_REWARD_ARTWORK.decorations.olivesBottomLeft} style={[styles.decoration, styles.olivesBottomLeft]} testID="olives-bottom-left" />
            <Image resizeMode="contain" source={DAILY_REWARD_ARTWORK.decorations.cheeseBottomRight} style={[styles.decoration, styles.cheeseBottomRight]} testID="cheese-bottom-right" />
          </View> : null}
          <View testID="wheel-stage" style={[styles.wheelStage, { height: stageSize, width: stageSize }]}>
          <Animated.View testID="rotating-wheel-assembly" accessibilityLabel="Charcuterie reward board" style={[styles.board, { height: wheelSize, left: wheelInset, top: wheelInset, width: wheelSize, transform: [{ rotate }] }]}>
          {DAILY_REWARD_ARTWORK_VALIDITY.wheel ? <Image testID="wheel-artwork" resizeMode="contain" source={DAILY_REWARD_ARTWORK.wheel.source} style={[styles.wheelArtwork, wheelImageLayout]} /> : null}
          {status.reward_slices.map((slice, index) => {
            const point = rewardPosition(index, status.reward_slices.length, wheelSize);
            return <View key={slice.id} style={[styles.slice, { left: point.left - wheelSize * 0.075, top: point.top - wheelSize * 0.04, transform: [{ rotate: `${point.angle}deg` }], width: wheelSize * 0.15 }]}>
              <Text numberOfLines={2} style={styles.sliceText}>{slice.amount}{"\n"}{slice.kind === "antacid" ? "ANTACID" : slice.kind.toUpperCase()}</Text>
            </View>;
          })}
          </Animated.View>
          {DAILY_REWARD_ARTWORK_VALIDITY.hub ? <Image testID="center-hub" resizeMode="contain" source={DAILY_REWARD_ARTWORK.hub.source} style={[styles.hubArtwork, hubImageLayout, { marginLeft: (stageSize - hubSize) / 2, marginTop: (stageSize - hubSize) / 2 }]} /> : null}
          {DAILY_REWARD_ARTWORK_VALIDITY.pointer ? <Image testID="knife-pointer" resizeMode="contain" source={DAILY_REWARD_ARTWORK.pointer.source} style={[styles.pointerArtwork, pointerLayout]} /> : null}
          {claim && DAILY_REWARD_ARTWORK_VALIDITY.winnerGlow ? <Animated.Image testID="winner-glow" resizeMode="contain" source={DAILY_REWARD_ARTWORK.winnerGlow} style={[styles.winnerGlow, { opacity: glowOpacity }]} /> : null}
          </View>
        </View>

        <View style={styles.resultSlot}>{claim ? <View accessible accessibilityLiveRegion="polite" style={styles.rewardPanel}><Text style={styles.won}>YOU WON!</Text><Text style={styles.rewardText}>{claim.reward.label}: +{claim.reward.amount} {claim.reward.kind.toUpperCase()}</Text><Text style={styles.balanceText}>Coins {claim.player.coins ?? 0} · XP {claim.player.xp ?? 0} · Antacids {claim.player.antacid ?? 0}</Text></View> : null}</View>
        {!status.eligible ? <View style={styles.countdown}><Text style={styles.countdownLabel}>NEXT FREE SPIN:</Text><Text style={styles.countdownValue}>{countdown}</Text></View> : null}
        {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
        <FireButton disabled={!status.eligible || spinning} fullWidth title={spinning ? "SERVING YOUR REWARD..." : status.eligible ? "SPIN NOW" : "FREE SPIN REDEEMED"} variant="gold" onPress={() => { void spin(); }} />
        <Text style={styles.streak}>DAILY STREAK: {status.daily_spin_streak} · Closed Beta free spin</Text>
      </FirePanel>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#070405", flex: 1 }, backgroundArtwork: { ...StyleSheet.absoluteFillObject, zIndex: 0 }, header: { alignItems: "center", flexDirection: "row", gap: 12, paddingHorizontal: 14, paddingTop: 4, zIndex: 1 },
  title: { color: "#FFD06A", fontSize: 19, fontWeight: "900", letterSpacing: 0.6 }, subtitle: { color: "#B88D61", fontSize: 9, fontWeight: "900", letterSpacing: 1 }, content: { alignSelf: "center", maxWidth: 480, padding: 14, width: "100%", zIndex: 1 },
  boardScene: { alignSelf: "center", position: "relative" }, decorationsLayer: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
  decoration: { opacity: 1, position: "absolute" }, grapesTopLeft: { height: "31%", left: 0, top: 0, width: "22%" }, salamiTopRight: { height: "22%", right: 0, top: 0, width: "29%" }, olivesBottomLeft: { bottom: 0, height: "27%", left: 0, width: "25%" }, cheeseBottomRight: { bottom: 0, height: "22%", right: 0, width: "31%" },
  wheelStage: { ...StyleSheet.absoluteFillObject, overflow: "visible", zIndex: 2 }, board: { overflow: "visible", position: "absolute", zIndex: 2 }, wheelArtwork: { opacity: 1, position: "absolute", top: 0 },
  slice: { alignItems: "center", justifyContent: "center", position: "absolute" }, sliceText: { color: "#FFF0D2", fontSize: 8, fontWeight: "900", lineHeight: 10, textAlign: "center", textShadowColor: "#210C03", textShadowOffset: { height: 1, width: 0 }, textShadowRadius: 2 },
  pointerArtwork: { opacity: 1, position: "absolute", zIndex: 5 }, hubArtwork: { opacity: 1, position: "absolute", zIndex: 4 }, winnerGlow: { ...StyleSheet.absoluteFillObject, zIndex: 6 }, resultSlot: { minHeight: 82 },
  rewardPanel: { backgroundColor: "rgba(91,39,12,0.9)", borderColor: "#FFD06A", borderRadius: 12, borderWidth: 1, marginBottom: 12, padding: 12 }, won: { color: "#FFD06A", fontSize: 22, fontWeight: "900", textAlign: "center" }, rewardText: { color: "#FFF0D8", fontSize: 15, fontWeight: "900", marginTop: 4, textAlign: "center" }, balanceText: { color: "#D8C5B3", fontSize: 10, marginTop: 7, textAlign: "center" },
  countdown: { alignItems: "center", marginBottom: 12 }, countdownLabel: { color: "#C89A61", fontSize: 10, fontWeight: "900" }, countdownValue: { color: "#FFF0D8", fontSize: 24, fontVariant: ["tabular-nums"], fontWeight: "900", marginTop: 3 }, error: { color: "#FFAA91", fontSize: 11, marginBottom: 10, textAlign: "center" }, streak: { color: "#A98B70", fontSize: 9, fontWeight: "800", marginTop: 9, textAlign: "center" },
});
