import ArcadeBackground from "../../src/game/ui/ArcadeBackground";
import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../src/api";
import * as Haptics from "expo-haptics";

type Section = { section: string; items: any[] };

export default function ShopScreen() {
  const [items, setItems] = useState<any[]>([]);
  const [player, setPlayer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // ======================
  // LOAD SHOP + PLAYER
  // ======================
  const load = useCallback(async () => {
    try {
      setLoading(true);

      const [shopRes, playerRes] = await Promise.all([
        api.shop(),
        api.getPlayer(),
      ]);

      setItems(shopRes?.items || []);
      setPlayer(playerRes);
    } catch (err) {
      console.log("SHOP LOAD ERROR:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // ======================
  // PURCHASE HANDLER (A.4 FIX)
  // ======================
  const handleBuy = async (item: any) => {
    try {
      setBusyId(item.id);
      Haptics.selectionAsync();

      await api.purchase(item.id);

      // 🔥 A.4 FIX (THIS IS THE IMPORTANT PART)
      await load(); // refresh shop + player state
    } catch (err) {
      console.log("PURCHASE ERROR:", err);
    } finally {
      setBusyId(null);
    }
  };

  const sections: Section[] = [
    {
      section: "GEAR — Permanent Perks",
      items: items.filter((i) => i.type === "gear"),
    },
    {
      section: "ANTACID PACKS (Buy w/ Coins)",
      items: items.filter((i) => i.type === "tums"),
    },
    {
      section: "COIN BUNDLES (Real $)",
      items: items.filter((i) => i.type === "coins"),
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ArcadeBackground />

      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.h1}>SHOP</Text>
          <Text style={styles.sub}>Fuel up for battle</Text>
        </View>

        <View style={styles.balanceRow}>
          <View style={styles.balPill}>
            <Text>🪙</Text>
            <Text style={styles.balTxt}>{player?.coins ?? 0}</Text>
          </View>

          <View style={[styles.balPill, { marginLeft: 6 }]}>
            <Text>🧪</Text>
            <Text style={styles.balTxt}>{player?.tums ?? 0}</Text>
          </View>
        </View>
      </View>

      {/* BANNER */}
      <View style={styles.featureBanner}>
        <Text style={styles.featureTitle}>⚡ LIMITED TIME</Text>
        <Text style={styles.featureText}>Double XP Weekend Active</Text>
      </View>

      {/* CONTENT */}
      {loading ? (
        <ActivityIndicator color="#FFD700" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(it) => it.section}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: 80,
          }}
          renderItem={({ item: section }) => (
            <View>
              <Text style={styles.sectionTitle}>{section.section}</Text>

              <View style={styles.grid}>
                {section.items.map((it: any) => {
                  const owned =
                    it.type === "gear" &&
                    (player?.owned_gear || []).includes(it.id);

                  return (
                    <Pressable
                      key={it.id}
                      style={[
                        styles.itemCard,
                        owned && styles.itemCardOwned,
                      ]}
                      disabled={busyId === it.id || owned}
                      onPress={() => handleBuy(it)}
                    >
                      <Text style={styles.itemIcon}>{it.icon}</Text>

                      <Text style={styles.itemName} numberOfLines={1}>
                        {it.name}
                      </Text>

                      {it.type === "gear" ? (
                        <Text style={styles.gearPerk} numberOfLines={2}>
                          {it.perk}
                        </Text>
                      ) : (
                        <Text style={styles.itemQty}>x{it.qty}</Text>
                      )}

                      <View
                        style={[
                          styles.buyBtn,
                          owned && { backgroundColor: "#22c55e" },
                        ]}
                      >
                        <Text style={styles.buyBtnText}>
                          {owned
                            ? "OWNED"
                            : it.type === "coins" || it.type === "gear"
                            ? `🪙 ${it.price}`
                            : `$${it.price_usd}`}
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

      {/* TOAST */}
      {toast && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0F17",
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    borderBottomColor: "rgba(255,255,255,0.08)",
    borderBottomWidth: 1,
  },

  h1: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 1,
  },

  sub: {
    color: "#A0A0A0",
    fontSize: 13,
  },

  balanceRow: {
    flexDirection: "row",
  },

  balPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(28,31,38,0.9)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    marginLeft: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  balTxt: {
    color: "white",
    fontWeight: "800",
  },

  featureBanner: {
    margin: 16,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "rgba(255,215,0,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.25)",
  },

  featureTitle: {
    color: "#FFD700",
    fontSize: 18,
    fontWeight: "900",
  },

  featureText: {
    color: "#FFFFFF",
    marginTop: 4,
  },

  sectionTitle: {
    color: "white",
    fontSize: 13,
    fontWeight: "900",
    marginTop: 20,
    marginBottom: 10,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  itemCard: {
    width: "47%",
    backgroundColor: "rgba(28,31,38,0.9)",
    padding: 14,
    borderRadius: 18,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  itemCardOwned: {
    borderColor: "#22c55e",
    opacity: 0.8,
  },

  itemIcon: {
    fontSize: 52,
    marginBottom: 4,
  },

  itemName: {
    color: "white",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 6,
    textAlign: "center",
  },

  itemQty: {
    color: "#FFD700",
    fontSize: 14,
    fontWeight: "900",
  },

  gearPerk: {
    color: "#aaa",
    fontSize: 10,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 6,
  },

  buyBtn: {
    backgroundColor: "#FFD700",
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
    marginTop: 8,
  },

  buyBtnText: {
    color: "#000",
    fontWeight: "900",
    fontSize: 12,
  },

  toast: {
    position: "absolute",
    bottom: 80,
    alignSelf: "center",
    backgroundColor: "#22c55e",
    padding: 12,
    borderRadius: 999,
  },

  toastText: {
    color: "#000",
    fontWeight: "900",
  },
});