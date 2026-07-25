import React, { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import FireButton from "../../components/fire/FireButton";
import FireProgressBar from "../../components/fire/FireProgressBar";
import FireScreenEntrance from "../../components/fire/FireScreenEntrance";
import type { AchievementCompletionNotification } from "../../achievements/AchievementTypes";
import type { RestaurantUnlockNotification } from "../../restaurants/RestaurantTypes";
import type { TitleUnlockNotification } from "../../titles/TitleTypes";
import { BELTS, beltForXp } from "../../ranks";
import ResultBanner from "./ResultBanner";
import RewardSummaryCard from "./RewardSummaryCard";
import TournamentBanner from "./TournamentBanner";

export type VictoryTournamentPresentation = { name: string; bestScore: number; progress: number; rewardPreview?: string; rank?: number | null };

type VictoryOverlayProps = {
  result: "victory" | "defeat"; playerScore: number; opponentScore: number; opponentName?: string; opponentAvatar?: string; opponentPersonality?: string;
  contestName?: string; location?: string; difficulty?: string; roundLabel?: string; restaurantName?: string; restaurantLogoUrl?: string; city?: string; state?: string;
  verified?: boolean; sponsored?: boolean; sponsorName?: string; sponsorLogoUrl?: string; sponsorMessage?: string; highestCombo: number; foodName: string; matchTime: number;
  xpEarned?: number; coinsEarned?: number; currentXp?: number; achievements?: readonly AchievementCompletionNotification[]; restaurantUnlocks?: readonly RestaurantUnlockNotification[];
  titleUnlocks?: readonly TitleUnlockNotification[]; tournament?: VictoryTournamentPresentation | null;
  onReplay: () => void; onContinue: () => void; onBackToArena: () => void;
};

const VICTORY_BANNERS = ["VICTORY!", "DOMINATING PERFORMANCE!", "WHAT A FEAST!", "CHAMPION!", "UNSTOPPABLE!"] as const;
const VICTORY_CONFETTI = [
  { left: "8%", delay: 0, drift: -18, color: "#FFD06A" },
  { left: "20%", delay: 90, drift: 14, color: "#FF6A2A" },
  { left: "33%", delay: 35, drift: -10, color: "#FFF0B8" },
  { left: "47%", delay: 145, drift: 18, color: "#FF9C35" },
  { left: "61%", delay: 60, drift: -16, color: "#FFD06A" },
  { left: "74%", delay: 120, drift: 12, color: "#FF6A2A" },
  { left: "88%", delay: 20, drift: -12, color: "#FFF0B8" },
] as const;
let lastVictoryBanner = "";

const chooseBanner = () => {
  const choices = VICTORY_BANNERS.filter((banner) => banner !== lastVictoryBanner);
  const banner = choices[Math.floor(Math.random() * choices.length)] ?? VICTORY_BANNERS[0];
  lastVictoryBanner = banner;
  return banner;
};

export default function VictoryOverlay(props: VictoryOverlayProps) {
  const { result, playerScore, opponentScore, opponentName = "Opponent", opponentAvatar, opponentPersonality, contestName, location, difficulty, roundLabel, restaurantName, restaurantLogoUrl, city, state, verified, sponsored, sponsorName, sponsorLogoUrl, sponsorMessage, highestCombo, foodName, matchTime, xpEarned = result === "victory" ? 120 : 0, coinsEarned = result === "victory" ? 50 : 0, currentXp = 0, achievements = [], restaurantUnlocks = [], titleUnlocks = [], tournament, onReplay, onContinue, onBackToArena } = props;
  const insets = useSafeAreaInsets();
  const [reducedMotion, setReducedMotion] = useState(false);
  const [stage, setStage] = useState(0);
  const [noticeIndex, setNoticeIndex] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const mounted = useRef(true);
  const banner = useMemo(() => result === "victory" ? chooseBanner() : "DEFEAT", [result]);
  const noticeOpacity = useRef(new Animated.Value(0)).current;
  const noticeY = useRef(new Animated.Value(0)).current;
  const celebration = useRef(new Animated.Value(0)).current;
  const isComplete = stage >= 5;
  const notices = useMemo(() => [
    ...achievements.map((item) => ({ key: `achievement:${item.achievementId}`, eyebrow: "ACHIEVEMENT UNLOCKED", title: item.title, detail: `REWARD  ${item.reward.coins} COINS · ${item.reward.xp} XP`, color: "#FFD06A" })),
    ...restaurantUnlocks.map((item) => ({ key: `restaurant:${item.restaurantId}`, eyebrow: "NEW RESTAURANT UNLOCKED", title: item.restaurantName, detail: item.theme, color: "#FF9F43" })),
    ...titleUnlocks.map((item) => ({ key: `title:${item.titleId}`, eyebrow: "NEW TITLE UNLOCKED", title: item.titleName, detail: `${item.rarity} · EQUIP LATER`, color: item.colorTheme })),
  ], [achievements, restaurantUnlocks, titleUnlocks]);
  const activeNotice = notices[noticeIndex] ?? null;
  const gainedBelts = useMemo(() => BELTS.filter((belt) => belt.min_xp > currentXp && belt.min_xp <= currentXp + xpEarned), [currentXp, xpEarned]);

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const complete = () => { clearTimers(); noticeOpacity.stopAnimation(); noticeY.stopAnimation(); setStage(5); setNoticeIndex(Math.max(0, notices.length - 1)); };

  useEffect(() => {
    mounted.current = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => { if (mounted.current) setReducedMotion(enabled); });
    AccessibilityInfo.announceForAccessibility(result === "victory" ? "Victory. Match rewards are being revealed." : "Match complete. Defeat.");
    return () => { mounted.current = false; clearTimers(); noticeOpacity.stopAnimation(); noticeY.stopAnimation(); };
  }, [noticeOpacity, noticeY, result]);

  useEffect(() => {
    celebration.stopAnimation();
    celebration.setValue(reducedMotion ? 1 : 0);
    if (reducedMotion) return;
    const animation = Animated.timing(celebration, {
      toValue: 1,
      duration: result === "victory" ? 1450 : 720,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [celebration, reducedMotion, result]);

  useEffect(() => {
    clearTimers();
    if (reducedMotion) { setStage(5); return; }
    [[350, 1], [1050, 2], [1550, 3], [2100, 4], [4700, 5]].forEach(([delay, nextStage]) => {
      timers.current.push(setTimeout(() => { if (mounted.current) setStage(nextStage); }, delay));
    });
    return clearTimers;
  }, [reducedMotion, result]);

  useEffect(() => {
    if (stage < 4 || !notices.length || isComplete) return;
    setNoticeIndex(0);
    const noticeTimers = notices.slice(1).map((_, index) => setTimeout(() => { if (mounted.current) setNoticeIndex(index + 1); }, (index + 1) * 520));
    timers.current.push(...noticeTimers);
    return () => noticeTimers.forEach(clearTimeout);
  }, [isComplete, notices, stage]);

  useEffect(() => {
    noticeOpacity.stopAnimation(); noticeY.stopAnimation(); noticeOpacity.setValue(0); noticeY.setValue(reducedMotion ? 0 : 8);
    if (!activeNotice || stage < 4) return;
    const animation = Animated.parallel([
      Animated.sequence([
        Animated.timing(noticeOpacity, { toValue: 1, duration: reducedMotion ? 0 : 150, useNativeDriver: true }),
        Animated.delay(280),
        Animated.timing(noticeOpacity, { toValue: isComplete ? 1 : 0, duration: reducedMotion ? 0 : 120, useNativeDriver: true }),
      ]),
      Animated.timing(noticeY, { toValue: 0, duration: reducedMotion ? 0 : 180, useNativeDriver: true }),
    ]);
    animation.start();
    AccessibilityInfo.announceForAccessibility(`${activeNotice.eyebrow}. ${activeNotice.title}. ${activeNotice.detail}.`);
    return () => animation.stop();
  }, [activeNotice, isComplete, noticeOpacity, noticeY, reducedMotion, stage]);

  useEffect(() => {
    if (stage === 2 && xpEarned > 0) AccessibilityInfo.announceForAccessibility(`${xpEarned} XP earned.`);
    if (stage === 3 && coinsEarned > 0) AccessibilityInfo.announceForAccessibility(`${coinsEarned} coins earned.`);
  }, [coinsEarned, stage, xpEarned]);

  return (
    <View accessibilityViewIsModal importantForAccessibility="yes" style={[styles.overlay, result === "victory" ? styles.victoryOverlay : styles.defeatOverlay]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.resultLighting,
          result === "defeat" && styles.defeatLighting,
          {
            opacity: celebration.interpolate({
              inputRange: [0, 0.16, 1],
              outputRange: result === "victory" ? [0.72, 0.28, 0.08] : [0.26, 0.14, 0.06],
            }),
            transform: [{ scale: celebration.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1.28] }) }],
          },
        ]}
      />
      {!isComplete ? <Pressable accessibilityRole="button" accessibilityLabel="Skip victory presentation" onPress={complete} style={[styles.skip, { top: Math.max(insets.top, 10) }]}><Text style={styles.skipText}>SKIP</Text></Pressable> : null}
      {!reducedMotion && result === "victory" ? <View pointerEvents="none" style={styles.confetti}>{VICTORY_CONFETTI.map((item, index) => <Animated.View key={item.left} style={[styles.spark, { backgroundColor: item.color, left: item.left, opacity: celebration.interpolate({ inputRange: [0, 0.1 + item.delay / 2400, 0.82, 1], outputRange: [0, 0.9, 0.7, 0] }), transform: [{ translateX: celebration.interpolate({ inputRange: [0, 1], outputRange: [0, item.drift] }) }, { translateY: celebration.interpolate({ inputRange: [0, 1], outputRange: [-30 - index * 5, 580 + index * 18] }) }, { rotate: `${18 + index * 31}deg` }] }]} />)}</View> : null}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingTop: Math.max(insets.top, 10), paddingBottom: Math.max(insets.bottom, 10) }]}>
        <View style={styles.content}>
          <TournamentBanner eventTitle="FIRE FEAST WORLD TOUR" contestName={contestName} location={location} food={foodName} difficulty={difficulty} roundLabel={roundLabel} variant="compact" restaurantName={restaurantName} restaurantLogoUrl={restaurantLogoUrl} city={city} state={state} verified={verified} sponsored={sponsored} sponsorName={sponsorName} sponsorLogoUrl={sponsorLogoUrl} sponsorMessage={sponsorMessage} showPartnerDetails />
          <ResultBanner result={result} bannerText={banner} playerScore={playerScore} opponentScore={opponentScore} opponentName={opponentName} opponentAvatar={opponentAvatar} opponentPersonality={opponentPersonality} scoresRevealed={stage >= 1} reducedMotion={reducedMotion} />
          <RewardSummaryCard result={result} coins={coinsEarned} xp={xpEarned} highestCombo={highestCombo} foodName={foodName} matchTime={matchTime} showCombo={stage >= 1} showXp={stage >= 2} showCoins={stage >= 3} immediate={reducedMotion || isComplete} />
          {stage >= 2 && gainedBelts.length ? <FireScreenEntrance disabled={reducedMotion} distance={6} scaleFrom={0.96} style={styles.rankUp}><View accessible accessibilityLabel={`Belt rank up. ${gainedBelts.map((belt) => belt.name).join(", ")}.`}><Text style={styles.noticeEyebrow}>BELT RANK UP!</Text><Text style={[styles.rankName, { color: gainedBelts[gainedBelts.length - 1].color }]}>{beltForXp(currentXp + xpEarned).name.toUpperCase()}</Text>{gainedBelts.length > 1 ? <Text style={styles.noticeDetail}>+{gainedBelts.length} RANKS</Text> : null}</View></FireScreenEntrance> : null}
          {stage >= 4 && activeNotice ? <Animated.View style={[styles.notice, { borderColor: activeNotice.color, opacity: reducedMotion || isComplete ? 1 : noticeOpacity, transform: [{ translateY: reducedMotion ? 0 : noticeY }] }]}><Text style={styles.noticeEyebrow}>{activeNotice.eyebrow}</Text><Text style={[styles.noticeTitle, { color: activeNotice.color }]}>{activeNotice.title.toUpperCase()}</Text><Text style={styles.noticeDetail}>{activeNotice.detail.toUpperCase()}</Text></Animated.View> : null}
          {stage >= 4 && tournament ? <View style={styles.tournamentProgress}><Text style={styles.noticeEyebrow}>{tournament.name.toUpperCase()}</Text><Text style={styles.tournamentScore}>BEST SCORE  {tournament.bestScore.toLocaleString()}{tournament.rank ? ` · RANK ${tournament.rank}` : ""}</Text><FireProgressBar value={tournament.progress * 100} label="TOURNAMENT PROGRESS" variant="xp" compact showValue />{tournament.rewardPreview ? <Text style={styles.noticeDetail}>{tournament.rewardPreview}</Text> : null}</View> : null}
          {isComplete ? <View style={styles.actions}><FireButton accessibilityLabel="Continue from match results" title="CONTINUE" size="medium" variant={result === "victory" ? "gold" : "primary"} fullWidth style={styles.continueButton} onPress={onContinue} /><View style={styles.secondaryActions}><FireButton title="REPLAY" size="compact" variant="secondary" style={styles.secondaryButton} onPress={onReplay} /><FireButton title="BACK TO ARENA" size="compact" variant="ghost" style={styles.secondaryButton} onPress={onBackToArena} /></View></View> : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 2000 }, victoryOverlay: { backgroundColor: "rgba(7,5,6,0.96)" }, defeatOverlay: { backgroundColor: "rgba(36,7,9,0.96)" },
  resultLighting: { alignSelf: "center", backgroundColor: "rgba(255,133,24,0.5)", borderRadius: 260, height: 420, position: "absolute", top: "5%", width: 420 },
  defeatLighting: { backgroundColor: "rgba(128,31,32,0.32)" },
  scrollContent: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 15 }, content: { alignItems: "center", alignSelf: "center", maxWidth: 420, width: "100%" },
  skip: { backgroundColor: "rgba(17,9,9,0.9)", borderColor: "#B98550", borderRadius: 15, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 7, position: "absolute", right: 14, zIndex: 30 }, skipText: { color: "#F2D0A2", fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  confetti: { ...StyleSheet.absoluteFillObject, overflow: "hidden" }, spark: { borderRadius: 2, height: 9, position: "absolute", top: 0, width: 4 },
  rankUp: { alignItems: "center", backgroundColor: "rgba(27,18,15,0.98)", borderColor: "#FFD06A", borderRadius: 10, borderWidth: 1, marginTop: 6, padding: 7, width: "100%" }, rankName: { fontSize: 15, fontWeight: "900", marginTop: 2 },
  notice: { alignItems: "center", backgroundColor: "rgba(31,14,11,0.98)", borderRadius: 11, borderWidth: 1.5, marginTop: 6, paddingHorizontal: 12, paddingVertical: 8, width: "100%" }, noticeEyebrow: { color: "#E7B565", fontSize: 8, fontWeight: "900", letterSpacing: 1.1, textAlign: "center" }, noticeTitle: { fontSize: 16, fontWeight: "900", marginTop: 2, textAlign: "center" }, noticeDetail: { color: "#BFA080", fontSize: 7, fontWeight: "800", marginTop: 2, textAlign: "center" },
  tournamentProgress: { backgroundColor: "rgba(16,11,12,0.98)", borderColor: "rgba(226,147,55,0.55)", borderRadius: 10, borderWidth: 1, marginTop: 6, padding: 8, width: "100%" }, tournamentScore: { color: "#FFF0D7", fontSize: 11, fontWeight: "900", marginBottom: 4, marginTop: 3, textAlign: "center" },
  actions: { marginTop: 3, width: "100%" }, continueButton: { marginBottom: 2, marginTop: 7 }, secondaryActions: { flexDirection: "row", gap: 8, justifyContent: "center", minWidth: 0 }, secondaryButton: { flex: 1, marginBottom: 0, marginTop: 0, minWidth: 0 },
});
