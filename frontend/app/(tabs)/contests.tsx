import { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/src/theme";
import { api } from "@/src/api";

const DIFF_COLORS: Record<string, string> = {
  Easy: theme.c.success,
  Medium: theme.c.brandSecondary,
  Hard: theme.c.brandTertiary,
  Legendary: theme.c.brand,
};

export default function ContestsScreen() {
  const router = useRouter();
  const [contests, setContests] = useState<any[]>([]);
  const [coins, setCoins] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [c, p] = await Promise.all([api.listContests(), api.getPlayer()]);
    setContests(c.contests || []);
    setCoins(p.coins || 0);
  }, []);

  useFocusEffect(useCallback(() => { load().catch(console.error); }, [load]));

  return (
    <SafeAreaView edges={["top"]} style={styles.container} testID="contests-screen">
      <View style={styles.header}>
        <View>
          <Text style={styles.h1}>CONTESTS</Text>
          <Text style={styles.sub}>Pick your battlefield</Text>
        </View>
        <View style={styles.coinPill}>
          <Text style={{ fontSize: 14 }}>🪙</Text>
          <Text style={styles.coinText}>{coins}</Text>
        </View>
      </View>

      <FlatList
        data={contests}
        keyExtractor={(it) => it.id}
        contentContainerStyle={{ padding: theme.s.lg, paddingBottom: theme.s.xxxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={theme.c.brand} />}
        renderItem={({ item }) => {
          const canAfford = coins >= item.entry_fee;
          return (
            <Pressable
              testID={`contest-card-${item.id}`}
              onPress={() => canAfford && router.push(`/play/${item.id}` as any)}
              style={[styles.card, !canAfford && { opacity: 0.6 }]}
            >
              <Image source={{ uri: item.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
              <LinearGradient colors={["rgba(15,17,21,0.15)", "rgba(15,17,21,0.95)"]} style={StyleSheet.absoluteFill} />
              <View style={styles.cardContent}>
                <View style={styles.cardTopRow}>
                  <View style={[styles.diffBadge, { backgroundColor: DIFF_COLORS[item.difficulty] || theme.c.brand }]}>
                    <Text style={styles.diffText}>{item.difficulty.toUpperCase()}</Text>
                  </View>
                  <Text style={styles.foodEmoji}>{item.food_emoji}</Text>
                </View>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.name}</Text>
                <Text style={styles.cardLocation}>📍 {item.location} · {item.duration_sec}s</Text>
                <View style={styles.cardFooter}>
                  <View style={styles.feeBlock}>
                    <Text style={styles.feeLabel}>ENTRY</Text>
                    <Text style={[styles.feeValue, !canAfford && { color: theme.c.error }]}>🪙 {item.entry_fee}</Text>
                  </View>
                  <View style={styles.feeBlock}>
                    <Text style={styles.feeLabel}>PRIZE</Text>
                    <Text style={[styles.feeValue, { color: theme.c.brandSecondary }]}>🪙 {item.prize_pool}</Text>
                  </View>
                  <View style={styles.enterBtn}>
                    <Text style={styles.enterBtnText}>{canAfford ? "ENTER" : "LOCKED"}</Text>
                    <Ionicons name={canAfford ? "arrow-forward" : "lock-closed"} size={14} color="#fff" />
                  </View>
                </View>
              </View>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.c.surface },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: theme.s.lg, paddingVertical: theme.s.md,
    borderBottomColor: theme.c.border, borderBottomWidth: 1,
  },
  h1: { color: theme.c.onSurface, fontSize: 32, fontFamily: theme.f.display, letterSpacing: 1 },
  sub: { color: theme.c.onSurfaceTertiary, fontSize: 12 },
  coinPill: { flexDirection: "row", alignItems: "center", backgroundColor: theme.c.surfaceSecondary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.r.pill, borderWidth: 1, borderColor: theme.c.border },
  coinText: { color: theme.c.onSurface, fontWeight: "800", marginLeft: 4 },
  card: {
    height: 200, borderRadius: theme.r.lg, overflow: "hidden", marginBottom: theme.s.md,
    borderWidth: 1, borderColor: theme.c.borderStrong, backgroundColor: theme.c.surfaceSecondary,
  },
  cardContent: { flex: 1, padding: theme.s.lg, justifyContent: "space-between" },
  cardTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  diffBadge: { paddingHorizontal: theme.s.sm, paddingVertical: 4, borderRadius: theme.r.sm },
  diffText: { color: "#fff", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  foodEmoji: { fontSize: 32 },
  cardTitle: { color: "#fff", fontSize: 22, fontFamily: theme.f.display, lineHeight: 24 },
  cardLocation: { color: theme.c.onSurfaceSecondary, fontSize: 12, marginTop: 2 },
  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: theme.s.sm },
  feeBlock: { },
  feeLabel: { color: theme.c.onSurfaceTertiary, fontSize: 9, fontWeight: "700", letterSpacing: 1 },
  feeValue: { color: "#fff", fontSize: 16, fontWeight: "900" },
  enterBtn: { flexDirection: "row", alignItems: "center", backgroundColor: theme.c.brand, paddingHorizontal: theme.s.md, paddingVertical: theme.s.sm, borderRadius: theme.r.pill, gap: 4 },
  enterBtnText: { color: "#fff", fontWeight: "900", letterSpacing: 1, fontSize: 13 },
});
