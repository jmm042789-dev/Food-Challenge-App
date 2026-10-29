import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "../../src/api";
import FireButton from "../../src/components/fire/FireButton";
import FirePanel from "../../src/components/fire/FirePanel";
import ArcadeBackground from "../../src/game/ui/ArcadeBackground";
import AvatarRenderer from "../../src/profile/AvatarRenderer";
import type { PublicPlayerProfile } from "../../src/social/types";

export default function PublicPlayerScreen() {
  const router = useRouter();
  const { publicId } = useLocalSearchParams<{ publicId: string }>();
  const [player, setPlayer] = useState<PublicPlayerProfile | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const load = useCallback(async () => { const request = ++generation.current; setError(false); try { const value = await api.publicPlayer(String(publicId)); if (request === generation.current) setPlayer(value); } catch { if (request === generation.current) setError(true); } }, [publicId]);
  useEffect(() => { void load(); return () => { generation.current += 1; }; }, [load]);
  const act = async () => { if (!player || busy) return; setBusy(true); try { if (player.friendship_state === "INCOMING") await api.acceptFriendRequest(player.public_id); else if (player.friendship_state === "OUTGOING") await api.cancelFriendRequest(player.public_id); else if (player.friendship_state === "FRIENDS") await api.removeFriend(player.public_id); else await api.sendFriendRequest(player.public_id); await load(); } catch { setError(true); } finally { setBusy(false); } };
  return <SafeAreaView style={styles.screen}><ArcadeBackground /><View style={styles.header}><FireButton title="BACK" size="compact" variant="ghost" onPress={() => router.back()} /><Text style={styles.title}>PLAYER PROFILE</Text></View><ScrollView contentContainerStyle={styles.content}>
    {error ? <FirePanel><Text accessibilityRole="alert" style={styles.error}>Player profile could not be loaded.</Text><FireButton title="RETRY" variant="gold" onPress={() => { void load(); }} /></FirePanel> : null}
    {player ? <FirePanel accent="gold" elevated><View style={styles.hero}><AvatarRenderer configuration={player.avatar} size={150} /><Text style={styles.name}>{player.display_name}</Text><Text style={styles.handle}>@{player.handle}</Text><Text style={styles.rank}>{player.rank} · LEVEL {player.level}</Text></View><View style={styles.stats}><View><Text style={styles.value}>{player.wins}</Text><Text style={styles.label}>WINS</Text></View><View><Text style={styles.value}>{player.matches}</Text><Text style={styles.label}>MATCHES</Text></View><View><Text style={styles.value}>{player.best_score}</Text><Text style={styles.label}>BEST SCORE</Text></View></View>{player.friendship_state === "FRIENDS" ? <FireButton fullWidth title="CHALLENGE" variant="gold" onPress={() => router.push(`/pvp/challenge/${encodeURIComponent(player.public_id)}` as never)} /> : null}{player.friendship_state !== "SELF" ? <FireButton fullWidth loading={busy} title={player.friendship_state === "INCOMING" ? "ACCEPT REQUEST" : player.friendship_state === "OUTGOING" ? "CANCEL REQUEST" : player.friendship_state === "FRIENDS" ? "REMOVE FRIEND" : "ADD FRIEND"} variant="secondary" onPress={() => { void act(); }} /> : null}</FirePanel> : null}
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({ screen: { backgroundColor: "#070405", flex: 1 }, header: { alignItems: "center", flexDirection: "row", paddingHorizontal: 14 }, title: { color: "#FFD06A", flex: 1, fontSize: 22, fontWeight: "900", marginLeft: 12 }, content: { alignSelf: "center", maxWidth: 620, padding: 14, width: "100%" }, hero: { alignItems: "center" }, name: { color: "#FFF0D8", fontSize: 25, fontWeight: "900", marginTop: 10 }, handle: { color: "#E6A74E", fontSize: 13, fontWeight: "800", marginTop: 3 }, rank: { color: "#A9907A", fontSize: 10, fontWeight: "900", marginTop: 5 }, stats: { flexDirection: "row", justifyContent: "space-around", marginVertical: 18 }, value: { color: "#FFD06A", fontSize: 19, fontWeight: "900", textAlign: "center" }, label: { color: "#9C8370", fontSize: 8, fontWeight: "900", marginTop: 2 }, error: { color: "#E58A78", marginBottom: 10, textAlign: "center" } });
