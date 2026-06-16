import { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Share, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/src/theme";
import { api } from "@/src/api";
import { sfx } from "@/src/audio";

export default function ResultScreen() {
  const params = useLocalSearchParams<any>();
  const router = useRouter();
  const won = params.won === "1";
  const leveledUp = params.leveled_up === "1";
  const isTournament = params.is_tournament === "1";
  const [trash, setTrash] = useState<string>("");
  const playedRef = useRef(false);

  useEffect(() => {
    if (!playedRef.current) {
      playedRef.current = true;
      sfx.play(won ? "win" : "lose");
      if (leveledUp) sfx.play("reward");
    }
    api.trashTalk({
      opponent_id: params.opp_id as string,
      contest_id: params.contest_id as string,
      event: won ? "lose" : "win",
      player_score: Number(params.score),
      opponent_score: Number(params.opp),
    }).then((r) => setTrash(r.line)).catch(() => {});
  }, []);

  const onShare = async () => {
    sfx.play("click");
    const msg = won
      ? `🏆 I just beat ${params.opp_name} at ${params.contest_name} on Chomp Champs — ${params.score} to ${params.opp}! Can you top me?`
      : `😵 Got out-eaten ${params.opp} to ${params.score} by ${params.opp_name} at ${params.contest_name} on Chomp Champs. I'll get 'em next time.`;
    try {
      if (Platform.OS === "web") {
        if ((globalThis as any).navigator?.share) {
          await (globalThis as any).navigator.share({ title: "Chomp Champs", text: msg });
        } else {
          await (globalThis as any).navigator?.clipboard?.writeText?.(msg);
        }
      } else {
        await Share.share({ message: msg });
      }
    } catch {}
  };

  return (
    <SafeAreaView style={styles.container} testID="result-screen">
      <View style={styles.center}>
        <Text style={styles.bigEmoji}>{won ? "🏆" : "😵"}</Text>
        <Text style={[styles.title, { color: won ? theme.c.brandSecondary : theme.c.brand }]}>
          {won ? (isTournament ? "TOURNAMENT WIN!" : "VICTORY!") : "DEFEATED"}
        </Text>
        <Text style={styles.subtitle}>{params.reason === "heartburn" ? "Heartburn KO'd you!" : "Time's up!"}</Text>

        {leveledUp && (
          <View style={[styles.levelUpCard, { borderColor: params.new_belt_color || theme.c.brandSecondary }]} testID="level-up-card">
            <Text style={styles.levelUpLabel}>RANK UP!</Text>
            <Text style={styles.levelUpName}>{params.new_belt_icon} {params.new_belt_name}</Text>
          </View>
        )}

        <View style={styles.scoreCard}>
          <View style={styles.scoreRow}>
            <Text style={styles.scoreLabel}>YOU</Text>
            <Text style={styles.scoreValue}>{params.score}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.scoreRow}>
            <Text style={styles.scoreLabel}>{params.opp_name}</Text>
            <Text style={styles.scoreValue}>{params.opp}</Text>
          </View>
        </View>

        {trash ? <View style={styles.trashBubble}><Text style={styles.trashText}>💬 {trash}</Text></View> : null}

        <View style={styles.rewards}>
          <View style={styles.rewardCard}>
            <Text style={styles.rewardIcon}>🪙</Text>
            <Text style={styles.rewardValue}>+{params.coin_reward}</Text>
            <Text style={styles.rewardLabel}>COINS</Text>
          </View>
          <View style={styles.rewardCard}>
            <Text style={styles.rewardIcon}>⭐</Text>
            <Text style={styles.rewardValue}>+{params.xp_reward}</Text>
            <Text style={styles.rewardLabel}>XP</Text>
          </View>
        </View>

        <Pressable onPress={onShare} style={styles.shareBtn} testID="share-btn">
          <Ionicons name="share-social" size={18} color="#fff" />
          <Text style={styles.shareBtnText}>SHARE RESULT</Text>
        </Pressable>
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={() => router.replace(`/play/${params.contest_id}` as any)}
          style={[styles.actionBtn, { backgroundColor: theme.c.surfaceTertiary }]}
          testID="rematch-btn"
        >
          <Ionicons name="refresh" size={18} color="#fff" />
          <Text style={styles.actionText}>REMATCH</Text>
        </Pressable>
        <Pressable
          onPress={() => router.replace("/(tabs)/home" as any)}
          style={[styles.actionBtn, { backgroundColor: theme.c.brand }]}
          testID="home-btn"
        >
          <Ionicons name="home" size={18} color="#fff" />
          <Text style={styles.actionText}>HOME</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.c.surface, padding: theme.s.lg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  bigEmoji: { fontSize: 100 },
  title: { fontSize: 48, fontFamily: theme.f.display, fontWeight: "900", letterSpacing: 2, marginTop: 8, textAlign: "center" },
  subtitle: { color: theme.c.onSurfaceTertiary, fontSize: 14, marginBottom: theme.s.lg },
  levelUpCard: { borderWidth: 2, paddingVertical: theme.s.sm, paddingHorizontal: theme.s.lg, borderRadius: theme.r.md, marginBottom: theme.s.md, backgroundColor: theme.c.surfaceSecondary, alignItems: "center" },
  levelUpLabel: { color: theme.c.brandSecondary, fontSize: 11, fontWeight: "900", letterSpacing: 2 },
  levelUpName: { color: "#fff", fontSize: 20, fontWeight: "900", marginTop: 4 },
  scoreCard: { width: "100%", backgroundColor: theme.c.surfaceSecondary, padding: theme.s.lg, borderRadius: theme.r.lg, borderWidth: 1, borderColor: theme.c.border },
  scoreRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  scoreLabel: { color: theme.c.onSurfaceSecondary, fontSize: 14, fontWeight: "800" },
  scoreValue: { color: "#fff", fontSize: 32, fontFamily: theme.f.display, fontWeight: "900" },
  divider: { height: 1, backgroundColor: theme.c.border, marginVertical: theme.s.md },
  trashBubble: { backgroundColor: theme.c.surfaceSecondary, padding: theme.s.md, borderRadius: theme.r.md, borderWidth: 1, borderColor: theme.c.brand, marginTop: theme.s.lg },
  trashText: { color: "#fff", fontStyle: "italic" },
  rewards: { flexDirection: "row", gap: theme.s.md, marginTop: theme.s.lg, width: "100%" },
  rewardCard: { flex: 1, backgroundColor: theme.c.surfaceSecondary, padding: theme.s.md, borderRadius: theme.r.md, borderWidth: 1, borderColor: theme.c.border, alignItems: "center" },
  rewardIcon: { fontSize: 32 },
  rewardValue: { color: theme.c.brandSecondary, fontSize: 24, fontWeight: "900", marginTop: 4 },
  rewardLabel: { color: theme.c.onSurfaceTertiary, fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  shareBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: theme.c.success, paddingHorizontal: theme.s.xl, paddingVertical: theme.s.md, borderRadius: theme.r.pill, marginTop: theme.s.lg },
  shareBtnText: { color: "#0F1115", fontWeight: "900", letterSpacing: 1 },
  actions: { flexDirection: "row", gap: theme.s.md },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: theme.s.lg, borderRadius: theme.r.pill },
  actionText: { color: "#fff", fontWeight: "900", letterSpacing: 1 },
});
