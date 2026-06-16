import { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl, ActivityIndicator } from "react-native";
import { useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "@/src/theme";
import { api, getDeviceId } from "@/src/api";

export default function LeaderboardScreen() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [me, setMe] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [data, dev] = await Promise.all([api.leaderboard(), getDeviceId()]);
    setMe(dev);
    setRows((data.leaderboard || []).map((r: any) => ({ ...r, is_you: r.device_id === dev })));
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load().catch(console.error); }, [load]));

  return (
    <SafeAreaView edges={["top"]} style={styles.container} testID="leaderboard-screen">
      <View style={styles.header}>
        <Text style={styles.h1}>GLOBAL RANKS</Text>
        <Text style={styles.sub}>Top eaters worldwide</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={theme.c.brand} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(it, i) => `${it.username}-${i}`}
          contentContainerStyle={{ padding: theme.s.lg, paddingBottom: theme.s.xxxl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={theme.c.brand} />}
          renderItem={({ item, index }) => {
            const isTop3 = index < 3;
            const medalColor = index === 0 ? theme.c.brandSecondary : index === 1 ? "#C0C0C0" : index === 2 ? "#CD7F32" : null;
            return (
              <View
                style={[
                  styles.row,
                  isTop3 && { backgroundColor: theme.c.surfaceSecondary, borderColor: medalColor!, borderWidth: 1 },
                  item.is_you && { borderColor: theme.c.brand, borderWidth: 2 },
                ]}
                testID={`rank-row-${index + 1}`}
              >
                <View style={styles.rankBox}>
                  <Text style={[styles.rankText, medalColor ? { color: medalColor } : null]}>{item.rank}</Text>
                </View>
                <Text style={styles.flag}>{item.country}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.username} numberOfLines={1}>
                    {item.avatar} {item.username} {item.is_you ? "  (YOU)" : ""}
                  </Text>
                  <Text style={styles.scoreSub}>Best: {item.score} items</Text>
                </View>
                <Text style={styles.bigScore}>{item.score}</Text>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.c.surface },
  header: { paddingHorizontal: theme.s.lg, paddingVertical: theme.s.md, borderBottomColor: theme.c.border, borderBottomWidth: 1 },
  h1: { color: theme.c.onSurface, fontSize: 32, fontFamily: theme.f.display, letterSpacing: 1 },
  sub: { color: theme.c.onSurfaceTertiary, fontSize: 12 },
  row: {
    flexDirection: "row", alignItems: "center", gap: theme.s.md,
    padding: theme.s.md, borderRadius: theme.r.md, marginBottom: theme.s.sm,
    backgroundColor: theme.c.surfaceSecondary,
  },
  rankBox: { width: 36, alignItems: "center" },
  rankText: { color: theme.c.onSurface, fontSize: 22, fontFamily: theme.f.display, fontWeight: "900" },
  flag: { fontSize: 22 },
  username: { color: theme.c.onSurface, fontWeight: "800", fontSize: 14 },
  scoreSub: { color: theme.c.onSurfaceTertiary, fontSize: 11, marginTop: 2 },
  bigScore: { color: theme.c.brandSecondary, fontSize: 20, fontWeight: "900" },
});
