import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import FireButton from "../components/fire/FireButton";
import FirePanel from "../components/fire/FirePanel";
import AvatarRenderer from "../profile/AvatarRenderer";
import type { PublicPlayerProfile } from "./types";

export default function SocialPlayerCard({ player, busy, onPrimary, onSecondary, onChallenge }: { player: PublicPlayerProfile; busy?: boolean; onPrimary?: () => void; onSecondary?: () => void; onChallenge?: () => void }) {
  const router = useRouter();
  const primary = player.friendship_state === "INCOMING" ? "ACCEPT" : player.friendship_state === "OUTGOING" ? "CANCEL" : player.friendship_state === "FRIENDS" ? "REMOVE" : player.friendship_state === "SELF" ? null : "ADD FRIEND";
  return <FirePanel compact style={styles.panel}>
    <View style={styles.row}>
      <AvatarRenderer configuration={player.avatar} size={58} />
      <View style={styles.copy}><Text numberOfLines={1} style={styles.name}>{player.display_name}</Text><Text numberOfLines={1} style={styles.handle}>@{player.handle}</Text><Text numberOfLines={1} style={styles.rank}>{player.rank} · LV {player.level}</Text></View>
    </View>
    <View style={styles.actions}><FireButton title="VIEW PROFILE" size="compact" variant="secondary" onPress={() => router.push(`/player/${encodeURIComponent(player.public_id)}` as never)} />{player.friendship_state === "FRIENDS" && onChallenge ? <FireButton disabled={busy} title="CHALLENGE" size="compact" variant="gold" onPress={onChallenge} /> : null}{primary && onPrimary ? <FireButton disabled={busy} loading={busy} title={primary} size="compact" variant={primary === "REMOVE" || primary === "CANCEL" ? "secondary" : "gold"} onPress={onPrimary} /> : null}{player.friendship_state === "INCOMING" && onSecondary ? <FireButton disabled={busy} title="DECLINE" size="compact" variant="ghost" onPress={onSecondary} /> : null}</View>
  </FirePanel>;
}

const styles = StyleSheet.create({ panel: { gap: 9 }, row: { alignItems: "center", flexDirection: "row" }, copy: { flex: 1, marginLeft: 11 }, name: { color: "#FFF0D8", fontSize: 16, fontWeight: "900" }, handle: { color: "#E5A650", fontSize: 11, fontWeight: "800", marginTop: 2 }, rank: { color: "#A68C78", fontSize: 9, fontWeight: "800", marginTop: 3 }, actions: { flexDirection: "row", flexWrap: "wrap", gap: 7 } });
