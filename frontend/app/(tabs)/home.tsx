import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, Modal } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/src/theme";
import { api } from "@/src/api";
import { beltForXp, nextBelt, progressToNext } from "@/src/ranks";
import { sfx } from "@/src/audio";

export default function HomeScreen() {
  const router = useRouter();
  const [player, setPlayer] = useState<any>(null);
  const [contests, setContests] = useState<any[]>([]);
  const [tournament, setTournament] = useState<any>(null);
  const [daily, setDaily] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [dailyOpen, setDailyOpen] = useState(false);
  const [claimed, setClaimed] = useState<any>(null);

  const load = useCallback(async () => {
    const [p, c, t, d] = await Promise.all([api.getPlayer(), api.listContests(), api.tournament(), api.dailyStatus()]);
    setPlayer(p);
    setContests(c.contests || []);
    setTournament(t);
    setDaily(d);
    sfx.preload();
    if (!p.tutorial_done) router.replace("/tutorial" as any);
  }, [router]);

  useFocusEffect(useCallback(() => { load().catch(console.error); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }, [load]);

  const claim = async () => {
    try {
      const r = await api.dailyClaim();
      sfx.play("reward");
      setClaimed(r);
      setPlayer(r.player);
      const next = await api.dailyStatus();
      setDaily(next);
    } catch {}
  };

  const belt = player ? beltForXp(player.xp || 0) : null;
  const nb = player ? nextBelt(player.xp || 0) : null;
  const progress = player ? progressToNext(player.xp || 0) : 0;
  const featured = contests[0];

  return (
    <SafeAreaView edges={["top"]} style={styles.container} testID="home-screen">
      <View style={styles.header} testID="home-header">
        <Pressable onPress={() => router.push("/(tabs)/profile" as any)} style={styles.avatarWrap}>
          <Text style={styles.avatarEmoji}>{player?.avatar_emoji || "🤤"}</Text>
        </Pressable>
        <View style={{ flex: 1, marginLeft: theme.s.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={styles.beltIcon}>{belt?.icon}</Text>
            <Text style={[styles.beltLabel, { color: belt?.color || "#fff" }]}>{belt?.name || "Rookie"}</Text>
          </View>
          <Text style={styles.helloName} numberOfLines={1}>{player?.username || "Hungry Hero"}</Text>
          <View style={styles.xpBar}>
            <View style={[styles.xpFill, { width: `${progress * 100}%`, backgroundColor: belt?.color || theme.c.brand }]} />
          </View>
          <Text style={styles.xpText}>{nb ? `${player?.xp || 0} / ${nb.min_xp} XP → ${nb.name}` : "MAX RANK"}</Text>
        </View>
        <View>
          <View style={styles.statPill} testID="coin-balance">
            <Text style={styles.statEmoji}>🪙</Text>
            <Text style={styles.statValue}>{player?.coins ?? 0}</Text>
          </View>
          <View style={[styles.statPill, { marginTop: 4 }]} testID="tums-balance">
            <Text style={styles.statEmoji}>💊</Text>
            <Text style={styles.statValue}>{player?.tums ?? 0}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: theme.s.lg, paddingBottom: theme.s.xxxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.c.brand} />}
        testID="home-scroll"
      >
        <Text style={styles.bigTitle}>CHOMP CHAMPS</Text>
        <Text style={styles.subTitle}>EAT. DEFEAT. REPEAT.</Text>

        {/* Daily reward banner */}
        {daily?.available && (
          <Pressable onPress={() => setDailyOpen(true)} style={styles.dailyBanner} testID="daily-reward-banner">
            <Text style={styles.dailyIcon}>🎁</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.dailyTitle}>DAILY REWARD READY</Text>
              <Text style={styles.dailySub}>Day {daily.next_day} {String.fromCharCode(8226)} streak {daily.streak_days} {String.fromCharCode(8226)} {daily.next_reward.icon} {daily.next_reward.qty} {daily.next_reward.type}</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#fff" />
          </Pressable>
        )}

        {/* Tournament banner */}
        {tournament && (
          <Pressable
            onPress={() => router.push(`/play/${tournament.contest.id}?tournament=1` as any)}
            style={styles.tournamentBanner}
            testID="tournament-banner"
          >
            <Image source={{ uri: tournament.contest.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
            <LinearGradient colors={["rgba(15,17,21,0.25)", "rgba(15,17,21,0.92)"]} style={StyleSheet.absoluteFill} />
            <View style={{ flex: 1, padding: theme.s.lg, justifyContent: "space-between" }}>
              <View style={styles.tourTag}><Text style={styles.tourTagText}>{tournament.tag}</Text></View>
              <View>
                <Text style={styles.tourTitle} numberOfLines={1}>{tournament.title}</Text>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
                  <View>
                    <Text style={styles.miniLabel}>BOOSTED PRIZE</Text>
                    <Text style={styles.miniValue}>🪙 {tournament.boosted_prize}</Text>
                    <Text style={styles.tourMult}>×{tournament.prize_mult} MULTIPLIER</Text>
                  </View>
                  <View style={styles.playBtn}>
                    <Text style={styles.playBtnText}>ENTER</Text>
                    <Ionicons name="trophy" size={16} color="#fff" />
                  </View>
                </View>
              </View>
            </View>
          </Pressable>
        )}

        {featured && (
          <Pressable
            onPress={() => router.push(`/play/${featured.id}` as any)}
            style={styles.heroCard}
            testID="home-play-next-btn"
          >
            <Image source={{ uri: featured.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
            <LinearGradient colors={["rgba(15,17,21,0.2)", "rgba(15,17,21,0.95)"]} style={StyleSheet.absoluteFill} />
            <View style={styles.heroContent}>
              <View style={styles.heroBadge}>
                <Ionicons name="flame" size={12} color="#fff" />
                <Text style={styles.heroBadgeText}>FEATURED</Text>
              </View>
              <Text style={styles.heroTitle} numberOfLines={2}>{featured.name}</Text>
              <Text style={styles.heroLocation}>📍 {featured.location}</Text>
              <View style={styles.heroFooter}>
                <View>
                  <Text style={styles.miniLabel}>PRIZE</Text>
                  <Text style={styles.miniValue}>🪙 {featured.prize_pool}</Text>
                </View>
                <View style={styles.playBtn}>
                  <Text style={styles.playBtnText}>PLAY NOW</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </View>
              </View>
            </View>
          </Pressable>
        )}

        <Text style={styles.sectionTitle}>YOUR RECORDS</Text>
        <View style={styles.recordRow}>
          <RecordCard label="WINS" value={player?.wins ?? 0} icon="trophy" color={theme.c.brandSecondary} />
          <RecordCard label="MATCHES" value={player?.matches ?? 0} icon="game-controller" color={theme.c.brandTertiary} />
          <RecordCard label="BEST" value={player?.best_score ?? 0} icon="flame" color={theme.c.brand} />
        </View>

        <Text style={styles.sectionTitle}>OTHER CONTESTS</Text>
        {contests.slice(1, 4).map((c) => (
          <Pressable
            key={c.id}
            style={styles.smallCard}
            onPress={() => router.push(`/play/${c.id}` as any)}
            testID={`home-contest-${c.id}`}
          >
            <Text style={styles.smallEmoji}>{c.food_emoji}</Text>
            <View style={{ flex: 1, marginLeft: theme.s.md }}>
              <Text style={styles.smallTitle} numberOfLines={1}>{c.name}</Text>
              <Text style={styles.smallSub}>Entry 🪙 {c.entry_fee} · Prize 🪙 {c.prize_pool}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.c.onSurfaceTertiary} />
          </Pressable>
        ))}
      </ScrollView>

      {/* Daily reward modal */}
      <Modal visible={dailyOpen} transparent animationType="fade" onRequestClose={() => { setDailyOpen(false); setClaimed(null); }}>
        <Pressable style={styles.modalBackdrop} onPress={() => { setDailyOpen(false); setClaimed(null); }}>
          <Pressable style={styles.dailyCard} onPress={() => {}}>
            <Text style={styles.dailyHeadline}>{claimed ? "REWARD CLAIMED" : "DAILY REWARD"}</Text>
            <Text style={styles.dailySubHead}>Streak: 🔥 {daily?.streak_days ?? 0} days</Text>
            <View style={styles.daysGrid}>
              {(daily?.schedule || []).map((d: any) => {
                const completed = daily?.streak_days >= d.day || claimed?.day === d.day;
                const isToday = d.day === (claimed?.day ?? daily?.next_day);
                return (
                  <View key={d.day} style={[styles.dayCell, completed && styles.dayCellDone, isToday && styles.dayCellToday]}>
                    <Text style={styles.dayLabel}>DAY {d.day}</Text>
                    <Text style={styles.dayIcon}>{d.icon}</Text>
                    <Text style={styles.dayQty}>{d.qty}</Text>
                  </View>
                );
              })}
            </View>
            {claimed ? (
              <Pressable onPress={() => { setDailyOpen(false); setClaimed(null); }} style={styles.claimBtn} testID="daily-close-btn">
                <Text style={styles.claimBtnText}>NICE!</Text>
              </Pressable>
            ) : (
              <Pressable onPress={claim} style={styles.claimBtn} testID="daily-claim-btn">
                <Text style={styles.claimBtnText}>CLAIM TODAY{String.fromCharCode(8217)}S REWARD</Text>
              </Pressable>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function RecordCard({ label, value, icon, color }: { label: string; value: number; icon: any; color: string }) {
  return (
    <View style={styles.recordCard}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={styles.recordValue}>{value}</Text>
      <Text style={styles.recordLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.c.surface },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: theme.s.lg, paddingVertical: theme.s.sm, backgroundColor: theme.c.surface, borderBottomColor: theme.c.border, borderBottomWidth: 1 },
  avatarWrap: { width: 48, height: 48, borderRadius: theme.r.pill, backgroundColor: theme.c.surfaceSecondary, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: theme.c.brand },
  avatarEmoji: { fontSize: 26 },
  beltIcon: { fontSize: 14 },
  beltLabel: { fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  helloName: { color: theme.c.onSurface, fontSize: 16, fontWeight: "800" },
  xpBar: { height: 4, backgroundColor: theme.c.surfaceSecondary, borderRadius: 2, marginTop: 4, overflow: "hidden" },
  xpFill: { height: "100%" },
  xpText: { color: theme.c.onSurfaceTertiary, fontSize: 9, marginTop: 2 },
  statPill: { flexDirection: "row", alignItems: "center", backgroundColor: theme.c.surfaceSecondary, paddingHorizontal: theme.s.md, paddingVertical: 4, borderRadius: theme.r.pill, borderWidth: 1, borderColor: theme.c.border, minWidth: 70, justifyContent: "center" },
  statEmoji: { fontSize: 12, marginRight: 4 },
  statValue: { color: theme.c.onSurface, fontWeight: "800", fontSize: 13 },

  bigTitle: { color: theme.c.onSurface, fontSize: theme.fs.hero, fontFamily: theme.f.display, letterSpacing: 1, lineHeight: 56 },
  subTitle: { color: theme.c.brand, fontSize: 14, fontWeight: "800", letterSpacing: 2, marginBottom: theme.s.lg },

  dailyBanner: { flexDirection: "row", alignItems: "center", gap: theme.s.md, backgroundColor: theme.c.brand, padding: theme.s.md, borderRadius: theme.r.md, marginBottom: theme.s.md },
  dailyIcon: { fontSize: 32 },
  dailyTitle: { color: "#fff", fontSize: 14, fontWeight: "900", letterSpacing: 1 },
  dailySub: { color: "rgba(255,255,255,0.85)", fontSize: 11, marginTop: 2 },

  tournamentBanner: { height: 160, borderRadius: theme.r.lg, overflow: "hidden", borderWidth: 2, borderColor: theme.c.brandSecondary, marginBottom: theme.s.md, backgroundColor: theme.c.surfaceSecondary },
  tourTag: { alignSelf: "flex-start", backgroundColor: theme.c.brandSecondary, paddingHorizontal: theme.s.sm, paddingVertical: 4, borderRadius: theme.r.sm },
  tourTagText: { color: "#0F1115", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  tourTitle: { color: "#fff", fontSize: 22, fontFamily: theme.f.display, lineHeight: 24, marginBottom: 6 },
  tourMult: { color: theme.c.brandSecondary, fontSize: 11, fontWeight: "900", marginTop: 2 },

  heroCard: { height: 220, borderRadius: theme.r.lg, overflow: "hidden", borderWidth: 1, borderColor: theme.c.borderStrong, backgroundColor: theme.c.surfaceSecondary },
  heroContent: { flex: 1, padding: theme.s.lg, justifyContent: "flex-end" },
  heroBadge: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", backgroundColor: theme.c.brand, paddingHorizontal: theme.s.sm, paddingVertical: 4, borderRadius: theme.r.sm, marginBottom: theme.s.sm },
  heroBadgeText: { color: "#fff", fontSize: 10, fontWeight: "900", marginLeft: 4, letterSpacing: 1 },
  heroTitle: { color: "#fff", fontSize: 24, fontFamily: theme.f.display, lineHeight: 28 },
  heroLocation: { color: theme.c.onSurfaceSecondary, fontSize: 12, marginTop: 2, marginBottom: theme.s.md },
  heroFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  miniLabel: { color: theme.c.onSurfaceTertiary, fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  miniValue: { color: theme.c.brandSecondary, fontSize: 18, fontWeight: "900" },
  playBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: theme.c.brand, paddingHorizontal: theme.s.lg, paddingVertical: theme.s.md, borderRadius: theme.r.pill },
  playBtnText: { color: "#fff", fontWeight: "900", letterSpacing: 1, fontSize: 14 },

  sectionTitle: { color: theme.c.onSurface, fontSize: 14, fontWeight: "900", letterSpacing: 2, marginTop: theme.s.xl, marginBottom: theme.s.md },
  recordRow: { flexDirection: "row", gap: theme.s.sm },
  recordCard: { flex: 1, backgroundColor: theme.c.surfaceSecondary, padding: theme.s.md, borderRadius: theme.r.md, borderWidth: 1, borderColor: theme.c.border },
  recordValue: { color: theme.c.onSurface, fontSize: 24, fontWeight: "900", marginTop: 6 },
  recordLabel: { color: theme.c.onSurfaceTertiary, fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  smallCard: { flexDirection: "row", alignItems: "center", backgroundColor: theme.c.surfaceSecondary, padding: theme.s.md, borderRadius: theme.r.md, borderWidth: 1, borderColor: theme.c.border, marginBottom: theme.s.sm },
  smallEmoji: { fontSize: 32 },
  smallTitle: { color: theme.c.onSurface, fontSize: 14, fontWeight: "800" },
  smallSub: { color: theme.c.onSurfaceTertiary, fontSize: 12, marginTop: 2 },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", alignItems: "center", justifyContent: "center", padding: theme.s.lg },
  dailyCard: { width: "100%", maxWidth: 400, backgroundColor: theme.c.surfaceSecondary, padding: theme.s.lg, borderRadius: theme.r.lg, borderWidth: 2, borderColor: theme.c.brandSecondary },
  dailyHeadline: { color: theme.c.onSurface, fontSize: 26, fontFamily: theme.f.display, fontWeight: "900", letterSpacing: 1, textAlign: "center" },
  dailySubHead: { color: theme.c.brandSecondary, fontSize: 12, fontWeight: "800", textAlign: "center", marginTop: 4, letterSpacing: 1 },
  daysGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: theme.s.lg, justifyContent: "center" },
  dayCell: { width: "30%", aspectRatio: 1, backgroundColor: theme.c.surface, alignItems: "center", justifyContent: "center", borderRadius: theme.r.sm, borderWidth: 1, borderColor: theme.c.border },
  dayCellDone: { backgroundColor: theme.c.success, borderColor: theme.c.success },
  dayCellToday: { borderColor: theme.c.brand, borderWidth: 2 },
  dayLabel: { color: theme.c.onSurfaceTertiary, fontSize: 9, fontWeight: "700", letterSpacing: 1 },
  dayIcon: { fontSize: 26 },
  dayQty: { color: "#fff", fontSize: 14, fontWeight: "900" },
  claimBtn: { backgroundColor: theme.c.brand, paddingVertical: theme.s.md, borderRadius: theme.r.pill, alignItems: "center", marginTop: theme.s.lg },
  claimBtnText: { color: "#fff", fontWeight: "900", letterSpacing: 1, fontSize: 16 },
});
