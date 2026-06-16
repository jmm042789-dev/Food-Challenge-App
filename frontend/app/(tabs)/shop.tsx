import { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from "react-native";
import { useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "@/src/theme";
import { api } from "@/src/api";
import { sfx } from "@/src/audio";
import * as Haptics from "expo-haptics";

type Section = { section: string; items: any[] };

export default function ShopScreen() {
  const [items, setItems] = useState<any[]>([]);
  const [player, setPlayer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [s, p] = await Promise.all([api.shop(), api.getPlayer()]);
    setItems(s.items || []);
    setPlayer(p);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load().catch(console.error); }, [load]));

  const buy = async (item: any) => {
    setBusyId(item.id);
    try {
      const r = await api.purchase(item.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      sfx.play("reward");
      setPlayer((p: any) => ({ ...p, coins: r.new_coins, tums: r.new_tums, owned_gear: r.owned_gear ?? p?.owned_gear }));
      const label = item.type === "gear" ? "Gear unlocked!" : `+${item.qty} ${item.type}!`;
      setToast(label);
      setTimeout(() => setToast(null), 2000);
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setToast(e?.message?.includes("400") ? "Not enough coins / already owned" : "Purchase failed");
      setTimeout(() => setToast(null), 2000);
    } finally {
      setBusyId(null);
    }
  };

  const sections: Section[] = [
    { section: "GEAR — Permanent Perks", items: items.filter((i) => i.type === "gear") },
    { section: "TUMS PACKS (Buy w/ Coins)", items: items.filter((i) => i.type === "tums") },
    { section: "COIN BUNDLES (Real $)", items: items.filter((i) => i.type === "coins") },
  ];

  return (
    <SafeAreaView edges={["top"]} style={styles.container} testID="shop-screen">
      <View style={styles.header}>
        <View>
          <Text style={styles.h1}>SHOP</Text>
          <Text style={styles.sub}>Fuel up for battle</Text>
        </View>
        <View style={styles.balanceRow}>
          <View style={styles.balPill}><Text>🪙</Text><Text style={styles.balTxt}>{player?.coins ?? 0}</Text></View>
          <View style={[styles.balPill, { marginLeft: 6 }]}><Text>💊</Text><Text style={styles.balTxt}>{player?.tums ?? 0}</Text></View>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={theme.c.brand} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(it) => it.section}
          contentContainerStyle={{ padding: theme.s.lg, paddingBottom: theme.s.xxxl }}
          renderItem={({ item: section }) => (
            <View>
              <Text style={styles.sectionTitle}>{section.section}</Text>
              <View style={styles.grid}>
                {section.items.map((it: any) => {
                  const owned = it.type === "gear" && (player?.owned_gear || []).includes(it.id);
                  return (
                    <Pressable
                      key={it.id}
                      testID={`shop-item-${it.id}`}
                      style={[styles.itemCard, owned && styles.itemCardOwned]}
                      onPress={() => !owned && buy(it)}
                      disabled={busyId === it.id || owned}
                    >
                      <Text style={styles.itemIcon}>{it.icon}</Text>
                      <Text style={styles.itemName} numberOfLines={1}>{it.name}</Text>
                      {it.type === "gear" ? (
                        <Text style={styles.gearPerk} numberOfLines={2}>{it.perk}</Text>
                      ) : (
                        <Text style={styles.itemQty}>x{it.qty}</Text>
                      )}
                      <View style={[styles.buyBtn, busyId === it.id && { opacity: 0.5 }, owned && { backgroundColor: theme.c.success }]}>
                        <Text style={styles.buyBtnText}>
                          {owned ? "OWNED" : it.type === "tums" || it.type === "gear" ? `🪙 ${it.price}` : `$${it.price_usd}`}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
        />
      )}

      {toast && (
        <View style={styles.toast} testID="shop-toast">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.c.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: theme.s.lg, paddingVertical: theme.s.md, borderBottomColor: theme.c.border, borderBottomWidth: 1 },
  h1: { color: theme.c.onSurface, fontSize: 32, fontFamily: theme.f.display, letterSpacing: 1 },
  sub: { color: theme.c.onSurfaceTertiary, fontSize: 12 },
  balanceRow: { flexDirection: "row" },
  balPill: { flexDirection: "row", alignItems: "center", backgroundColor: theme.c.surfaceSecondary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.r.pill, borderWidth: 1, borderColor: theme.c.border, gap: 4 },
  balTxt: { color: theme.c.onSurface, fontWeight: "800" },
  sectionTitle: { color: theme.c.onSurface, fontSize: 13, fontWeight: "900", letterSpacing: 2, marginTop: theme.s.lg, marginBottom: theme.s.md },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: theme.s.md },
  itemCard: { width: "47%", backgroundColor: theme.c.surfaceSecondary, padding: theme.s.md, borderRadius: theme.r.md, borderWidth: 1, borderColor: theme.c.border, alignItems: "center" },
  itemCardOwned: { borderColor: theme.c.success, opacity: 0.85 },
  itemIcon: { fontSize: 48 },
  itemName: { color: theme.c.onSurface, fontSize: 13, fontWeight: "800", marginTop: 6, textAlign: "center" },
  itemQty: { color: theme.c.brandSecondary, fontSize: 16, fontWeight: "900", marginVertical: 4 },
  gearPerk: { color: theme.c.onSurfaceTertiary, fontSize: 10, textAlign: "center", marginTop: 4, marginBottom: 6, height: 30 },
  buyBtn: { backgroundColor: theme.c.brand, paddingHorizontal: theme.s.lg, paddingVertical: theme.s.sm, borderRadius: theme.r.pill, marginTop: 4 },
  buyBtnText: { color: "#fff", fontWeight: "900", fontSize: 13 },
  toast: { position: "absolute", bottom: 90, alignSelf: "center", backgroundColor: theme.c.success, paddingHorizontal: theme.s.lg, paddingVertical: theme.s.md, borderRadius: theme.r.pill },
  toastText: { color: "#000", fontWeight: "900" },
});
