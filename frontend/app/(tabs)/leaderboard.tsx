import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useIsFocused } from "@react-navigation/native";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "../../src/api";
import AvatarRenderer from "../../src/profile/AvatarRenderer";
import ArcadeBackground from "../../src/game/ui/ArcadeBackground";
import CompactScreenHeader from "../../src/components/fire/CompactScreenHeader";
import FireEmptyState from "../../src/components/fire/FireEmptyState";
import FireLoading from "../../src/components/fire/FireLoading";
import FirePanel from "../../src/components/fire/FirePanel";
import { DEFAULT_IDENTITY, type AvatarConfiguration } from "../../src/profile/PlayerIdentity";
import { usePlayerIdentity } from "../../src/profile/PlayerIdentityContext";

type Mode = "OVERALL" | "CONTESTS";
type Leader = { position: number; public_id: string; handle: string; display_name: string; avatar: AvatarConfiguration; score: number; level: number; rank: string; is_you: boolean };
type ContestOption = { id: string; name: string; food: string; mechanic: string; personal_best: number };
type ContestResponse = { contest: ContestOption; leaderboard: Leader[]; your_rank: Leader | null };

export default function LeaderboardScreen() {
  const isFocused = useIsFocused();
  const router = useRouter();
  const { identity } = usePlayerIdentity();
  const playerName = identity?.gamerName ?? DEFAULT_IDENTITY.gamerName;
  const displayName = (leader: Leader) => leader.is_you ? playerName : leader.display_name;
  const [mode, setMode] = useState<Mode>("OVERALL");
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [contests, setContests] = useState<ContestOption[]>([]);
  const [selectedContestId, setSelectedContestId] = useState("");
  const [contestResult, setContestResult] = useState<ContestResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const requestGeneration = useRef(0);

  const loadOverall = useCallback(async () => {
    const generation = ++requestGeneration.current;
    setLoading(true); setError(false);
    try {
      const [overall, catalog] = await Promise.all([api.leaderboard(), api.leaderboardContests()]) as [{ leaderboard?: Leader[] }, { contests?: ContestOption[] }];
      if (generation !== requestGeneration.current) return;
      const options = Array.isArray(catalog.contests) ? catalog.contests : [];
      setLeaders(Array.isArray(overall.leaderboard) ? overall.leaderboard : []);
      setContests(options);
      setSelectedContestId((current) => current || options[0]?.id || "");
    } catch { if (generation === requestGeneration.current) setError(true); }
    finally { if (generation === requestGeneration.current) setLoading(false); }
  }, []);

  const loadContest = useCallback(async (contestId: string) => {
    if (!contestId) return;
    const generation = ++requestGeneration.current;
    setLoading(true); setError(false);
    try {
      const response = await api.contestLeaderboard(contestId) as ContestResponse;
      if (generation === requestGeneration.current && contestId === selectedContestId) setContestResult(response);
    } catch { if (generation === requestGeneration.current) setError(true); }
    finally { if (generation === requestGeneration.current) setLoading(false); }
  }, [selectedContestId]);

  useFocusEffect(useCallback(() => { void loadOverall(); return () => { requestGeneration.current += 1; }; }, [loadOverall]));
  useEffect(() => { if (mode === "CONTESTS" && selectedContestId) void loadContest(selectedContestId); }, [loadContest, mode, selectedContestId]);
  const activeLeaders = mode === "OVERALL" ? leaders : contestResult?.leaderboard ?? [];
  const retry = () => { if (mode === "OVERALL") void loadOverall(); else void loadContest(selectedContestId); };

  return <SafeAreaView style={styles.container} edges={["top"]}><ArcadeBackground active={isFocused}/><ScrollView alwaysBounceVertical={false} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <CompactScreenHeader title="RANKS" context={mode === "OVERALL" ? "OVERALL BEST SCORE" : "CONTEST BEST SCORE"} />
    <View accessibilityRole="tablist" style={styles.tabs}>{(["OVERALL", "CONTESTS"] as const).map((item) => <Pressable accessibilityRole="tab" accessibilityState={{ selected: mode === item }} key={item} onPress={() => setMode(item)} style={[styles.tab, mode === item && styles.tabSelected]}><Text style={[styles.tabText, mode === item && styles.tabTextSelected]}>{item}</Text></Pressable>)}</View>
    {mode === "CONTESTS" ? <ScrollView horizontal contentContainerStyle={styles.selector} showsHorizontalScrollIndicator={false}>{contests.map((contest) => <Pressable key={contest.id} onPress={() => setSelectedContestId(contest.id)} style={[styles.contestChip, selectedContestId === contest.id && styles.contestChipSelected]}><Text numberOfLines={1} style={styles.contestName}>{contest.name}</Text><Text style={styles.contestMeta}>{contest.mechanic.toUpperCase()} · BEST {contest.personal_best || "—"}</Text></Pressable>)}</ScrollView> : null}
    {mode === "CONTESTS" && contestResult ? <FirePanel compact accent="gold" style={styles.contestHero}><Text style={styles.heroTitle}>{contestResult.contest.name}</Text><Text style={styles.heroMeta}>{contestResult.contest.food} · {contestResult.contest.mechanic.toUpperCase()}</Text></FirePanel> : null}
    {loading && !activeLeaders.length ? <FireLoading title="Loading Rankings" subtitle="Finding the arena leaders." /> : null}
    {error && !activeLeaders.length ? <FireEmptyState icon="!" title="Rankings Unavailable" message="Fire Feast could not load authoritative rankings. Try again." buttonLabel="RETRY" onPress={retry} /> : null}
    {!loading && !error && !activeLeaders.length ? <FireEmptyState icon="#" title="No Rankings Yet" message={mode === "OVERALL" ? "Complete a feast to claim the first spot." : "No verified score has been recorded for this contest yet."} /> : null}
    {mode === "CONTESTS" && contestResult?.your_rank && !activeLeaders.some((leader) => leader.is_you) ? <View><Text style={styles.section}>YOUR RANK</Text><LeaderRow leader={contestResult.your_rank} name={displayName(contestResult.your_rank)} onPress={() => undefined} /></View> : null}
    {activeLeaders.length ? <Text style={styles.section}>{mode === "OVERALL" ? "GLOBAL LEADERBOARD" : "TOP VERIFIED SCORES"}</Text> : null}
    {activeLeaders.map((leader) => <LeaderRow key={`${leader.public_id}-${leader.position}`} leader={leader} name={displayName(leader)} onPress={() => { if (!leader.is_you) router.push(`/player/${encodeURIComponent(leader.public_id)}` as never); }} />)}
  </ScrollView></SafeAreaView>;
}

function LeaderRow({ leader, name, onPress }: { leader: Leader; name: string; onPress: () => void }) {
  return <Pressable accessibilityRole={leader.is_you ? "text" : "button"} disabled={leader.is_you} onPress={onPress}><FirePanel style={[styles.card, leader.is_you && styles.currentPlayer]}><Text style={styles.position}>#{leader.position}</Text><AvatarRenderer configuration={leader.avatar} size={42} /><View style={styles.playerInfo}><Text numberOfLines={1} style={styles.name}>{name}</Text><Text numberOfLines={1} style={styles.handle}>@{leader.handle} · {leader.rank}</Text></View><Text adjustsFontSizeToFit numberOfLines={1} style={styles.score}>{leader.score.toLocaleString()}</Text></FirePanel></Pressable>;
}

const styles = StyleSheet.create({
  container: { backgroundColor: "#070405", flex: 1 }, content: { paddingBottom: 24, paddingHorizontal: 12, paddingTop: 7 }, tabs: { backgroundColor: "rgba(20,10,8,0.9)", borderRadius: 12, flexDirection: "row", gap: 6, marginBottom: 10, padding: 4 }, tab: { alignItems: "center", borderRadius: 9, flex: 1, justifyContent: "center", minHeight: 44 }, tabSelected: { backgroundColor: "#9E3616", borderColor: "#F2A640", borderWidth: 1 }, tabText: { color: "#9D8371", fontSize: 11, fontWeight: "900" }, tabTextSelected: { color: "#FFF0D8" }, selector: { gap: 8, paddingBottom: 10 }, contestChip: { backgroundColor: "#160D0B", borderColor: "#5E3526", borderRadius: 11, borderWidth: 1, minHeight: 58, paddingHorizontal: 12, paddingVertical: 8, width: 190 }, contestChipSelected: { borderColor: "#F2A640", borderWidth: 2 }, contestName: { color: "#FFF0D8", fontSize: 12, fontWeight: "900" }, contestMeta: { color: "#C89A66", fontSize: 8, fontWeight: "800", marginTop: 5 }, contestHero: { marginBottom: 9 }, heroTitle: { color: "#FFD06A", fontSize: 17, fontWeight: "900", textAlign: "center" }, heroMeta: { color: "#B99879", fontSize: 9, fontWeight: "800", marginTop: 3, textAlign: "center" }, section: { color: "#E8BD7A", fontSize: 10, fontWeight: "900", letterSpacing: 1.1, marginBottom: 7, marginTop: 4 }, card: { alignItems: "center", flexDirection: "row", gap: 9, marginBottom: 6, minHeight: 66, padding: 10 }, currentPlayer: { borderColor: "#FF8A00", borderWidth: 2 }, position: { color: "#F6C76A", fontWeight: "900", width: 42 }, playerInfo: { flex: 1, minWidth: 0 }, name: { color: "#FFF7E8", fontSize: 15, fontWeight: "900" }, handle: { color: "#A98E79", fontSize: 8, fontWeight: "800", marginTop: 3 }, score: { color: "#F6C76A", fontSize: 17, fontWeight: "900", maxWidth: "25%", textAlign: "right" },
});
