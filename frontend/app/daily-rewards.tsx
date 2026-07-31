import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Image, type ImageSourcePropType, ScrollView, StyleSheet, Text, View, type ImageStyle, type StyleProp } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "../src/api";
import ArcadeBackground from "../src/game/ui/ArcadeBackground";
import FireButton from "../src/components/fire/FireButton";
import FireEmptyState from "../src/components/fire/FireEmptyState";
import FireLoading from "../src/components/fire/FireLoading";
import FirePanel from "../src/components/fire/FirePanel";
import { useAppPreferences } from "../src/preferences/AppPreferences";
import { DAILY_REWARD_ARTWORK } from "../src/assets/daily-rewards/artwork";
import {
  formatCountdown,
  landingRotation,
  serverCountdownMs,
  type DailySpinClaim,
  type DailySpinStatus,
} from "../src/retention/DailyRewards";

function ArtworkImage({ source, style, resizeMode = "contain" }: { source: ImageSourcePropType | null; style: StyleProp<ImageStyle>; resizeMode?: "contain" | "cover" }) {
  return source
    ? <Image resizeMode={resizeMode} source={source} style={style} />
    : <View pointerEvents="none" style={[style, styles.invisibleArtwork]} />;
}

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
    <ArtworkImage resizeMode="cover" source={DAILY_REWARD_ARTWORK.background} style={styles.backgroundArtwork} />
    <View style={styles.header}><FireButton title="BACK" size="compact" variant="ghost" onPress={() => router.back()} /><View><Text accessibilityRole="header" style={styles.title}>DAILY CHARCUTERIE BOARD</Text><Text style={styles.subtitle}>ONE FREE SPIN EVERY 24 HOURS</Text></View></View>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <FirePanel accent="gold" elevated highlighted>
        <View style={styles.wheelStage}>
          <ArtworkImage source={DAILY_REWARD_ARTWORK.decorations.grapesTopLeft} style={[styles.decoration, styles.grapesTopLeft]} />
          <ArtworkImage source={DAILY_REWARD_ARTWORK.decorations.salamiTopRight} style={[styles.decoration, styles.salamiTopRight]} />
          <ArtworkImage source={DAILY_REWARD_ARTWORK.decorations.olivesBottomLeft} style={[styles.decoration, styles.olivesBottomLeft]} />
          <ArtworkImage source={DAILY_REWARD_ARTWORK.decorations.cheeseBottomRight} style={[styles.decoration, styles.cheeseBottomRight]} />
          <ArtworkImage source={claim ? DAILY_REWARD_ARTWORK.winnerGlow : null} style={styles.winnerGlow} />
          <Animated.View accessibilityLabel="Charcuterie reward board" style={[styles.board, { transform: [{ rotate }] }]}>
          <ArtworkImage source={DAILY_REWARD_ARTWORK.wheel} style={styles.wheelArtwork} />
          {status.reward_slices.map((slice, index) => {
            const angle = (index / status.reward_slices.length) * Math.PI * 2 - Math.PI / 2;
            return <View key={slice.id} style={[styles.slice, { left: 119 + Math.cos(angle) * 91, top: 119 + Math.sin(angle) * 91 }]}>
              <Text numberOfLines={2} style={styles.sliceText}>{slice.amount} {slice.kind === "antacid" ? "ANTACID" : slice.kind.toUpperCase()}</Text>
            </View>;
          })}
          </Animated.View>
          <ArtworkImage source={DAILY_REWARD_ARTWORK.hub} style={styles.hubArtwork} />
          <ArtworkImage source={DAILY_REWARD_ARTWORK.pointer} style={styles.pointerArtwork} />
        </View>

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
  screen: { backgroundColor: "#070405", flex: 1 }, invisibleArtwork: { opacity: 0 }, backgroundArtwork: { ...StyleSheet.absoluteFillObject }, header: { alignItems: "center", flexDirection: "row", gap: 12, paddingHorizontal: 14, paddingTop: 4 },
  title: { color: "#FFD06A", fontSize: 19, fontWeight: "900", letterSpacing: 0.6 }, subtitle: { color: "#B88D61", fontSize: 9, fontWeight: "900", letterSpacing: 1 }, content: { alignSelf: "center", maxWidth: 480, padding: 14, width: "100%" },
  wheelStage: { alignSelf: "center", height: 332, position: "relative", width: 332 }, board: { height: 290, left: 21, position: "absolute", top: 28, width: 290 }, wheelArtwork: { height: 290, left: 0, position: "absolute", top: 0, width: 290 },
  slice: { alignItems: "center", justifyContent: "center", marginLeft: -26, marginTop: -10, position: "absolute", width: 52 }, sliceText: { color: "#FFF0D2", fontSize: 8, fontWeight: "900", lineHeight: 10, textAlign: "center" },
  pointerArtwork: { height: 70, left: 131, position: "absolute", top: 0, width: 70, zIndex: 5 }, hubArtwork: { height: 76, left: 128, position: "absolute", top: 135, width: 76, zIndex: 4 }, winnerGlow: { height: 320, left: 6, position: "absolute", top: 13, width: 320, zIndex: 1 }, decoration: { height: 82, position: "absolute", width: 82, zIndex: 0 }, grapesTopLeft: { left: 0, top: 18 }, salamiTopRight: { right: 0, top: 22 }, olivesBottomLeft: { bottom: 0, left: 0 }, cheeseBottomRight: { bottom: 0, right: 0 },
  rewardPanel: { backgroundColor: "rgba(91,39,12,0.9)", borderColor: "#FFD06A", borderRadius: 12, borderWidth: 1, marginBottom: 12, padding: 12 }, won: { color: "#FFD06A", fontSize: 22, fontWeight: "900", textAlign: "center" }, rewardText: { color: "#FFF0D8", fontSize: 15, fontWeight: "900", marginTop: 4, textAlign: "center" }, balanceText: { color: "#D8C5B3", fontSize: 10, marginTop: 7, textAlign: "center" },
  countdown: { alignItems: "center", marginBottom: 12 }, countdownLabel: { color: "#C89A61", fontSize: 10, fontWeight: "900" }, countdownValue: { color: "#FFF0D8", fontSize: 24, fontVariant: ["tabular-nums"], fontWeight: "900", marginTop: 3 }, error: { color: "#FFAA91", fontSize: 11, marginBottom: 10, textAlign: "center" }, streak: { color: "#A98B70", fontSize: 9, fontWeight: "800", marginTop: 9, textAlign: "center" },
});
