import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "../../../src/api";
import FireButton from "../../../src/components/fire/FireButton";
import FirePanel from "../../../src/components/fire/FirePanel";
import ArcadeBackground from "../../../src/game/ui/ArcadeBackground";
import AvatarRenderer from "../../../src/profile/AvatarRenderer";
import type { PublicPlayerProfile, PvpContestSummary } from "../../../src/social/types";

export default function CreateChallengeScreen() {
  const { publicId } = useLocalSearchParams<{ publicId: string }>();
  const router = useRouter();
  const [player, setPlayer] = useState<PublicPlayerProfile | null>(null);
  const [contests, setContests] = useState<PvpContestSummary[]>([]);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState(false);
  const sending = useRef(false);
  useEffect(() => {
    let active = true;
    Promise.all([api.publicPlayer(String(publicId)), api.pvpContests()]).then(([profile, response]) => {
      if (!active) return;
      if (profile.friendship_state !== "FRIENDS") throw new Error("Friendship required");
      setPlayer(profile); setContests(response.contests); setSelected(response.contests[0]?.id ?? "");
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [publicId]);
  const send = async () => {
    if (sending.current || !selected) return;
    sending.current = true; setError(false);
    try { await api.createPvpChallenge(String(publicId), selected); router.replace("/friends" as never); }
    catch { setError(true); sending.current = false; }
  };
  return <SafeAreaView style={styles.screen}><ArcadeBackground /><ScrollView contentContainerStyle={styles.content}>
    <View style={styles.header}><FireButton title="BACK" size="compact" variant="ghost" onPress={() => router.back()} /><Text style={styles.title}>DIRECT CHALLENGE</Text></View>
    {player ? <FirePanel><View style={styles.player}><AvatarRenderer configuration={player.avatar} size={68} /><View><Text style={styles.name}>{player.display_name}</Text><Text style={styles.handle}>@{player.handle}</Text></View></View></FirePanel> : null}
    <Text style={styles.section}>CHOOSE AN AUTHORITATIVE CONTEST</Text>
    {contests.map((contest) => <FireButton key={contest.id} fullWidth title={contest.name.toUpperCase()} subtitle={`${contest.food} · ${contest.duration_sec} SEC · ${contest.difficulty}`} variant={selected === contest.id ? "gold" : "secondary"} onPress={() => setSelected(contest.id)} />)}
    {error ? <Text accessibilityRole="alert" style={styles.error}>Challenge unavailable. Confirm this player is still a friend and retry.</Text> : null}
    <FireButton disabled={!selected || sending.current} fullWidth title="SEND CHALLENGE" variant="gold" onPress={() => { void send(); }} />
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({ screen: { backgroundColor: "#070405", flex: 1 }, content: { alignSelf: "center", gap: 10, maxWidth: 600, padding: 14, width: "100%" }, header: { alignItems: "center", flexDirection: "row" }, title: { color: "#FFD06A", flex: 1, fontSize: 22, fontWeight: "900", marginLeft: 12 }, player: { alignItems: "center", flexDirection: "row", gap: 12 }, name: { color: "#FFF0D8", fontSize: 20, fontWeight: "900" }, handle: { color: "#D99A45", marginTop: 3 }, section: { color: "#BE8A50", fontSize: 9, fontWeight: "900", letterSpacing: 1.2, marginTop: 6 }, error: { color: "#EE8A78", textAlign: "center" } });
