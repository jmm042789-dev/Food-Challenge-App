import React, { useCallback, useMemo, useState } from "react";
import { Alert, Image, SectionList, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "../../src/api";
import FireBadge from "../../src/components/fire/FireBadge";
import FireButton from "../../src/components/fire/FireButton";
import FireScreenEntrance from "../../src/components/fire/FireScreenEntrance";
import ArcadeBackground from "../../src/game/ui/ArcadeBackground";
import { trackAchievementEvent } from "../../src/achievements/AchievementTracker";

const COIN = require("../../src/assets/icons/coin.png");
const ANTACID = require("../../src/assets/icons/antacid.png");

type ShopItem = {
  id: string;
  name: string;
  type: string;
  category: string;
  icon?: string;
  price: number;
  reward?: number;
  rarity?: string;
  perk?: string;
  description?: string;
};

type Player = {
  coins: number;
  antacid: number;
  owned_gear: string[];
  equipped_gear?: string | null;
};

const EMPTY_PLAYER: Player = { coins: 0, antacid: 0, owned_gear: [], equipped_gear: null };

function CurrencyCounter({ icon, label, value }: { icon: number; label: string; value: number }) {
  return (
    <View style={styles.counter}>
      <Image source={icon} resizeMode="contain" style={styles.counterIcon} />
      <View style={styles.headerTitleBlock}>
        <Text style={styles.counterLabel}>{label}</Text>
        <Text style={styles.counterValue}>{Number(value || 0).toLocaleString()}</Text>
      </View>
    </View>
  );
}

function Price({ item }: { item: ShopItem }) {
  return (
    <View style={styles.priceRow}>
      <Image source={COIN} resizeMode="contain" style={styles.priceIcon} />
      <Text style={styles.price}>{Number(item.price).toLocaleString()}</Text>
    </View>
  );
}

export default function ShopScreen() {
  const isFocused = useIsFocused();
  const [items, setItems] = useState<ShopItem[]>([]);
  const [player, setPlayer] = useState<Player>(EMPTY_PLAYER);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [shopResult, playerResult] = await Promise.allSettled([api.shop(), api.getPlayer()]);
    if (shopResult.status === "fulfilled" && Array.isArray(shopResult.value?.items)) {
      setItems(shopResult.value.items);
    } else {
      setItems([]);
      setError("SHOP INVENTORY UNAVAILABLE");
    }
    if (playerResult.status === "fulfilled" && playerResult.value) {
      setPlayer({ ...EMPTY_PLAYER, ...(playerResult.value as Partial<Player>) });
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const featured = items[0];
  const sections = useMemo(() => {
    const groups = new Map<string, ShopItem[]>();
    items.slice(1).forEach((item) => {
      const key = item.category || item.type || "Shop Items";
      groups.set(key, [...(groups.get(key) || []), item]);
    });
    return Array.from(groups, ([title, data]) => ({ title, data }));
  }, [items]);

  const actOnItem = useCallback(async (item: ShopItem) => {
    const owned = player.owned_gear.includes(item.id);
    const equipped = player.equipped_gear === item.id;
    if (equipped) return;
    setPendingId(item.id);
    try {
      if (owned && item.type === "gear") {
        await api.equipGear(item.id);
      } else {
        await api.purchase(item.id);
        if (item.type === "gear") {
          await trackAchievementEvent({ type: "ITEM_ACQUIRED", ownedItemCount: player.owned_gear.length + 1 });
        }
      }
      await load();
    } catch (purchaseError: any) {
      Alert.alert("Shop action failed", purchaseError?.message || "Please try again.");
    } finally {
      setPendingId(null);
    }
  }, [load, player.equipped_gear, player.owned_gear]);

  const statusFor = useCallback((item: ShopItem) => {
    if (player.equipped_gear === item.id) return "equipped";
    if (player.owned_gear.includes(item.id)) return "owned";
    return "available";
  }, [player.equipped_gear, player.owned_gear]);

  const renderItem = ({ item }: { item: ShopItem }) => {
    const status = statusFor(item);
    const unaffordable = item.price > player.coins;
    return (
      <View style={[styles.itemRow, unaffordable && status === "available" && styles.subdued]}>
        <View style={styles.itemArt}><Text style={styles.itemEmoji}>{item.icon || "🔥"}</Text></View>
        <View style={styles.itemInfo}>
          <View style={styles.itemTitleRow}>
            <Text numberOfLines={2} style={styles.itemName}>{item.name}</Text>
            {status !== "available" ? <FireBadge label={status.toUpperCase()} variant={status === "equipped" ? "success" : "gold"} /> : null}
          </View>
          <Text numberOfLines={2} style={styles.itemMeta}>{[item.rarity, item.perk].filter(Boolean).join(" · ")}</Text>
          <Text numberOfLines={3} style={styles.itemDescription}>{item.description}</Text>
        </View>
        <View style={styles.itemAction}>
          <Price item={item} />
          <FireButton
            title={status === "equipped" ? "EQUIPPED" : status === "owned" && item.type === "gear" ? "EQUIP" : "BUY"}
            onPress={() => actOnItem(item)}
            disabled={status === "equipped" || (unaffordable && status === "available")}
            loading={pendingId === item.id}
            size="compact"
            variant={status === "owned" ? "secondary" : "primary"}
            style={styles.rowButton}
          />
        </View>
      </View>
    );
  };

  const header = (
    <>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>FIRE FEAST</Text>
          <Text style={styles.headerTitle}>SHOP</Text>
        </View>
        <View style={styles.balanceRow}>
          <CurrencyCounter icon={COIN} label="COINS" value={player.coins} />
          <CurrencyCounter icon={ANTACID} label="ANTACID" value={player.antacid} />
        </View>
      </View>

      {featured ? (
        <FireScreenEntrance duration="fast" distance={8}>
          <View style={styles.featured}>
            <View style={styles.featuredHighlight} pointerEvents="none" />
            <View style={styles.featuredTop}>
              <View style={styles.featuredArt}><Text style={styles.featuredEmoji}>{featured.icon || "🔥"}</Text></View>
              <View style={styles.featuredInfo}>
                <FireBadge label="FEATURED" variant="gold" />
                <Text numberOfLines={2} style={styles.featuredName}>{featured.name}</Text>
                <Text numberOfLines={3} style={styles.featuredDescription}>{featured.description}</Text>
                <View style={styles.featuredMeta}>
                  <Price item={featured} />
                  <Text style={styles.featuredPerk}>{featured.perk}</Text>
                </View>
              </View>
            </View>
            <FireButton
              title={statusFor(featured) === "equipped" ? "EQUIPPED" : statusFor(featured) === "owned" && featured.type === "gear" ? "EQUIP ITEM" : "PURCHASE ITEM"}
              onPress={() => actOnItem(featured)}
              disabled={statusFor(featured) === "equipped" || (featured.price > player.coins && statusFor(featured) === "available")}
              loading={pendingId === featured.id}
              variant="gold"
              size="small"
              fullWidth
              style={styles.featuredButton}
            />
          </View>
        </FireScreenEntrance>
      ) : null}

      {error ? <View style={styles.messagePanel}><Text style={styles.message}>{error}</Text><FireButton title="RETRY" onPress={() => { void load(); }} size="small" variant="secondary" /></View> : null}
    </>
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ArcadeBackground active={isFocused} />
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title.toUpperCase()}</Text>
            <View style={styles.sectionRule} />
            <Text style={styles.sectionCount}>{section.data.length}</Text>
          </View>
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={!loading && !featured && !error ? <Text style={styles.message}>NO ITEMS AVAILABLE</Text> : null}
        ListFooterComponent={loading ? <Text style={styles.loading}>REFRESHING SHOP…</Text> : <View style={styles.footerSpace} />}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        initialNumToRender={8}
        windowSize={7}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#070405", flex: 1 },
  content: { paddingHorizontal: 12, paddingTop: 6 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 8, minWidth: 0 },
  headerTitleBlock: { flexShrink: 1, minWidth: 0, paddingRight: 6 },
  eyebrow: { color: "#B7793C", fontSize: 7, fontWeight: "900", letterSpacing: 1.5 },
  headerTitle: { color: "#FFF0D8", fontSize: 28, fontWeight: "900", letterSpacing: 1.2, lineHeight: 30 },
  balanceRow: { flexDirection: "row", flexShrink: 0, gap: 4 },
  counter: { alignItems: "center", backgroundColor: "rgba(8,6,7,0.94)", borderColor: "rgba(225,136,45,0.58)", borderRadius: 8, borderWidth: 1, flexDirection: "row", minWidth: 78, paddingHorizontal: 6, paddingVertical: 5 },
  counterIcon: { height: 23, marginRight: 5, width: 23 },
  counterLabel: { color: "#987B62", fontSize: 6, fontWeight: "900", letterSpacing: 0.7 },
  counterValue: { color: "#FFD06A", fontSize: 12, fontWeight: "900", lineHeight: 14 },
  featured: { backgroundColor: "rgba(17,10,10,0.96)", borderColor: "#D88A2A", borderRadius: 15, borderWidth: 1.5, overflow: "hidden", padding: 10 },
  featuredHighlight: { backgroundColor: "rgba(255,210,125,0.18)", height: 1, left: 12, position: "absolute", right: 12, top: 1 },
  featuredTop: { alignItems: "center", flexDirection: "row", minHeight: 132 },
  featuredArt: { alignItems: "center", backgroundColor: "rgba(65,23,12,0.54)", borderColor: "rgba(233,141,42,0.52)", borderRadius: 12, borderWidth: 1, height: 124, justifyContent: "center", marginRight: 11, width: "38%" },
  featuredEmoji: { fontSize: 68 },
  featuredInfo: { flex: 1, minWidth: 0 },
  featuredName: { color: "#FFF0D8", fontSize: 21, fontWeight: "900", lineHeight: 23 },
  featuredDescription: { color: "#B9A18D", fontSize: 10, lineHeight: 14, marginTop: 4 },
  featuredMeta: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  featuredPerk: { color: "#DDA455", flex: 1, fontSize: 8, fontWeight: "800", marginLeft: 9, textAlign: "right" },
  featuredButton: { marginBottom: 0, marginTop: 8 },
  priceRow: { alignItems: "center", flexDirection: "row" },
  priceIcon: { height: 18, marginRight: 3, width: 18 },
  price: { color: "#FFC75B", fontSize: 15, fontWeight: "900" },
  sectionHeader: { alignItems: "center", flexDirection: "row", marginBottom: 6, marginTop: 11, paddingHorizontal: 2 },
  sectionTitle: { color: "#E8BD7A", fontSize: 10, fontWeight: "900", letterSpacing: 1.1 },
  sectionRule: { backgroundColor: "rgba(218,129,42,0.3)", flex: 1, height: 1, marginHorizontal: 8 },
  sectionCount: { color: "#98785F", fontSize: 8, fontWeight: "900" },
  itemRow: { alignItems: "center", backgroundColor: "rgba(14,9,10,0.95)", borderColor: "rgba(216,128,38,0.56)", borderRadius: 11, borderWidth: 1, flexDirection: "row", marginBottom: 6, minHeight: 88, padding: 7 },
  subdued: { opacity: 0.58 },
  itemArt: { alignItems: "center", backgroundColor: "rgba(46,20,14,0.76)", borderColor: "rgba(211,120,36,0.4)", borderRadius: 8, borderWidth: 1, height: 70, justifyContent: "center", marginRight: 8, width: 70 },
  itemEmoji: { fontSize: 38 },
  itemInfo: { flex: 1, minWidth: 0, paddingRight: 6 },
  itemTitleRow: { alignItems: "center", flexDirection: "row" },
  itemName: { color: "#FFF0D8", flex: 1, fontSize: 13, fontWeight: "900" },
  itemMeta: { color: "#D0954C", fontSize: 7, fontWeight: "900", marginTop: 3 },
  itemDescription: { color: "#A99482", fontSize: 8, lineHeight: 11, marginTop: 4 },
  itemAction: { alignItems: "flex-end", flexShrink: 0, justifyContent: "center", minWidth: 72 },
  rowButton: { marginBottom: 0, marginTop: 4 },
  messagePanel: { backgroundColor: "rgba(50,17,15,0.9)", borderColor: "#8F3931", borderRadius: 9, borderWidth: 1, marginTop: 10, padding: 12 },
  message: { color: "#E7B5A7", fontSize: 9, fontWeight: "900", letterSpacing: 0.8, textAlign: "center" },
  loading: { color: "#E8AD55", fontSize: 8, fontWeight: "900", letterSpacing: 1, paddingVertical: 13, textAlign: "center" },
  footerSpace: { height: 18 },
});
