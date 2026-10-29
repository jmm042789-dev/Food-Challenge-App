import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";

import { api } from "../../src/api";
import { resolveOfficialProgression } from "../../src/ranks";
import FireBadge from "../../src/components/fire/FireBadge";
import FireButton from "../../src/components/fire/FireButton";
import FireScreenEntrance from "../../src/components/fire/FireScreenEntrance";
import ArcadeBackground from "../../src/game/ui/ArcadeBackground";
import AchievementPanel from "../../src/achievements/components/AchievementPanel";
import { useAchievements } from "../../src/achievements/useAchievements";
import RestaurantCollectionPanel from "../../src/restaurants/components/RestaurantCollectionPanel";
import RestaurantUnlockBanner from "../../src/restaurants/components/RestaurantUnlockBanner";
import { useRestaurantProgress } from "../../src/restaurants/useRestaurantProgress";
import TitleBrowserPanel from "../../src/titles/components/TitleBrowserPanel";
import TitleUnlockBanner from "../../src/titles/components/TitleUnlockBanner";
import { useTitleProgress } from "../../src/titles/useTitleProgress";
import { usePlayerBalance } from "../../src/playerBalance";
import PlayerProfileCard from "../../src/profile/PlayerProfileCard";
import CompactScreenHeader from "../../src/components/fire/CompactScreenHeader";
import { DEFAULT_IDENTITY } from "../../src/profile/PlayerIdentity";
import { usePlayerIdentity } from "../../src/profile/PlayerIdentityContext";


type Player = {
  username?: string;
  avatar_emoji?: string;
  country?: string;
  xp?: number;
  level?: number;
  coins: number;
  antacid: number;
  wins: number;
  losses: number;
  matches: number;
  best_score: number;
  longest_combo: number;
  streak_days: number;
  current_streak?: number;
  longest_streak?: number;
  owned_gear: string[];
  equipped_gear: string | null;
  equipped_gear_slots?: Partial<Record<"hat" | "apron" | "outfit", string>>;
};

type Gear = {
  id: string;
  name: string;
  icon?: string;
  rarity?: string;
  slot?: string;
  description?: string;
  perk?: string;
  effect_description?: string;
  set_id?: string;
};

const FALLBACK_PLAYER: Player = {
  username: "Hungry Hero",
  avatar_emoji: "🍔",
  country: "🌎",
  coins: 0,
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
  const router = useRouter();
  const [player, setPlayer] = useState<Player>(FALLBACK_PLAYER);
  const [gear, setGear] = useState<Gear[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const { identity: storedIdentity } = usePlayerIdentity();
  const identity = storedIdentity ?? DEFAULT_IDENTITY;
  const { state: achievementState, migrate: migrateAchievements, claim: claimAchievement } = useAchievements();
  const { state: restaurantState, notification: restaurantNotification, dismissNotification: dismissRestaurantNotification, sync: syncRestaurants } = useRestaurantProgress();
  const { state: titleState, notification: titleNotification, dismissNotification: dismissTitleNotification, sync: syncTitles, equip: equipTitle } = useTitleProgress();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    const [playerResult, gearResult] = await Promise.allSettled([api.getPlayer(), api.gear()]);
    if (playerResult.status === "fulfilled" && playerResult.value) {
      const resolvedPlayer = { ...FALLBACK_PLAYER, ...(playerResult.value as Partial<Player>) };
      setPlayer((previous) => resolveOfficialProgression(resolvedPlayer).available || !resolveOfficialProgression(previous).available ? resolvedPlayer : previous);
      const resolved = resolveOfficialProgression(resolvedPlayer);
      if (resolved.xp !== null && resolved.beltTierIndex !== null) await migrateAchievements({
        matches: resolvedPlayer.matches,
        wins: resolvedPlayer.wins,
        bestScore: resolvedPlayer.best_score,
        highestCombo: resolvedPlayer.longest_combo,
        xp: resolved.xp,
        itemsOwned: resolvedPlayer.owned_gear.length,
        beltRank: resolved.beltTierIndex,
      });
    } else setLoadError(true);
    if (gearResult.status === "fulfilled") {
      setGear(Array.isArray(gearResult.value?.items) ? gearResult.value.items : []);
    } else {
      setGear([]);
    }
    setLoading(false);
  }, [migrateAchievements]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const official = resolveOfficialProgression(player);
  const { xp, belt, level, intervalXp: progressValue, intervalSize: progressMax } = official;
  const coins = usePlayerBalance(player.coins);
  const equippedItems = (["Hat", "Apron", "Outfit"] as const).map((slot) => ({
    slot,
    item: gear.find((candidate) => candidate.id === player.equipped_gear_slots?.[slot.toLowerCase() as "hat" | "apron" | "outfit"]),
  }));
  const legacyEquipped = gear.find((item) => item.id === player.equipped_gear);
  const activeSetId = equippedItems.every(({ item }) => item?.set_id && item.set_id === equippedItems[0].item?.set_id)
    ? equippedItems[0].item?.set_id
    : undefined;
  const beltRank = official.beltTierIndex;
  const completedAchievementIds = useMemo(() => achievementState?.progress.filter((item) => item.completed).map((item) => item.achievementId) ?? [], [achievementState]);
  const unlockedRestaurantIds = useMemo(() => restaurantState?.restaurants.filter((item) => item.status === "unlocked").map((item) => item.restaurantId) ?? [], [restaurantState]);

  useEffect(() => {
    if (xp !== null) void syncRestaurants(xp);
  }, [syncRestaurants, xp]);

  useEffect(() => {
    if (!achievementState || !restaurantState || beltRank === null) return;
    void syncTitles({
      matchesPlayed: player.matches,
      wins: player.wins,
      beltRank,
      completedAchievementIds,
      unlockedRestaurantIds,
    });
  }, [achievementState, beltRank, completedAchievementIds, player.matches, player.wins, restaurantState, syncTitles, unlockedRestaurantIds]);

  const deleteAccountPermanently = useCallback(async () => {
    if (deletingAccount) return;
    setDeletingAccount(true);
    try {
      await api.deleteAccount();
      router.replace("/");
    } catch {
      Alert.alert(
        "Account deletion failed",
        "Your local guest profile was not cleared. Check your connection and try again.",
      );
    } finally {
      setDeletingAccount(false);
    }
  }, [deletingAccount, router]);

  const confirmAccountDeletion = useCallback(() => {
    Alert.alert(
      "Delete guest account?",
      "This permanently removes your guest profile, progress, coins, inventory, rewards, and leaderboard entry. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Final confirmation",
              "Delete this guest account and all of its progress permanently?",
              [
                { text: "Keep Account", style: "cancel" },
                {
                  text: "Delete Account Permanently",
                  style: "destructive",
                  onPress: () => { void deleteAccountPermanently(); },
                },
              ],
            );
          },
        },
      ],
    );
  }, [deleteAccountPermanently]);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ArcadeBackground active={isFocused} />
      {titleNotification ? <TitleUnlockBanner notification={titleNotification} onDismiss={dismissTitleNotification} /> : restaurantNotification ? <RestaurantUnlockBanner notification={restaurantNotification} onDismiss={dismissRestaurantNotification} /> : null}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <CompactScreenHeader title="PROFILE" context="PLAYER HQ" right={<FireButton accessibilityLabel="Open settings" onPress={() => router.push("/settings")} size="compact" title="SETTINGS" variant="secondary" />} />
        <View style={styles.retentionNav}>
          <FireButton title="DAILY REWARDS" singleLineTitle size="compact" variant="gold" style={styles.retentionButton} onPress={() => router.push("/daily-rewards")} />
          <FireButton title="ACHIEVEMENTS" singleLineTitle size="compact" variant="secondary" style={styles.retentionButton} onPress={() => router.push("/achievements")} />
          <FireButton title="MISSIONS" singleLineTitle size="compact" variant="secondary" style={styles.retentionButton} onPress={() => router.push("/missions")} />
        </View>
        <FireScreenEntrance duration="fast" distance={9}>
          {xp !== null && level !== null && belt && progressValue !== null && progressMax !== null ? <>
          <Text style={{ color: "#FFD54A" }}>{official.nextBelt ? "NEXT BELT" : "MAX BELT"}</Text>
          <PlayerProfileCard
            identity={identity}
            equippedGearSlots={player.equipped_gear_slots}
            rank={belt.name}
            rankColor={belt.color}
            level={level}
            xp={xp}
            progress={progressValue}
            progressMax={progressMax}
            coins={coins}
            wins={player.wins}
            matches={player.matches}
            streak={player.streak_days}
            achievementCompleted={completedAchievementIds.length}
            achievementTotal={achievementState?.progress.length ?? 0}
          />
          </> : <Text style={{ color: "#FFD54A" }}>Official progression unavailable</Text>}
        </FireScreenEntrance>
        <View style={styles.profileActions}><FireButton accessibilityLabel="Edit gamer name and avatar" title="CUSTOMIZE" size="compact" style={styles.profileAction} variant="gold" onPress={() => router.push("/avatar-customization")} /><FireButton accessibilityLabel="Open friends and player search" title="FRIENDS" size="compact" style={styles.profileAction} variant="secondary" onPress={() => router.push("/friends" as never)} /><FireButton accessibilityLabel="View complete career statistics and history" title="CAREER" size="compact" style={styles.profileAction} variant="secondary" onPress={() => router.push("/career")} /></View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>CAREER STATS</Text>
          <View style={styles.headingRule} />
        </View>
        <View style={styles.statsGrid}>
          <StatTile label="WINS" value={player.wins} accent />
          <StatTile label="MATCHES" value={player.matches} />
          <StatTile label="WIN RATE" value={`${player.matches ? Math.round((player.wins / player.matches) * 100) : 0}%`} accent />
          <StatTile label="BEST SCORE" value={player.best_score} accent />
          <StatTile label="CURRENT STREAK" value={player.current_streak ?? player.streak_days} />
          <StatTile label="LONGEST STREAK" value={player.longest_streak ?? player.streak_days} />
          <StatTile label="LOSSES" value={player.losses} />
          <StatTile label="BEST COMBO" value={`x${player.longest_combo || 0}`} accent />
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>EQUIPPED LOADOUT</Text>
          <Text style={styles.ownedCount}>{player.owned_gear.length} OWNED</Text>
        </View>
        <View style={styles.loadoutPanel}>
          <View style={styles.gearInfo}>
            {equippedItems.map(({ slot, item }) => (
              <View key={slot} style={styles.loadoutRow}>
                <Text style={styles.loadoutSlot}>{slot.toUpperCase()}</Text>
                <View style={styles.loadoutCopy}>
                  <Text numberOfLines={1} style={styles.gearName}>{item?.name || `Starter ${slot}`}</Text>
                  <Text numberOfLines={2} style={styles.gearDescription}>{item?.effect_description || item?.description || item?.perk || "No gameplay effect."}</Text>
                </View>
                <FireBadge label={item ? "EQUIPPED" : "STARTER"} variant={item ? "gold" : "muted"} />
              </View>
            ))}
            {legacyEquipped ? <Text style={styles.legacyLoadout}>LEGACY LOADOUT · {legacyEquipped.name}</Text> : null}
            <Text style={styles.activeSet}>{activeSetId ? `COMPLETE SET ACTIVE · ${activeSetId.replace(/_/g, " ").toUpperCase()}` : "SET BONUS · EQUIP 3 MATCHING PIECES"}</Text>
          </View>
        </View>
        <FireButton
          accessibilityLabel="Open Locker and manage owned gear and cosmetics"
          fullWidth
          title="OPEN LOCKER / GEAR"
          variant="gold"
          onPress={() => router.push("/locker" as never)}
        />

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

        <View style={styles.accountSection}>
          <Text style={styles.accountTitle}>ACCOUNT &amp; DATA</Text>
          <Text style={styles.accountWarning}>
            Permanently delete this guest profile and all locally stored progress.
          </Text>
          <FireButton
            title="DELETE ACCOUNT"
            accessibilityLabel="Delete guest account"
            onPress={confirmAccountDeletion}
            disabled={deletingAccount}
            loading={deletingAccount}
            size="small"
            variant="danger"
            fullWidth
          />
        </View>

        {loading ? <Text style={styles.loading}>REFRESHING PROFILE…</Text> : null}
        {loadError && !loading ? <View style={styles.loadError}><Text style={styles.loading}>PROFILE COULD NOT BE REFRESHED</Text><FireButton title="RETRY" onPress={() => { void load(); }} size="small" variant="secondary" /></View> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#070405", flex: 1 },
  content: { alignSelf: "center", maxWidth: 760, paddingBottom: 18, paddingHorizontal: 12, paddingTop: 7, width: "100%" },
  retentionNav: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  retentionButton: { flexGrow: 1, flexShrink: 1, flexBasis: 118, marginTop: 0, minWidth: 118 },
  profileActions: { flexDirection: "row", gap: 6 },
  profileAction: { flex: 1 },
  identityPanel: { backgroundColor: "rgba(13,9,10,0.95)", borderRadius: 15, borderWidth: 1.5, elevation: 7, overflow: "hidden", padding: 11, shadowColor: "#000", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.38, shadowRadius: 10 },
  panelHighlight: { backgroundColor: "rgba(255,220,160,0.13)", height: 1, left: 12, position: "absolute", right: 12, top: 1 },
  hudRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", minWidth: 0 },
  profileLabel: { color: "#C99A5A", flexShrink: 1, fontSize: 8, fontWeight: "900", letterSpacing: 1.4, paddingRight: 5 },
  counters: { flexDirection: "row", flexShrink: 0, gap: 4 },
  counter: { alignItems: "center", backgroundColor: "rgba(7,6,7,0.92)", borderColor: "rgba(223,135,46,0.58)", borderRadius: 8, borderWidth: 1, flexDirection: "row", minWidth: 74, paddingHorizontal: 5, paddingVertical: 4 },
  counterIcon: { height: 22, marginRight: 4, width: 22 },
  counterLabel: { color: "#987B62", fontSize: 6, fontWeight: "900", letterSpacing: 0.7 },
  counterValue: { color: "#FFD06A", fontSize: 12, fontWeight: "900", lineHeight: 14 },
  identityBody: { alignItems: "center", flexDirection: "row", minHeight: 124 },
  avatarStage: { alignItems: "center", height: 122, justifyContent: "center", marginLeft: -8, width: "40%" },
  avatarGlow: { backgroundColor: "rgba(207,61,12,0.15)", borderRadius: 65, height: 130, position: "absolute", width: 130 },
  blaze: { height: 128, width: 128 },
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
  statTile: { alignItems: "center", backgroundColor: "rgba(14,10,11,0.94)", borderColor: "rgba(211,122,39,0.48)", borderRadius: 10, borderWidth: 1, elevation: 2, justifyContent: "center", minHeight: 57, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, width: "31.9%" },
  tileHighlight: { backgroundColor: "rgba(255,215,145,0.1)", height: 1, left: 6, position: "absolute", right: 6, top: 1 },
  statValue: { color: "#FFF0D7", fontSize: 20, fontWeight: "900", lineHeight: 22 },
  statAccent: { color: "#FFC252" },
  statLabel: { color: "#9B8270", fontSize: 7, fontWeight: "900", letterSpacing: 0.7, marginTop: 2 },
  loadoutPanel: { alignItems: "center", backgroundColor: "rgba(14,9,10,0.95)", borderColor: "rgba(231,143,48,0.68)", borderRadius: 12, borderWidth: 1, elevation: 3, flexDirection: "row", minHeight: 82, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.24, shadowRadius: 5 },
  gearIconFrame: { alignItems: "center", backgroundColor: "rgba(43,20,15,0.84)", borderColor: "rgba(218,125,40,0.45)", borderRadius: 9, borderWidth: 1, height: 62, justifyContent: "center", marginRight: 9, width: 62 },
  gearIcon: { fontSize: 34 },
  gearInfo: { flex: 1, minWidth: 0, paddingRight: 6 },
  gearName: { color: "#FFF0D8", fontSize: 14, fontWeight: "900" },
  gearMeta: { color: "#D0954C", fontSize: 7, fontWeight: "900", letterSpacing: 0.6, marginTop: 2 },
  gearDescription: { color: "#A99482", fontSize: 8, lineHeight: 11, marginTop: 4 },
  loadoutRow: { alignItems: "center", borderBottomColor: "rgba(216,128,38,0.18)", borderBottomWidth: 1, flexDirection: "row", gap: 8, minHeight: 58, paddingVertical: 6 },
  loadoutSlot: { color: "#D0954C", fontSize: 8, fontWeight: "900", letterSpacing: 0.6, width: 44 },
  loadoutCopy: { flex: 1, minWidth: 0 },
  activeSet: { color: "#F6C76A", fontSize: 9, fontWeight: "900", letterSpacing: 0.5, paddingTop: 8, textAlign: "center" },
  legacyLoadout: { color: "#D0954C", fontSize: 8, fontWeight: "900", paddingTop: 7, textAlign: "center" },
  loading: { color: "#E8AD55", fontSize: 8, fontWeight: "900", letterSpacing: 1, marginTop: 10, textAlign: "center" },
  loadError: { alignItems: "center", gap: 8, marginTop: 8 },
  achievementSection: { marginTop: 8 },
  restaurantSection: { marginTop: 12 },
  titleSection: { marginTop: 12 },
  accountSection: { backgroundColor: "rgba(35,10,11,0.88)", borderColor: "rgba(184,66,61,0.7)", borderRadius: 11, borderWidth: 1, marginTop: 14, padding: 11 },
  accountTitle: { color: "#E9A09B", fontSize: 9, fontWeight: "900", letterSpacing: 1.1 },
  accountWarning: { color: "#BDA09B", fontSize: 9, lineHeight: 13, marginTop: 5 },
});
