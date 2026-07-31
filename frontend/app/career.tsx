import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "../src/api";
import ArcadeBackground from "../src/game/ui/ArcadeBackground";
import FireButton from "../src/components/fire/FireButton";
import FirePanel from "../src/components/fire/FirePanel";
import PlayerProfileCard from "../src/profile/PlayerProfileCard";
import CareerSection, { type CareerStat } from "../src/profile/CareerSection";
import { DEFAULT_IDENTITY, AVATAR_OPTIONS, loadPlayerIdentity, type PlayerIdentity } from "../src/profile/PlayerIdentity";
import { BELTS, beltForXp, nextBelt } from "../src/ranks";
import { loadAchievementState } from "../src/achievements/AchievementStorage";
import type { AchievementState } from "../src/achievements/AchievementTypes";
import { loadDailyMissions } from "../src/missions/MissionTracker";
import type { DailyMissionState } from "../src/missions/MissionTypes";
import { loadTitleProgress } from "../src/titles/TitleProgress";
import { TITLE_BY_ID } from "../src/titles/TitleCatalog";
import type { TitleProgressState } from "../src/titles/TitleTypes";
import { useAppPreferences } from "../src/preferences/AppPreferences";

type Player = { xp?: number; coins?: number; matches?: number; wins?: number; losses?: number; best_score?: number; longest_combo?: number; streak_days?: number; current_streak?: number; longest_streak?: number; total_daily_spins?: number };
const placeholder = (label: string): CareerStat => ({ label, value: "NOT YET TRACKED", placeholder: true });
const dateLabel = (value: string | null | undefined) => value ? new Date(value).toLocaleDateString() : "NOT YET RECORDED";

export default function CareerScreen() {
  const router = useRouter();
  const { preferences } = useAppPreferences();
  const [player, setPlayer] = useState<Player>({});
  const [identity, setIdentity] = useState<PlayerIdentity>(DEFAULT_IDENTITY);
  const [achievements, setAchievements] = useState<AchievementState | null>(null);
  const [missions, setMissions] = useState<DailyMissionState | null>(null);
  const [titles, setTitles] = useState<TitleProgressState | null>(null);
  const [loading, setLoading] = useState(true);
  const [liveStatsError, setLiveStatsError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLiveStatsError(false);
    const results = await Promise.allSettled([api.getPlayer(), loadPlayerIdentity(), loadAchievementState(), loadDailyMissions(), loadTitleProgress()]);
    if (results[0].status === "fulfilled") setPlayer(results[0].value as Player);
    else setLiveStatsError(true);
    if (results[1].status === "fulfilled") setIdentity(results[1].value);
    if (results[2].status === "fulfilled") setAchievements(results[2].value);
    if (results[3].status === "fulfilled") setMissions(results[3].value);
    if (results[4].status === "fulfilled") setTitles(results[4].value);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const xp = Number(player.xp ?? 0); const coins = Number(player.coins ?? 0); const matches = Number(player.matches ?? 0); const wins = Number(player.wins ?? 0); const losses = Number(player.losses ?? 0);
  const belt = beltForXp(xp); const next = nextBelt(xp); const level = Math.max(1, BELTS.findIndex((item) => item.key === belt.key) + 1);
  const progress = next ? xp - belt.min_xp : 1; const progressMax = next ? next.min_xp - belt.min_xp : 1;
  const completed = achievements?.progress.filter((item) => item.completed) ?? [];
  const progressById = useMemo(() => new Map(achievements?.progress.map((item) => [item.achievementId, item]) ?? []), [achievements]);
  const totalScore = progressById.get("total_score_1000")?.currentProgress;
  const trackedCoins = progressById.get("coins_earned_1000")?.currentProgress;
  const trackedXp = progressById.get("xp_earned_1000")?.currentProgress;
  const firstAchievement = [...completed].filter((item) => item.completedAt).sort((a, b) => String(a.completedAt).localeCompare(String(b.completedAt)))[0];
  const equippedTitle = titles?.equippedTitleId ? TITLE_BY_ID.get(titles.equippedTitleId)?.displayName : null;
  const cosmeticsOwned = Object.values(AVATAR_OPTIONS).reduce((sum, options) => sum + options.length, 0);
  const large = preferences.largeText;

  const matchStats: CareerStat[] = [
    { label: "Matches Played", value: matches }, { label: "Wins", value: wins }, { label: "Losses", value: losses },
    { label: "Win Percentage", value: matches ? `${Math.round((wins / matches) * 100)}%` : "0%" }, placeholder("Draws"),
    { label: "Current Win Streak", value: player.current_streak ?? player.streak_days ?? 0 }, { label: "Longest Win Streak", value: player.longest_streak ?? player.streak_days ?? 0 },
    placeholder("Average Match Score"), { label: "Highest Match Score", value: Number(player.best_score ?? 0) },
    totalScore === undefined ? placeholder("Total Score Earned") : { label: "Total Score Earned", value: totalScore.toLocaleString() },
  ];
  const records: CareerStat[] = [{ label: "Highest Combo", value: `x${Number(player.longest_combo ?? 0)}` }, placeholder("Total Combos"), placeholder("Average Combo"), placeholder("Perfect Matches"), placeholder("Fastest Victory"), placeholder("Longest Match")];
  const food: CareerStat[] = [placeholder("Favorite Food"), placeholder("Most Played Food"), placeholder("Foods Completed"), placeholder("Total Food Consumed"), placeholder("Favorite Arena")];
  const progression: CareerStat[] = [
    { label: "Total XP", value: xp.toLocaleString() }, trackedXp === undefined ? placeholder("Locally Tracked XP Earned") : { label: "Locally Tracked XP Earned", value: trackedXp.toLocaleString() },
    trackedCoins === undefined ? placeholder("Locally Tracked Coins Earned") : { label: "Locally Tracked Coins Earned", value: trackedCoins.toLocaleString() },
    { label: "Achievements Completed", value: `${completed.length} / ${achievements?.progress.length ?? 0}` }, { label: "Daily Charcuterie Spins", value: Number(player.total_daily_spins ?? 0) },
    { label: "Missions Completed Today", value: missions?.missions.filter((item) => item.completed).length ?? 0 },
  ];
  const collection: CareerStat[] = [{ label: "Avatar Cosmetics Available", value: cosmeticsOwned }, { label: "Badges Earned", value: completed.length }, { label: "Titles Unlocked", value: titles?.unlockedTitles.length ?? 0 }, placeholder("Seasonal Rewards")];
  const history: CareerStat[] = [
    { label: "First Match", value: dateLabel(progressById.get("matches_played_001")?.completedAt) }, { label: "First Victory", value: dateLabel(progressById.get("matches_won_001")?.completedAt) },
    { label: "Reached Level 5", value: level >= 5 ? "UNLOCKED · DATE UNAVAILABLE" : "NOT YET REACHED", placeholder: level < 5 }, placeholder("Reached Level 10"),
    { label: "Highest Combo", value: `x${Number(player.longest_combo ?? 0)}` }, { label: "First Achievement", value: dateLabel(firstAchievement?.completedAt) },
  ];

  return <SafeAreaView style={styles.screen}><ArcadeBackground reducedMotion={preferences.reducedMotion} />
    <View style={styles.header}><FireButton title="BACK" size="compact" variant="ghost" onPress={() => router.back()} /><View><Text accessibilityRole="header" style={[styles.title, large && styles.largeTitle]}>CAREER</Text><Text style={styles.subtitle}>YOUR FIRE FEAST JOURNEY</Text></View></View>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {loading ? <Text style={styles.loading}>LOADING CAREER…</Text> : <>
        {liveStatsError ? <FirePanel accent="danger" title="LIVE STATS UNAVAILABLE" subtitle="Your local history is still available. Reconnect and retry to refresh match totals."><FireButton fullWidth title="RETRY LIVE STATS" size="small" variant="secondary" onPress={() => { void load(); }} /></FirePanel> : null}
        <PlayerProfileCard identity={identity} rank={belt.name} rankColor={belt.color} level={level} xp={xp} progress={progress} progressMax={progressMax} coins={coins} wins={wins} matches={matches} streak={Number(player.streak_days ?? 0)} achievementCompleted={completed.length} achievementTotal={achievements?.progress.length ?? 0} />
        <View style={styles.season}><Text style={styles.seasonLabel}>CURRENT SEASON</Text><Text style={styles.seasonValue}>BETA SEASON</Text><Text style={styles.seasonLabel}>CURRENT TITLE</Text><Text style={styles.seasonValue}>{equippedTitle?.toUpperCase() ?? "NO TITLE EQUIPPED"}</Text></View>
        <CareerSection largeText={large} title="MATCH STATISTICS" stats={matchStats} />
        <CareerSection largeText={large} title="GAMEPLAY RECORDS" stats={records} />
        <CareerSection initiallyOpen={false} largeText={large} title="FOOD STATISTICS" subtitle="Food history tracking is planned for a future data update." stats={food} />
        <CareerSection largeText={large} title="PROGRESSION" stats={progression} />
        <CareerSection initiallyOpen={false} largeText={large} title="COLLECTION" stats={collection} />
        <CareerSection largeText={large} title="PROFILE HISTORY" stats={history} />
      </>}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#070405", flex: 1 }, header: { alignItems: "center", alignSelf: "center", flexDirection: "row", gap: 12, maxWidth: 760, paddingHorizontal: 14, paddingTop: 4, width: "100%" },
  title: { color: "#FFD06A", fontSize: 28, fontWeight: "900", letterSpacing: 1.2 }, largeTitle: { fontSize: 32 }, subtitle: { color: "#B78D62", fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  content: { alignSelf: "center", gap: 10, maxWidth: 760, paddingBottom: 30, paddingHorizontal: 14, paddingTop: 8, width: "100%" }, loading: { color: "#CDAA7E", padding: 30, textAlign: "center" },
  season: { backgroundColor: "rgba(31,18,16,0.96)", borderColor: "rgba(226,143,55,0.5)", borderRadius: 11, borderWidth: 1, flexDirection: "row", flexWrap: "wrap", gap: 5, padding: 10 },
  seasonLabel: { color: "#9C806B", fontSize: 8, fontWeight: "900", width: "48%" }, seasonValue: { color: "#F2C986", fontSize: 10, fontWeight: "900", textAlign: "right", width: "48%" },
});
