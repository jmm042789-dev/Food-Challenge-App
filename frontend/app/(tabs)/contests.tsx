import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Contest, parseContests } from "../../src/api";
import { getFoodArtwork } from "../../src/assets/foodArtwork";
import FireLoading from "../../src/components/fire/FireLoading";
import FirePanel from "../../src/components/fire/FirePanel";
import ArcadeBackground from "../../src/game/ui/ArcadeBackground";
import TournamentBanner from "../../src/game/ui/TournamentBanner";
import RestaurantIdentity from "../../src/game/ui/RestaurantIdentity";
import TournamentPanel from "../../src/tournaments/components/TournamentPanel";
import { getTournamentPlayerProgress } from "../../src/tournaments/TournamentProgress";
import { useTournamentProgress } from "../../src/tournaments/useTournamentProgress";

const COIN = require("../../src/assets/icons/coin.png");
const ALL = "All";

type Player = { coins?: number };

function difficultyTone(difficulty: string) {
  const value = difficulty.toLowerCase();
  if (value === "easy") return styles.badgeEasy;
  if (value === "medium") return styles.badgeMedium;
  return styles.badgeHard;
}

function ContestRow({ contest, onPress }: { contest: Contest; onPress: () => void }) {
  const artwork = getFoodArtwork(contest.id);

  return (
    <FirePanel compact onPress={onPress} borderColor={contest.color ?? "rgba(225, 133, 45, 0.68)"} style={styles.contestRow}>
      <View style={styles.thumbnailFrame}>
        <View style={styles.thumbnailGlow} />
        <Image
          source={artwork.source}
          resizeMode="contain"
          style={[styles.thumbnail, { transform: [{ scale: artwork.scale }] }]}
        />
      </View>

      <View style={styles.contestInfo}>
        {contest.category ? <Text numberOfLines={1} style={styles.category}>{contest.category.toUpperCase()}</Text> : null}
        <Text numberOfLines={2} style={styles.contestName}>{contest.name}</Text>
        <RestaurantIdentity name={contest.restaurant_name} logoUrl={contest.restaurant_logo_url} city={contest.city} state={contest.state} address={contest.address} postalCode={contest.postal_code} verified={contest.verified} sponsored={contest.sponsored} variant="compact" />
        <Text numberOfLines={1} style={styles.location}>⌖ {contest.location}</Text>
        <Text numberOfLines={1} style={styles.food}>{contest.food_emoji} {contest.food} · {contest.duration_sec}s</Text>
        <View style={[styles.difficultyBadge, difficultyTone(contest.difficulty)]}>
          <Text style={styles.difficultyText}>{contest.difficulty.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.economy}>
        <Text style={styles.economyLabel}>PRIZE</Text>
        <Text numberOfLines={1} style={styles.prize}>${contest.prize_pool.toLocaleString()}</Text>
        <View style={styles.economyRule} />
        <Text style={styles.economyLabel}>ENTRY</Text>
        <View style={styles.entryRow}>
          <Image source={COIN} resizeMode="contain" style={styles.entryCoin} />
          <Text numberOfLines={1} style={styles.entry}>{contest.entry_fee.toLocaleString()}</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </View>
    </FirePanel>
  );
}

export default function ContestsScreen() {
  const isFocused = useIsFocused();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [contests, setContests] = useState<Contest[]>([]);
  const [coins, setCoins] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState(ALL);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const { activeTournament, state: tournamentState, refresh: refreshTournament, claim: claimTournamentReward } = useTournamentProgress();

  useFocusEffect(useCallback(() => {
    void refreshTournament();
  }, [refreshTournament]));

  useEffect(() => {
    let active = true;
    async function loadContests() {
      const [contestResult, playerResult] = await Promise.allSettled([api.listContests(), api.getPlayer()]);
      if (!active) return;

      if (contestResult.status === "fulfilled") {
        setContests(parseContests(contestResult.value));
        setHasError(false);
      } else {
        setContests([]);
        setHasError(true);
      }
      if (playerResult.status === "fulfilled" && playerResult.value) {
        setCoins(Number((playerResult.value as Player).coins ?? 0));
      }
      setLoading(false);
    }
    loadContests();
    return () => { active = false; };
  }, []);

  const categories = useMemo(
    () => [ALL, ...Array.from(new Set(contests.map((contest) => contest.category).filter((category): category is string => Boolean(category))))],
    [contests]
  );
  const visibleContests = useMemo(
    () => selectedCategory === ALL ? contests : contests.filter((contest) => contest.category === selectedCategory),
    [contests, selectedCategory]
  );
  const tournamentProgress = tournamentState ? getTournamentPlayerProgress(tournamentState, activeTournament.occurrenceId) : null;

  if (loading) return <View style={styles.screen}><ArcadeBackground active={isFocused} /><FireLoading title="Loading Contests" subtitle="Setting the Fire Feast arena." /></View>;
  return (
    <View style={styles.screen}>
      <ArcadeBackground active={isFocused} />
      <FlatList
        data={visibleContests}
        keyExtractor={(contest) => contest.id}
        renderItem={({ item }) => <ContestRow contest={item} onPress={() => router.push(`/play/${item.id}`)} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.listContent, { paddingTop: Math.max(insets.top, 8) }]}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <View style={styles.headerTitleBlock}>
                <Text style={styles.kicker}>FIRE FEAST ARENA</Text>
                <Text style={styles.title}>CONTESTS</Text>
              </View>
              <View style={styles.coinHud}>
                <Image source={COIN} resizeMode="contain" style={styles.coinIcon} />
                <View>
                  <Text style={styles.coinLabel}>COINS</Text>
                  <Text style={styles.coinValue}>{coins.toLocaleString()}</Text>
                </View>
              </View>
            </View>

            {tournamentProgress ? (
              <TournamentPanel
                tournament={activeTournament}
                progress={tournamentProgress}
                onEnter={() => router.push(`/play/${activeTournament.entryContestId}?tournament=${encodeURIComponent(activeTournament.occurrenceId)}`)}
                onClaimReward={(rewardId) => { void claimTournamentReward(rewardId); }}
              />
            ) : null}

            <TournamentBanner eventTitle="FIRE FEAST WORLD TOUR" contestName="TOURNAMENT BOARD" roundLabel={`${contests.length} EVENTS`} variant="compact" />

            <FlatList
              horizontal
              data={categories}
              keyExtractor={(category) => category}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabs}
              renderItem={({ item }) => {
                const active = item === selectedCategory;
                return (
                  <Pressable onPress={() => setSelectedCategory(item)} style={({ pressed }) => [styles.tab, active && styles.tabActive, pressed && styles.tabPressed]}>
                    <Text style={[styles.tabText, active && styles.tabTextActive]}>{item.toUpperCase()}</Text>
                  </Pressable>
                );
              }}
            />

            <View style={styles.boardHeading}>
              <Text style={styles.boardTitle}>TOURNAMENT BOARD</Text>
              <Text style={styles.eventCount}>{visibleContests.length} {visibleContests.length === 1 ? "EVENT" : "EVENTS"}</Text>
            </View>
          </View>
        }
        ListEmptyComponent={<Text style={styles.noEvents}>{hasError ? "Regular contest board unavailable. Weekly tournament remains open." : "No contests in this category."}</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#070405", flex: 1 },
  listContent: { paddingBottom: 12, paddingHorizontal: 12 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 62, minWidth: 0, paddingHorizontal: 2 },
  headerTitleBlock: { flex: 1, minWidth: 0, paddingRight: 8 },
  kicker: { color: "#B98450", fontSize: 8, fontWeight: "900", letterSpacing: 1.8 },
  title: { color: "#FFF1DD", fontSize: 25, fontWeight: "900", letterSpacing: 1.2, lineHeight: 28 },
  coinHud: { alignItems: "center", backgroundColor: "rgba(9,7,8,0.94)", borderColor: "rgba(238,151,56,0.7)", borderRadius: 10, borderWidth: 1, flexDirection: "row", flexShrink: 0, minWidth: 98, paddingHorizontal: 8, paddingVertical: 6 },
  coinIcon: { height: 28, marginRight: 5, width: 28 },
  coinLabel: { color: "#B58B59", fontSize: 7, fontWeight: "900", letterSpacing: 1 },
  coinValue: { color: "#FFD16A", fontSize: 15, fontWeight: "900", lineHeight: 17 },
  tabs: { gap: 5, paddingBottom: 8, paddingRight: 10, paddingTop: 3 },
  tab: { backgroundColor: "rgba(13,10,11,0.9)", borderColor: "rgba(151,94,50,0.38)", borderRadius: 8, borderWidth: 1, minWidth: 54, paddingHorizontal: 10, paddingVertical: 7 },
  tabActive: { backgroundColor: "rgba(139,67,17,0.92)", borderColor: "#F2A13D" },
  tabPressed: { opacity: 0.8 },
  tabText: { color: "#9E8876", fontSize: 8, fontWeight: "900", letterSpacing: 0.7, textAlign: "center" },
  tabTextActive: { color: "#FFF0CF" },
  boardHeading: { alignItems: "center", borderTopColor: "rgba(231,137,47,0.3)", borderTopWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 2, paddingTop: 8, paddingBottom: 6 },
  boardTitle: { color: "#F0C37E", fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
  eventCount: { color: "#A87343", fontSize: 8, fontWeight: "900", letterSpacing: 0.8 },
  contestRow: { alignItems: "center", backgroundColor: "rgba(15,10,11,0.94)", borderRadius: 11, flexDirection: "row", marginBottom: 6, minHeight: 92, paddingHorizontal: 7, paddingVertical: 6 },
  thumbnailFrame: { alignItems: "center", backgroundColor: "rgba(30,13,11,0.82)", borderColor: "rgba(219,123,37,0.42)", borderRadius: 9, borderWidth: 1, flexShrink: 0, height: 70, justifyContent: "center", overflow: "hidden", width: 70 },
  thumbnailGlow: { backgroundColor: "rgba(202,58,10,0.17)", borderRadius: 36, height: 70, position: "absolute", width: 70 },
  thumbnail: { height: 72, width: 72 },
  contestInfo: { flex: 1, justifyContent: "center", minWidth: 0, paddingHorizontal: 7 },
  contestName: { color: "#FFF0DA", fontSize: 13, fontWeight: "900", lineHeight: 15, textTransform: "uppercase" },
  category: { color: "#B97C3D", fontSize: 6, fontWeight: "900", letterSpacing: 0.9, marginBottom: 1 },
  location: { color: "#C5AD98", fontSize: 9, fontWeight: "700", marginTop: 3 },
  food: { color: "#D49347", fontSize: 8, fontWeight: "800", marginTop: 2 },
  difficultyBadge: { alignSelf: "flex-start", borderRadius: 5, borderWidth: 1, marginTop: 5, paddingHorizontal: 7, paddingVertical: 2 },
  badgeEasy: { backgroundColor: "rgba(35,90,56,0.62)", borderColor: "rgba(96,183,117,0.72)" },
  badgeMedium: { backgroundColor: "rgba(126,78,18,0.62)", borderColor: "rgba(232,166,65,0.72)" },
  badgeHard: { backgroundColor: "rgba(105,31,28,0.68)", borderColor: "rgba(218,81,66,0.74)" },
  difficultyText: { color: "#F8E2C5", fontSize: 7, fontWeight: "900", letterSpacing: 0.6 },
  economy: { alignItems: "flex-end", borderLeftColor: "rgba(216,126,42,0.27)", borderLeftWidth: 1, flexShrink: 0, justifyContent: "center", minHeight: 68, paddingLeft: 6, paddingRight: 10, width: 76 },
  economyLabel: { color: "#9C806A", fontSize: 7, fontWeight: "900", letterSpacing: 0.9 },
  prize: { color: "#FFC353", fontSize: 15, fontWeight: "900", lineHeight: 18 },
  economyRule: { backgroundColor: "rgba(211,123,42,0.24)", height: 1, marginVertical: 4, width: "100%" },
  entryRow: { alignItems: "center", flexDirection: "row" },
  entryCoin: { height: 12, marginRight: 2, width: 12 },
  entry: { color: "#E7B461", fontSize: 11, fontWeight: "900" },
  chevron: { color: "#E69138", fontSize: 23, position: "absolute", right: -1, top: 21 },
  noEvents: { color: "#C1A48C", fontSize: 12, paddingVertical: 28, textAlign: "center" },
});
