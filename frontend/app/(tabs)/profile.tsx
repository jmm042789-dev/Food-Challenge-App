import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { useIsFocused } from "@react-navigation/native";

import { api } from "../../src/api";
import { BELTS, beltForXp, nextBelt } from "../../src/ranks";
import FireBadge from "../../src/components/fire/FireBadge";
import FireProgressBar from "../../src/components/fire/FireProgressBar";
import FireScreenEntrance from "../../src/components/fire/FireScreenEntrance";
import ArcadeBackground from "../../src/game/ui/ArcadeBackground";
import AchievementPanel from "../../src/achievements/components/AchievementPanel";
import { useAchievements } from "../../src/achievements/useAchievements";
import RestaurantCollectionPanel from "../../src/restaurants/components/RestaurantCollectionPanel";
import RestaurantUnlockBanner from "../../src/restaurants/components/RestaurantUnlockBanner";
import { useRestaurantProgress } from "../../src/restaurants/useRestaurantProgress";
import TitleBrowserPanel from "../../src/titles/components/TitleBrowserPanel";
import TitleUnlockBanner from "../../src/titles/components/TitleUnlockBanner";
import { TITLE_BY_ID } from "../../src/titles/TitleCatalog";
import { useTitleProgress } from "../../src/titles/useTitleProgress";

const BLAZE = require("../../src/assets/characters/blaze.png");
const COIN = require("../../src/assets/icons/coin.png");
const ANTACID = require("../../src/assets/icons/antacid.png");

type Player = {
  username?: string;
  avatar_emoji?: string;
  country?: string;
  xp: number;
  coins: number;
  antacid: number;
  wins: number;
  losses: number;
  matches: number;
  best_score: number;
  longest_combo: number;
  streak_days: number;
  owned_gear: string[];
  equipped_gear: string | null;
};

type Gear = {
  id: string;
  name: string;
  icon?: string;
  rarity?: string;
  slot?: string;
  description?: string;
  perk?: string;
};

const FALLBACK_PLAYER: Player = {
  username: "Hungry Hero",
  avatar_emoji: "🍔",
  country: "🌎",
  xp: 0,
  coins: 200,
  antacid: 0,
  wins: 0,
  losses: 0,
  matches: 0,
  best_score: 0,
  longest_combo: 0,
  streak_days: 0,
  owned_gear: [],
  equipped_gear: null,
};

function Counter({ source, label, value }: { source: number; label: string; value: number }) {
  return (
    <View style={styles.counter}>
      <Image source={source} resizeMode="contain" style={styles.counterIcon} />
      <View>
        <Text style={styles.counterLabel}>{label}</Text>
        <Text style={styles.counterValue}>{Number(value || 0).toLocaleString()}</Text>
      </View>
    </View>
  );
}

function StatTile({ label, value, accent = false }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <View style={styles.statTile}>
      <View style={styles.tileHighlight} pointerEvents="none" />
      <Text numberOfLines={1} style={[styles.statValue, accent && styles.statAccent]}>{typeof value === "number" ? value.toLocaleString() : value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const isFocused = useIsFocused();
  const [player, setPlayer] = useState<Player>(FALLBACK_PLAYER);
  const [gear, setGear] = useState<Gear[]>([]);
  const [loading, setLoading] = useState(true);
  const { state: achievementState, migrate: migrateAchievements, claim: claimAchievement } = useAchievements();
  const { state: restaurantState, notification: restaurantNotification, dismissNotification: dismissRestaurantNotification, sync: syncRestaurants } = useRestaurantProgress();
  const { state: titleState, notification: titleNotification, dismissNotification: dismissTitleNotification, sync: syncTitles, equip: equipTitle } = useTitleProgress();

  const load = useCallback(async () => {
    setLoading(true);
    const [playerResult, gearResult] = await Promise.allSettled([api.getPlayer(), api.gear()]);
    if (playerResult.status === "fulfilled" && playerResult.value) {
      const resolvedPlayer = { ...FALLBACK_PLAYER, ...(playerResult.value as Partial<Player>) };
      setPlayer(resolvedPlayer);
      const resolvedXp = Number(resolvedPlayer.xp || 0);
      const resolvedBelt = beltForXp(resolvedXp);
      await migrateAchievements({
        matches: resolvedPlayer.matches,
        wins: resolvedPlayer.wins,
        bestScore: resolvedPlayer.best_score,
        highestCombo: resolvedPlayer.longest_combo,
        xp: resolvedXp,
        itemsOwned: resolvedPlayer.owned_gear.length,
        beltRank: Math.max(1, BELTS.findIndex((item) => item.key === resolvedBelt.key) + 1),
      });
    }
    if (gearResult.status === "fulfilled") {
      setGear(Array.isArray(gearResult.value?.items) ? gearResult.value.items : []);
    } else {
      setGear([]);
    }
    setLoading(false);
  }, [migrateAchievements]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const xp = Number(player.xp || 0) + (achievementState?.claimedRewards.xp ?? 0);
  const belt = beltForXp(xp);
  const next = nextBelt(xp);
  const progressValue = next ? xp - belt.min_xp : 1;
  const progressMax = next ? next.min_xp - belt.min_xp : 1;
  const equipped = gear.find((item) => item.id === player.equipped_gear);
  const starterLoadout = !equipped;
  const beltRank = Math.max(1, BELTS.findIndex((item) => item.key === belt.key) + 1);
  const completedAchievementIds = useMemo(() => achievementState?.progress.filter((item) => item.completed).map((item) => item.achievementId) ?? [], [achievementState]);
  const unlockedRestaurantIds = useMemo(() => restaurantState?.restaurants.filter((item) => item.status === "unlocked").map((item) => item.restaurantId) ?? [], [restaurantState]);
  const equippedTitle = titleState?.equippedTitleId ? TITLE_BY_ID.get(titleState.equippedTitleId) : undefined;

  useEffect(() => {
    void syncRestaurants(xp);
  }, [syncRestaurants, xp]);

  useEffect(() => {
    if (!achievementState || !restaurantState) return;
    void syncTitles({
      matchesPlayed: player.matches,
      wins: player.wins,
      beltRank,
      completedAchievementIds,
      unlockedRestaurantIds,
    });
  }, [achievementState, beltRank, completedAchievementIds, player.matches, player.wins, restaurantState, syncTitles, unlockedRestaurantIds]);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ArcadeBackground active={isFocused} />
      {titleNotification ? <TitleUnlockBanner notification={titleNotification} onDismiss={dismissTitleNotification} /> : restaurantNotification ? <RestaurantUnlockBanner notification={restaurantNotification} onDismiss={dismissRestaurantNotification} /> : null}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <FireScreenEntrance duration="fast" distance={9}>
          <View style={[styles.identityPanel, { borderColor: belt.color }]}>
            <View style={styles.panelHighlight} pointerEvents="none" />
            <View style={styles.hudRow}>
              <Text numberOfLines={1} style={styles.profileLabel}>ARENA PROFILE</Text>
              <View style={styles.counters}>
                <Counter source={COIN} label="COINS" value={player.coins + (achievementState?.claimedRewards.coins ?? 0)} />
                <Counter source={ANTACID} label="ANTACID" value={player.antacid} />
              </View>
            </View>

            <View style={styles.identityBody}>
              <View style={styles.avatarStage}>
                <View style={styles.avatarGlow} pointerEvents="none" />
                <Image source={BLAZE} resizeMode="contain" style={styles.blaze} />
                <View style={styles.avatarBadge}><Text style={styles.avatarEmoji}>{player.avatar_emoji || "🍔"}</Text></View>
              </View>
              <View style={styles.identityInfo}>
                <Text numberOfLines={1} style={styles.name}>{player.username}</Text>
                <Text numberOfLines={1} style={[styles.equippedTitle, equippedTitle && { color: equippedTitle.colorTheme }]}>{equippedTitle?.displayName.toUpperCase() ?? "ROOKIE EATER"}</Text>
                <Text style={styles.country}>{player.country}</Text>
                <View style={styles.rankRow}>
                  <Text style={styles.rankIcon}>{belt.icon}</Text>
                  <View>
                    <Text style={[styles.rank, { color: belt.color }]}>{belt.name.toUpperCase()}</Text>
                    <Text style={styles.rankSub}>{next ? `NEXT: ${next.name.toUpperCase()}` : "MAXIMUM RANK"}</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.progressBlock}>
              <View style={styles.progressMeta}>
                <Text style={styles.progressLabel}>RANK PROGRESS</Text>
                <Text style={styles.progressValue}>{next ? `${xp.toLocaleString()} / ${next.min_xp.toLocaleString()} XP` : `${xp.toLocaleString()} XP · MAX RANK`}</Text>
              </View>
              <FireProgressBar value={progressValue} max={progressMax} variant="xp" compact />
            </View>
          </View>
        </FireScreenEntrance>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>CAREER STATS</Text>
          <View style={styles.headingRule} />
        </View>
        <View style={styles.statsGrid}>
          <StatTile label="WINS" value={player.wins} accent />
          <StatTile label="MATCHES" value={player.matches} />
          <StatTile label="BEST SCORE" value={player.best_score} accent />
          <StatTile label="DAY STREAK" value={player.streak_days} />
          <StatTile label="LOSSES" value={player.losses} />
          <StatTile label="BEST COMBO" value={`x${player.longest_combo || 0}`} accent />
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>EQUIPPED LOADOUT</Text>
          <Text style={styles.ownedCount}>{player.owned_gear.length} OWNED</Text>
        </View>
        <View style={styles.loadoutPanel}>
          <View style={styles.gearIconFrame}><Text style={styles.gearIcon}>{equipped?.icon || "👕"}</Text></View>
          <View style={styles.gearInfo}>
            <Text numberOfLines={1} style={styles.gearName}>{equipped?.name || "Starter Outfit"}</Text>
            <Text numberOfLines={1} style={styles.gearMeta}>{equipped ? `${equipped.rarity || "GEAR"} · ${equipped.slot || "LOADOUT"}` : "DEFAULT LOADOUT"}</Text>
            <Text numberOfLines={2} style={styles.gearDescription}>{equipped?.description || equipped?.perk || "No special perk equipped."}</Text>
          </View>
          <FireBadge label={starterLoadout ? "STARTER" : "EQUIPPED"} variant={starterLoadout ? "muted" : "gold"} />
        </View>

        {titleState ? (
          <View style={styles.titleSection}>
            <TitleBrowserPanel state={titleState} onEquip={(titleId) => { void equipTitle(titleId); }} />
          </View>
        ) : null}

        {restaurantState ? (
          <View style={styles.restaurantSection}>
            <RestaurantCollectionPanel state={restaurantState} />
          </View>
        ) : null}

        {achievementState ? (
          <View style={styles.achievementSection}>
            <AchievementPanel state={achievementState} onClaim={(achievementId) => { void claimAchievement(achievementId); }} />
          </View>
        ) : null}

        {loading ? <Text style={styles.loading}>REFRESHING PROFILE…</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#070405", flex: 1 },
  content: { paddingBottom: 18, paddingHorizontal: 12, paddingTop: 7 },
  identityPanel: { backgroundColor: "rgba(13,9,10,0.95)", borderRadius: 15, borderWidth: 1.5, overflow: "hidden", padding: 11 },
  panelHighlight: { backgroundColor: "rgba(255,220,160,0.13)", height: 1, left: 12, position: "absolute", right: 12, top: 1 },
  hudRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", minWidth: 0 },
  profileLabel: { color: "#C99A5A", flexShrink: 1, fontSize: 8, fontWeight: "900", letterSpacing: 1.4, paddingRight: 5 },
  counters: { flexDirection: "row", flexShrink: 0, gap: 4 },
  counter: { alignItems: "center", backgroundColor: "rgba(7,6,7,0.92)", borderColor: "rgba(223,135,46,0.58)", borderRadius: 8, borderWidth: 1, flexDirection: "row", minWidth: 74, paddingHorizontal: 5, paddingVertical: 4 },
  counterIcon: { height: 22, marginRight: 4, width: 22 },
  counterLabel: { color: "#987B62", fontSize: 6, fontWeight: "900", letterSpacing: 0.7 },
  counterValue: { color: "#FFD06A", fontSize: 12, fontWeight: "900", lineHeight: 14 },
  identityBody: { alignItems: "center", flexDirection: "row", minHeight: 142 },
  avatarStage: { alignItems: "center", height: 138, justifyContent: "center", marginLeft: -8, width: "43%" },
  avatarGlow: { backgroundColor: "rgba(207,61,12,0.15)", borderRadius: 65, height: 130, position: "absolute", width: 130 },
  blaze: { height: 144, width: 144 },
  avatarBadge: { alignItems: "center", backgroundColor: "#23100D", borderColor: "#DC8630", borderRadius: 17, borderWidth: 1, bottom: 5, height: 34, justifyContent: "center", position: "absolute", right: 4, width: 34 },
  avatarEmoji: { fontSize: 18 },
  identityInfo: { flex: 1, minWidth: 0, paddingLeft: 4 },
  name: { color: "#FFF0D8", fontSize: 25, fontWeight: "900", letterSpacing: 0.3, lineHeight: 29 },
  equippedTitle: { color: "#D7A45A", fontSize: 9, fontWeight: "900", letterSpacing: 0.8, marginTop: 1 },
  country: { color: "#B49B85", fontSize: 15, marginTop: 1 },
  rankRow: { alignItems: "center", flexDirection: "row", marginTop: 10 },
  rankIcon: { fontSize: 27, marginRight: 7 },
  rank: { fontSize: 12, fontWeight: "900", letterSpacing: 0.7 },
  rankSub: { color: "#957E6C", fontSize: 7, fontWeight: "800", marginTop: 2 },
  progressBlock: { backgroundColor: "rgba(7,6,7,0.66)", borderColor: "rgba(220,130,43,0.3)", borderRadius: 9, borderWidth: 1, padding: 8 },
  progressMeta: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 5 },
  progressLabel: { color: "#C59A63", flexShrink: 0, fontSize: 7, fontWeight: "900", letterSpacing: 0.9 },
  progressValue: { color: "#FFE2A7", flexShrink: 1, fontSize: 8, fontWeight: "900", marginLeft: 6, minWidth: 0, textAlign: "right" },
  sectionHeading: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 6, marginTop: 11, paddingHorizontal: 2 },
  sectionTitle: { color: "#E8BD7A", fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
  headingRule: { backgroundColor: "rgba(218,129,42,0.3)", flex: 1, height: 1, marginLeft: 8 },
  ownedCount: { color: "#98785F", fontSize: 7, fontWeight: "900", letterSpacing: 0.7 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  statTile: { alignItems: "center", backgroundColor: "rgba(14,10,11,0.94)", borderColor: "rgba(211,122,39,0.48)", borderRadius: 10, borderWidth: 1, justifyContent: "center", minHeight: 57, overflow: "hidden", width: "31.9%" },
  tileHighlight: { backgroundColor: "rgba(255,215,145,0.1)", height: 1, left: 6, position: "absolute", right: 6, top: 1 },
  statValue: { color: "#FFF0D7", fontSize: 20, fontWeight: "900", lineHeight: 22 },
  statAccent: { color: "#FFC252" },
  statLabel: { color: "#9B8270", fontSize: 7, fontWeight: "900", letterSpacing: 0.7, marginTop: 2 },
  loadoutPanel: { alignItems: "center", backgroundColor: "rgba(14,9,10,0.95)", borderColor: "rgba(231,143,48,0.68)", borderRadius: 12, borderWidth: 1, flexDirection: "row", minHeight: 82, padding: 8 },
  gearIconFrame: { alignItems: "center", backgroundColor: "rgba(43,20,15,0.84)", borderColor: "rgba(218,125,40,0.45)", borderRadius: 9, borderWidth: 1, height: 62, justifyContent: "center", marginRight: 9, width: 62 },
  gearIcon: { fontSize: 34 },
  gearInfo: { flex: 1, minWidth: 0, paddingRight: 6 },
  gearName: { color: "#FFF0D8", fontSize: 14, fontWeight: "900" },
  gearMeta: { color: "#D0954C", fontSize: 7, fontWeight: "900", letterSpacing: 0.6, marginTop: 2 },
  gearDescription: { color: "#A99482", fontSize: 8, lineHeight: 11, marginTop: 4 },
  loading: { color: "#E8AD55", fontSize: 8, fontWeight: "900", letterSpacing: 1, marginTop: 10, textAlign: "center" },
  achievementSection: { marginTop: 12 },
  restaurantSection: { marginTop: 12 },
  titleSection: { marginTop: 12 },
});
