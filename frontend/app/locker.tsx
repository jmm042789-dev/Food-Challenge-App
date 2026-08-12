import React, { useCallback, useMemo, useRef, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "../src/api";
import FireBadge from "../src/components/fire/FireBadge";
import FireButton from "../src/components/fire/FireButton";
import FireLoading from "../src/components/fire/FireLoading";
import ArcadeBackground from "../src/game/ui/ArcadeBackground";
import { playerFacingErrorMessage } from "../src/playerFacingErrors";
import { equipmentStatus } from "../src/equipmentState";

type LockerItem = { id: string; name: string; type: "gear" | "cosmetic"; icon?: string; rarity?: string; slot?: string; description?: string; perk?: string };
type LockerPlayer = { owned_gear: string[]; equipped_gear?: string | null; equipped_cosmetic?: string | null };

export default function LockerScreen() {
  const router = useRouter();
  const [items, setItems] = useState<LockerItem[]>([]);
  const [player, setPlayer] = useState<LockerPlayer>({ owned_gear: [] });
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const actionInFlight = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [gearResponse, shopResponse, playerResponse] = await Promise.all([api.gear(), api.shop(), api.getPlayer()]);
      const gear = Array.isArray(gearResponse?.items) ? gearResponse.items.map((item: LockerItem) => ({ ...item, type: "gear" as const })) : [];
      const cosmetics = Array.isArray(shopResponse?.items) ? shopResponse.items.filter((item: LockerItem) => item.type === "cosmetic") : [];
      setItems([...gear, ...cosmetics]);
      setPlayer({ owned_gear: [], ...(playerResponse as Partial<LockerPlayer>) });
    } catch (error) {
      Alert.alert("Locker unavailable", playerFacingErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const ownedItems = useMemo(() => items.filter((item) => player.owned_gear.includes(item.id)), [items, player.owned_gear]);

  const equip = useCallback(async (item: LockerItem) => {
    if (actionInFlight.current || !player.owned_gear.includes(item.id)) return;
    actionInFlight.current = true;
    setPendingId(item.id);
    try {
      if (item.type === "cosmetic") await api.equipCosmetic(item.id);
      else await api.equipGear(item.id);
      await load();
    } catch (error) {
      Alert.alert("Could not equip item", playerFacingErrorMessage(error));
    } finally {
      actionInFlight.current = false;
      setPendingId(null);
    }
  }, [load, player.owned_gear]);

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.screen}>
      <ArcadeBackground />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View><Text style={styles.eyebrow}>PLAYER LOADOUT</Text><Text style={styles.title}>LOCKER / GEAR</Text></View>
          <FireButton title="BACK" size="compact" variant="secondary" onPress={() => router.back()} />
        </View>
        <Text style={styles.guidance}>Equip one gameplay item and one cosmetic. Equipping is free and never changes your coin balance.</Text>
        {loading && !items.length ? <FireLoading title="Opening Locker" subtitle="Loading your owned equipment." /> : null}
        {!loading && !ownedItems.length ? <View style={styles.empty}><Text style={styles.emptyTitle}>YOUR LOCKER IS EMPTY</Text><Text style={styles.emptyText}>Owned equipment and cosmetics from the Shop will appear here.</Text></View> : null}
        {ownedItems.map((item) => {
          const equipped = equipmentStatus(item, player) === "equipped";
          return (
            <View key={item.id} style={[styles.item, equipped && styles.itemEquipped]}>
              <Text style={styles.icon}>{item.icon || "🔥"}</Text>
              <View style={styles.info}>
                <View style={styles.nameRow}><Text numberOfLines={1} style={styles.name}>{item.name}</Text>{equipped ? <FireBadge label="EQUIPPED" variant="success" /> : <FireBadge label="OWNED" variant="gold" />}</View>
                <Text style={styles.meta}>{`${item.rarity || "ITEM"} · ${item.type === "cosmetic" ? "COSMETIC" : item.slot || "GEAR"}`.toUpperCase()}</Text>
                <Text numberOfLines={2} style={styles.description}>{item.description || item.perk || "Owned Fire Feast item."}</Text>
              </View>
              <FireButton title={equipped ? "EQUIPPED" : "EQUIP"} size="compact" variant={equipped ? "secondary" : "gold"} disabled={equipped || pendingId !== null} loading={pendingId === item.id} onPress={() => { void equip(item); }} />
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#070405", flex: 1 },
  content: { alignSelf: "center", maxWidth: 720, paddingBottom: 22, paddingHorizontal: 12, paddingTop: 8, width: "100%" },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  eyebrow: { color: "#B7793C", fontSize: 8, fontWeight: "900", letterSpacing: 1.4 },
  title: { color: "#FFF0D8", fontSize: 27, fontWeight: "900" },
  guidance: { color: "#CDBEAD", fontSize: 12, lineHeight: 17, marginBottom: 12, marginTop: 5 },
  item: { alignItems: "center", backgroundColor: "rgba(14,9,10,0.96)", borderColor: "rgba(216,128,38,0.55)", borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 9, marginBottom: 8, minHeight: 96, padding: 9 },
  itemEquipped: { borderColor: "#F6C76A", borderWidth: 2 },
  icon: { fontSize: 42 }, info: { flex: 1, minWidth: 0 }, nameRow: { alignItems: "center", flexDirection: "row", gap: 5 },
  name: { color: "#FFF0D8", flex: 1, fontSize: 15, fontWeight: "900" }, meta: { color: "#D0954C", fontSize: 8, fontWeight: "900", marginTop: 3 },
  description: { color: "#A99482", fontSize: 10, lineHeight: 14, marginTop: 4 },
  empty: { alignItems: "center", backgroundColor: "rgba(14,9,10,0.95)", borderColor: "rgba(216,128,38,0.5)", borderRadius: 12, borderWidth: 1, padding: 24 },
  emptyTitle: { color: "#FFD06A", fontSize: 16, fontWeight: "900" }, emptyText: { color: "#B9A18D", marginTop: 6, textAlign: "center" },
});
