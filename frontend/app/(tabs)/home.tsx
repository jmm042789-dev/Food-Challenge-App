import React, { useCallback, useEffect, useState } from "react";
import { Image, Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, consumeBootstrapPlayer, Contest, parseContests } from "../../src/api";
import { getFoodArtwork } from "../../src/assets/foodArtwork";
import FireButton from "../../src/components/fire/FireButton";
import FireEmptyState from "../../src/components/fire/FireEmptyState";
import FireHeader from "../../src/components/fire/FireHeader";
import FireLoading from "../../src/components/fire/FireLoading";
import FirePanel from "../../src/components/fire/FirePanel";
import FireScreenEntrance from "../../src/components/fire/FireScreenEntrance";
import DailyMissionCard from "../../src/components/fire/DailyMissionCard";
import ArcadeBackground from "../../src/game/ui/ArcadeBackground";
import RestaurantIdentity from "../../src/game/ui/RestaurantIdentity";
import SponsorStrip from "../../src/game/ui/SponsorStrip";
import { BELTS, beltForXp, nextBelt } from "../../src/ranks";
import { useDailyMissions } from "../../src/missions/useDailyMissions";

type Player = { coins?: number; xp?: number };

const WELCOME_COIN = require("../../src/assets/icons/coin.png");
const WELCOME_ANTACID = require("../../src/assets/icons/antacid.png");
const WELCOME_XP = require("../../src/assets/icons/xp-crystal.png");

function WelcomeRewardModal({ visible, onDismiss }: { visible: boolean; onDismiss: () => void }) {
  const insets = useSafeAreaInsets();
  const rewards = [
    { label: "+200 Coins", source: WELCOME_COIN },
    { label: "+1 Antacid", source: WELCOME_ANTACID },
    { label: "+50 XP", source: WELCOME_XP },
  ];

  return (
    <Modal animationType="fade" onRequestClose={onDismiss} statusBarTranslucent transparent visible={visible}>
      <View accessibilityViewIsModal style={[styles.welcomeBackdrop, { paddingTop: Math.max(insets.top, 16), paddingBottom: Math.max(insets.bottom, 16) }]}>
        <FireScreenEntrance distance={8} scaleFrom={0.96} style={styles.welcomeEntrance}>
          <FirePanel accent="gold" elevated highlighted style={styles.welcomePanel}>
            <Text accessibilityRole="header" style={styles.welcomeTitle}>WELCOME TO FIRE FEAST</Text>
            <Text style={styles.welcomeEyebrow}>WELCOME REWARD</Text>
            <View style={styles.welcomeRewards}>
              {rewards.map((reward) => (
                <View accessible accessibilityLabel={reward.label} key={reward.label} style={styles.welcomeReward}>
                  <Image resizeMode="contain" source={reward.source} style={styles.welcomeRewardIcon} />
                  <Text style={styles.welcomeRewardText}>{reward.label}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.welcomeGuidance}>Tap Play to enter your first feast.</Text>
            <FireButton accessibilityLabel="Let's Feast" fullWidth onPress={onDismiss} title="LET’S FEAST" variant="gold" />
          </FirePanel>
        </FireScreenEntrance>
      </View>
    </Modal>
  );
}

function FeaturedContest({ contest, onEnter }: { contest: Contest; onEnter: () => void }) {
  const artwork = getFoodArtwork(contest.id);
  return (
    <FirePanel highlighted elevated borderColor={contest.color ?? "#F39A35"} style={styles.featuredPanel}>
      <View style={styles.featuredHeader}>
        <View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveText}>FEATURED CONTEST</Text></View>
        <Text style={styles.difficulty}>{contest.difficulty.toUpperCase()}</Text>
      </View>
      <View style={styles.featuredBody}>
        <View style={styles.heroArtWrap}>
          <View style={styles.artGlow} />
          <Image source={artwork.source} resizeMode="contain" style={[styles.heroArt, { transform: [{ scale: artwork.scale }] }]} />
        </View>
        <View style={styles.featuredInfo}>
          <Text numberOfLines={2} style={styles.featuredTitle}>{contest.name}</Text>
          <Text numberOfLines={1} style={styles.foodName}>{contest.food_emoji} {contest.food}</Text>
          <View style={styles.divider} />
          <Text style={styles.metaLabel}>PRIZE POOL</Text>
          <Text style={styles.prize}>${contest.prize_pool.toLocaleString()}</Text>
          <Text numberOfLines={1} style={styles.meta}>⌖ {contest.location}</Text>
          <Text style={styles.meta}>◷ {contest.duration_sec}s  ·  ENTRY {contest.entry_fee.toLocaleString()}</Text>
          <FireButton title="ENTER CONTEST" size="compact" variant="gold" fullWidth style={styles.enterButton} onPress={onEnter} />
        </View>
      </View>
      <RestaurantIdentity name={contest.restaurant_name} logoUrl={contest.restaurant_logo_url} city={contest.city} state={contest.state} address={contest.address} postalCode={contest.postal_code} verified={contest.verified} sponsored={contest.sponsored} websiteUrl={contest.restaurant_website_url} menuUrl={contest.menu_url} variant="standard" />
      <SponsorStrip name={contest.sponsor_name} logoUrl={contest.sponsor_logo_url} message={contest.sponsor_message} compact={false} />
    </FirePanel>
  );
}

function UpcomingContest({ contest, onEnter }: { contest: Contest; onEnter: () => void }) {
  const artwork = getFoodArtwork(contest.id);
  return (
    <FirePanel compact borderColor={contest.color ?? "rgba(218,126,45,0.62)"} style={styles.upcomingRow} onPress={onEnter}>
      <Image source={artwork.source} resizeMode="contain" style={styles.rowArt} />
      <View style={styles.rowInfo}>
        <Text numberOfLines={1} style={styles.rowTitle}>{contest.name}</Text>
        <Text numberOfLines={1} style={styles.rowMeta}>{contest.food} · {contest.duration_sec}s</Text>
        <Text style={styles.rowLocation} numberOfLines={1}>{contest.location}</Text>
      </View>
      <View style={styles.rowReward}>
        <Text style={styles.rowPrize}>${contest.prize_pool.toLocaleString()}</Text>
        <Text style={styles.rowEntry}>{contest.entry_fee.toLocaleString()} ENTRY</Text>
        <Text style={styles.chevron}>›</Text>
      </View>
    </FirePanel>
  );
}

export default function HomeScreen() {
  const isFocused = useIsFocused();
  const router = useRouter();
  const { welcome } = useLocalSearchParams<{ welcome?: string | string[] }>();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [contests, setContests] = useState<Contest[]>([]);
  const [player, setPlayer] = useState<Player>({ coins: 200, xp: 0 });
  const [showWelcome, setShowWelcome] = useState(welcome === "1");
  const { state: dailyMissionState, refresh: refreshMissions, claim: claimMission } = useDailyMissions();

  const dismissWelcome = useCallback(() => {
    setShowWelcome(false);
    router.setParams({ welcome: undefined });
  }, [router]);

  useFocusEffect(useCallback(() => {
    void refreshMissions();
  }, [refreshMissions]));

  useEffect(() => {
    let active = true;
    async function loadHome() {
      const cachedPlayer = consumeBootstrapPlayer();
      const playerRequest = cachedPlayer === undefined
        ? api.getPlayer()
        : Promise.resolve(cachedPlayer);
      const [contestResult, playerResult] = await Promise.allSettled([api.listContests(), playerRequest]);
      if (!active) return;
      if (contestResult.status === "fulfilled") setContests(parseContests(contestResult.value));
      if (playerResult.status === "fulfilled" && playerResult.value) setPlayer(playerResult.value as Player);
      setLoading(false);
    }
    loadHome();
    return () => { active = false; };
  }, []);

  if (loading) return <View style={styles.screen}><ArcadeBackground active={isFocused} /><FireLoading title="Loading Arena..." subtitle="Preparing today's contests." /><WelcomeRewardModal visible={showWelcome} onDismiss={dismissWelcome} /></View>;
  if (!contests.length) return <View style={styles.screen}><ArcadeBackground active={isFocused} /><FireEmptyState icon="!" title="No Contests Available" message="Check back again soon." /><WelcomeRewardModal visible={showWelcome} onDismiss={dismissWelcome} /></View>;

  const xp = Number(player.xp ?? 0) + (dailyMissionState?.claimedRewards.xp ?? 0);
  const coins = Number(player.coins ?? 0) + (dailyMissionState?.claimedRewards.coins ?? 0);
  const belt = beltForXp(xp);
  const next = nextBelt(xp);
  const level = Math.max(1, BELTS.findIndex((item) => item.key === belt.key) + 1);
  const nextLevelXp = next?.min_xp ?? Math.max(xp, 1);
  const [featured, ...upcoming] = contests;

  return (
    <View style={styles.screen}>
      <ArcadeBackground active={isFocused} />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 8) }]} showsVerticalScrollIndicator={false}>
        <FireScreenEntrance duration="fast" distance={8}>
          <FireHeader level={level} xp={xp} nextLevelXp={nextLevelXp} coins={coins} />
        </FireScreenEntrance>
        <FireScreenEntrance delay={60} duration="fast" distance={10}>
          <View style={styles.sectionHeading}>
            <Text style={styles.eyebrow}>TONIGHT'S MAIN EVENT</Text>
            <View style={styles.headingLine} />
          </View>
          <FeaturedContest contest={featured} onEnter={() => router.push(`/play/${featured.id}`)} />
        </FireScreenEntrance>
        {dailyMissionState ? (
          <FireScreenEntrance delay={90} duration="fast" distance={8}>
            <FirePanel compact title="DAILY MISSIONS" subtitle="Three fresh challenges every day" style={styles.missionsPanel}>
              {dailyMissionState.missions.map((mission) => (
                <DailyMissionCard
                  key={mission.id}
                  icon={mission.icon}
                  title={mission.title}
                  progress={mission.currentProgress}
                  maxProgress={mission.goal}
                  reward={`+${mission.reward.coins} COINS  +${mission.reward.xp} XP`}
                  completed={mission.completed}
                  claimed={mission.claimed}
                  onClaim={() => { void claimMission(mission.id); }}
                />
              ))}
            </FirePanel>
          </FireScreenEntrance>
        ) : null}
        {upcoming.length ? (
          <View style={styles.upcomingSection}>
            <View style={styles.upcomingHeading}>
              <Text style={styles.upcomingTitle}>UPCOMING CONTESTS</Text>
              <Text style={styles.count}>{upcoming.length} EVENTS</Text>
            </View>
            {upcoming.map((contest) => <UpcomingContest key={contest.id} contest={contest} onEnter={() => router.push(`/play/${contest.id}`)} />)}
          </View>
        ) : null}
      </ScrollView>
      <WelcomeRewardModal visible={showWelcome} onDismiss={dismissWelcome} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#070405", flex: 1 },
  content: { paddingBottom: 22, paddingHorizontal: 12 },
  sectionHeading: { alignItems: "center", flexDirection: "row", marginBottom: 6, marginTop: 0 },
  eyebrow: { color: "#F4C06C", fontSize: 10, fontWeight: "900", letterSpacing: 1.6 },
  headingLine: { backgroundColor: "rgba(239,143,49,0.42)", flex: 1, height: 1, marginLeft: 9 },
  featuredPanel: { borderRadius: 14, paddingHorizontal: 10, paddingVertical: 10 },
  missionsPanel: { marginTop: 10 },
  featuredHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  liveBadge: { alignItems: "center", flexDirection: "row" },
  liveDot: { backgroundColor: "#FF5C28", borderRadius: 4, height: 7, marginRight: 5, width: 7 },
  liveText: { color: "#F6C76A", fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  difficulty: { color: "#C9A98D", fontSize: 8, fontWeight: "900", letterSpacing: 0.8 },
  featuredBody: { alignItems: "stretch", flexDirection: "row", minHeight: 218 },
  heroArtWrap: { alignItems: "center", justifyContent: "center", marginLeft: -14, width: "48%" },
  artGlow: { backgroundColor: "rgba(213,67,13,0.16)", borderRadius: 90, height: 170, position: "absolute", width: 170 },
  heroArt: { height: 205, width: 205 },
  featuredInfo: { flex: 1, justifyContent: "center", minWidth: 0, paddingLeft: 3 },
  featuredTitle: { color: "#FFF3DE", fontSize: 19, fontWeight: "900", lineHeight: 21, textTransform: "uppercase" },
  foodName: { color: "#EAB660", fontSize: 11, fontWeight: "800", marginTop: 4 },
  divider: { backgroundColor: "rgba(237,144,53,0.38)", height: 1, marginVertical: 7 },
  metaLabel: { color: "#A98B75", fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  prize: { color: "#FFBF4B", fontSize: 24, fontWeight: "900", lineHeight: 27 },
  meta: { color: "#D8C5B3", fontSize: 9, fontWeight: "700", marginTop: 3 },
  enterButton: { marginBottom: 0, marginTop: 7 },
  upcomingSection: { marginTop: 11 },
  upcomingHeading: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 6, paddingHorizontal: 2 },
  upcomingTitle: { color: "#F3D2A0", fontSize: 11, fontWeight: "900", letterSpacing: 1.1 },
  count: { color: "#B77B43", fontSize: 8, fontWeight: "900", letterSpacing: 0.8 },
  upcomingRow: { alignItems: "center", borderRadius: 11, flexDirection: "row", marginBottom: 6, minHeight: 64, paddingHorizontal: 7, paddingVertical: 4 },
  rowArt: { height: 58, marginLeft: -2, marginRight: 5, width: 58 },
  rowInfo: { flex: 1, minWidth: 0 },
  rowTitle: { color: "#FFF1DC", fontSize: 13, fontWeight: "900", textTransform: "uppercase" },
  rowMeta: { color: "#D19A55", fontSize: 9, fontWeight: "800", marginTop: 2 },
  rowLocation: { color: "#A99788", fontSize: 8, marginTop: 2 },
  rowReward: { alignItems: "flex-end", flexShrink: 0, marginLeft: 5, maxWidth: "30%", minWidth: 62, paddingRight: 12 },
  rowPrize: { color: "#FFC052", fontSize: 13, fontWeight: "900", maxWidth: "100%" },
  rowEntry: { color: "#A98C76", fontSize: 7, fontWeight: "900", marginTop: 2 },
  chevron: { color: "#E3903C", fontSize: 23, position: "absolute", right: -2, top: 4 },
  welcomeBackdrop: { alignItems: "center", backgroundColor: "rgba(7,4,5,0.92)", flex: 1, justifyContent: "center", paddingHorizontal: 16 },
  welcomeEntrance: { maxWidth: 400, width: "100%" },
  welcomePanel: { paddingHorizontal: 18, paddingVertical: 20 },
  welcomeTitle: { color: "#FFF3DE", fontSize: 24, fontWeight: "900", letterSpacing: 0.8, lineHeight: 29, textAlign: "center" },
  welcomeEyebrow: { color: "#E8A94F", fontSize: 9, fontWeight: "900", letterSpacing: 1.5, marginTop: 6, textAlign: "center" },
  welcomeRewards: { flexDirection: "row", gap: 7, justifyContent: "space-between", marginTop: 18 },
  welcomeReward: { alignItems: "center", backgroundColor: "rgba(83,39,17,0.55)", borderColor: "rgba(241,170,72,0.45)", borderRadius: 11, borderWidth: 1, flex: 1, minWidth: 0, paddingHorizontal: 4, paddingVertical: 10 },
  welcomeRewardIcon: { height: 34, width: 34 },
  welcomeRewardText: { color: "#FFD27D", fontSize: 10, fontWeight: "900", marginTop: 6, textAlign: "center" },
  welcomeGuidance: { color: "#D8C5B3", fontSize: 14, lineHeight: 20, marginTop: 18, textAlign: "center" },
});
