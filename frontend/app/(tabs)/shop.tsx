import React, { useCallback, useMemo, useRef, useState } from "react";
import { Alert, Image, SectionList, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { api } from "../../src/api";
import FireBadge from "../../src/components/fire/FireBadge";
import FireButton from "../../src/components/fire/FireButton";
import FireScreenEntrance from "../../src/components/fire/FireScreenEntrance";
import ArcadeBackground from "../../src/game/ui/ArcadeBackground";
import { trackAchievementEvent } from "../../src/achievements/AchievementTracker";
import { usePlayerBalance } from "../../src/playerBalance";
import { classifyPlayerError, playerFacingErrorMessage } from "../../src/playerFacingErrors";
import { equipmentStatus } from "../../src/equipmentState";
import CompactScreenHeader from "../../src/components/fire/CompactScreenHeader";
import { playSound } from "../../src/audio/AdaptiveAudioManager";
import { useAppPreferences } from "../../src/preferences/AppPreferences";
import FirstUseTip from "../../src/onboarding/FirstUseTip";

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
  effect_description?: string;
  slot?: "Hat" | "Apron" | "Outfit";
  unlock_level?: number;
  set_id?: string | null;
  visual?: { color: string; shape: string };
};
type GearSet = { id: string; name: string; note: string; pieces: string[]; bundle_discount: number; bonus_description: string };

type Player = {
  coins: number;
  antacid: number;
  xp: number;
  owned_gear: string[];
  equipped_gear?: string | null;
  equipped_gear_slots?: Record<string, string>;
  equipped_cosmetic?: string | null;
  closed_beta_welcome_pack_claimed: boolean;
};

const EMPTY_PLAYER: Player = {
  coins: 0,
  antacid: 0,
  xp: 0,
  owned_gear: [],
  equipped_gear: null,
  equipped_cosmetic: null,
  closed_beta_welcome_pack_claimed: false,
};

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
  if (item.type === "welcome_pack") {
    return <Text style={styles.oneTimeLabel}>ONE-TIME GIFT</Text>;
  }
  return (
    <View style={styles.priceRow}>
      <Image source={COIN} resizeMode="contain" style={styles.priceIcon} />
      <Text style={styles.price}>{Number(item.price).toLocaleString()}</Text>
    </View>
  );
}

export default function ShopScreen() {
  const isFocused = useIsFocused();
  const { preferences } = useAppPreferences();
  const [items, setItems] = useState<ShopItem[]>([]);
  const [player, setPlayer] = useState<Player>(EMPTY_PLAYER);
  const [loading, setLoading] = useState(true);
  const [sets, setSets] = useState<GearSet[]>([]);
  const [filter, setFilter] = useState<"All" | "Hats" | "Aprons" | "Outfits" | "Sets">("All");
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const actionInFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const coins = usePlayerBalance(player.coins);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [shopResult, playerResult, gearResult] = await Promise.allSettled([api.shop(), api.getPlayer(), api.gear()]);
    if (shopResult.status === "fulfilled" && Array.isArray(shopResult.value?.items)) {
      setItems(shopResult.value.items);
    } else {
      setItems([]);
      setError("SHOP INVENTORY UNAVAILABLE");
    }
    if (playerResult.status === "fulfilled" && playerResult.value) {
      setPlayer({ ...EMPTY_PLAYER, ...(playerResult.value as Partial<Player>) });
    }
    if (gearResult.status === "fulfilled") setSets(Array.isArray(gearResult.value?.sets) ? gearResult.value.sets : []);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const featured = items[0];
  const sections = useMemo(() => {
    const groups = new Map<string, ShopItem[]>();
    items.slice(1).filter((item) => filter === "All" || (filter !== "Sets" && item.slot === filter.slice(0, -1))).forEach((item) => {
      const key = item.category || item.type || "Shop Items";
      groups.set(key, [...(groups.get(key) || []), item]);
    });
    return Array.from(groups, ([title, data]) => ({ title, data }));
  }, [filter, items]);

  const buySet = useCallback(async (set: GearSet) => { if (actionInFlight.current) return; actionInFlight.current = true; setPendingId(set.id); try { await api.purchaseGearSet(set.id); void playSound("PURCHASE"); if (preferences.hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); await load(); } catch (purchaseError) { Alert.alert("Set purchase failed", playerFacingErrorMessage(purchaseError)); } finally { actionInFlight.current = false; setPendingId(null); } }, [load, preferences.hapticsEnabled]);

  const actOnItem = useCallback(async (item: ShopItem) => {
    if (actionInFlight.current) return;

    const owned = player.owned_gear.includes(item.id);
    const equipped = equipmentStatus(item, player) === "equipped";
    if (equipped || (owned && !["gear", "cosmetic"].includes(item.type))) return;
    actionInFlight.current = true;
    setPendingId(item.id);
    try {
      if (owned && item.type === "gear") {
        await api.equipGear(item.id);
        void playSound("EQUIP");
        if (preferences.hapticsEnabled) Haptics.selectionAsync().catch(() => {});
      } else if (owned && item.type === "cosmetic") {
        await api.equipCosmetic(item.id);
      } else {
        const purchase = await api.purchase(item.id) as Partial<Player> & {
          new_coins?: number;
          new_tums?: number;
          new_xp?: number;
        };
        void playSound("PURCHASE");
        if (preferences.hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setPlayer((current) => ({
          ...current,
          coins: purchase.new_coins ?? current.coins,
          antacid: purchase.new_tums ?? current.antacid,
          xp: purchase.new_xp ?? current.xp,
          owned_gear: purchase.owned_gear ?? current.owned_gear,
          closed_beta_welcome_pack_claimed:
            purchase.closed_beta_welcome_pack_claimed
            ?? current.closed_beta_welcome_pack_claimed,
        }));
        if (item.type === "gear") {
          await trackAchievementEvent({ type: "ITEM_ACQUIRED", ownedItemCount: player.owned_gear.length + 1 });
        }
      }
      await load();
    } catch (purchaseError: unknown) {
      if (classifyPlayerError(purchaseError) === "already_owned") {
        await load();
        Alert.alert("Already in Locker", playerFacingErrorMessage(purchaseError));
      } else {
        Alert.alert("Shop action failed", playerFacingErrorMessage(purchaseError));
      }
    } finally {
      actionInFlight.current = false;
      setPendingId(null);
    }
  }, [load, player, preferences.hapticsEnabled]);

  const statusFor = useCallback((item: ShopItem) => {
    if (item.type === "welcome_pack" && player.closed_beta_welcome_pack_claimed) return "redeemed";
    return equipmentStatus(item, player);
  }, [player]);

  const renderItem = ({ item }: { item: ShopItem }) => {
    const status = statusFor(item);
    const unaffordable = item.price > coins;
    return (
      <View style={[styles.itemRow, unaffordable && status === "available" && styles.subdued]}>
        <View style={styles.itemArt}><Text style={styles.itemEmoji}>{item.icon || "🔥"}</Text></View>
        {item.type === "gear" ? <View pointerEvents="none" style={[styles.gearArtOverlay, { backgroundColor: item.visual?.color ?? "#B9692D" }]}><Text style={styles.gearMonogram}>{item.slot?.slice(0, 1)}</Text></View> : null}
        <View style={styles.itemInfo}>
          <View style={styles.itemTitleRow}>
            <Text numberOfLines={2} style={styles.itemName}>{item.name}</Text>
            {status !== "available" ? <FireBadge label={status.toUpperCase()} variant={status === "equipped" ? "success" : "gold"} /> : null}
          </View>
          <Text numberOfLines={2} style={styles.itemMeta}>{[item.rarity, item.perk].filter(Boolean).join(" · ")}</Text>
          <Text numberOfLines={detailsId === item.id ? undefined : 2} style={styles.itemDescription}>{detailsId === item.id ? `WHAT THIS GEAR DOES IN GAME\n${item.effect_description || item.description}\n${item.set_id ? `SET · ${item.set_id.replaceAll("_", " ").toUpperCase()}` : "NO SET"} · UNLOCK LV ${item.unlock_level ?? 1}` : item.description}</Text>
          {item.type === "gear" ? <FireButton title={detailsId === item.id ? "HIDE EFFECTS" : "DETAILS / EFFECTS"} size="compact" variant="ghost" onPress={() => setDetailsId((value) => value === item.id ? null : item.id)} /> : null}
        </View>
        <View style={styles.itemAction}>
          <Price item={item} />
          <FireButton
            title={status === "redeemed" ? "RECEIVED" : status === "equipped" ? "EQUIPPED" : status === "owned" && ["gear", "cosmetic"].includes(item.type) ? "EQUIP" : status === "owned" ? "OWNED" : "BUY"}
            onPress={() => actOnItem(item)}
            disabled={pendingId !== null || status === "equipped" || status === "redeemed" || (status === "owned" && !["gear", "cosmetic"].includes(item.type)) || (unaffordable && status === "available")}
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
      <CompactScreenHeader title="SHOP" context="FIRE FEAST" right={<View style={styles.balanceRow}>
          <CurrencyCounter icon={COIN} label="COINS" value={coins} />
          <CurrencyCounter icon={ANTACID} label="ANTACID" value={player.antacid} />
        </View>} />
      <FirstUseTip tipKey="gear" title="BUILD YOUR LOADOUT">Equip one Hat, Apron, and Outfit. Open Details to compare modest server-authoritative effects; matching sets activate only at 3/3 and gear uses earned coins.</FirstUseTip>
      <View style={styles.filters}>{(["All", "Hats", "Aprons", "Outfits", "Sets"] as const).map((value) => <FireButton key={value} title={value.toUpperCase()} size="compact" variant={filter === value ? "gold" : "secondary"} onPress={() => setFilter(value)} />)}</View>
      {filter === "Sets" ? sets.map((set) => { const owned = set.pieces.filter((id) => player.owned_gear.includes(id)).length; const remaining = set.pieces.map((id) => items.find((item) => item.id === id)).filter((item): item is ShopItem => Boolean(item) && !player.owned_gear.includes(item!.id)); const price = Math.floor(remaining.reduce((sum, item) => sum + item.price, 0) * (1 - set.bundle_discount)); return <View key={set.id} style={styles.setCard}><Text style={styles.setName}>{set.name.toUpperCase()}</Text><Text style={styles.setNote}>{set.note} · 3 PIECE SET · {owned}/3 {owned === 3 ? "COMPLETE" : ""}</Text>{set.pieces.map((id) => <Text key={id} style={styles.setPiece}>{player.owned_gear.includes(id) ? "OWNED" : "NOT OWNED"} · {items.find((item) => item.id === id)?.name}</Text>)}<Text style={styles.setBonus}>{set.bonus_description}</Text><FireButton disabled={pendingId !== null || owned === 3 || price > coins} loading={pendingId === set.id} title={owned === 3 ? "SET COMPLETE" : `BUY COMPLETE SET — ${price.toLocaleString()} COINS`} variant="gold" onPress={() => { void buySet(set); }} /></View>; }) : null}

      {featured && filter === "All" ? (
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
              title={statusFor(featured) === "redeemed" ? "RECEIVED" : statusFor(featured) === "equipped" ? "EQUIPPED" : statusFor(featured) === "owned" && ["gear", "cosmetic"].includes(featured.type) ? "EQUIP ITEM" : statusFor(featured) === "owned" ? "OWNED" : featured.type === "welcome_pack" ? "CLAIM WELCOME PACK" : "PURCHASE ITEM"}
              onPress={() => actOnItem(featured)}
              disabled={pendingId !== null || statusFor(featured) === "equipped" || statusFor(featured) === "redeemed" || (statusFor(featured) === "owned" && !["gear", "cosmetic"].includes(featured.type)) || (featured.price > coins && statusFor(featured) === "available")}
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
  headerTitleBlock: { flexShrink: 1, minWidth: 0, paddingRight: 6 },
  balanceRow: { flexDirection: "row", flexShrink: 0, gap: 4 },
  counter: { alignItems: "center", backgroundColor: "rgba(8,6,7,0.94)", borderColor: "rgba(225,136,45,0.58)", borderRadius: 8, borderWidth: 1, flexDirection: "row", minWidth: 78, paddingHorizontal: 6, paddingVertical: 5 },
  counterIcon: { height: 23, marginRight: 5, width: 23 },
  counterLabel: { color: "#987B62", fontSize: 6, fontWeight: "900", letterSpacing: 0.7 },
  counterValue: { color: "#FFD06A", fontSize: 12, fontWeight: "900", lineHeight: 14 },
  featured: { backgroundColor: "rgba(17,10,10,0.96)", borderColor: "#D88A2A", borderRadius: 15, borderWidth: 1.5, elevation: 7, overflow: "hidden", padding: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.38, shadowRadius: 10 },
  featuredHighlight: { backgroundColor: "rgba(255,210,125,0.18)", height: 1, left: 12, position: "absolute", right: 12, top: 1 },
  featuredTop: { alignItems: "center", flexDirection: "row", minHeight: 108 },
  featuredArt: { alignItems: "center", backgroundColor: "rgba(65,23,12,0.54)", borderColor: "rgba(233,141,42,0.52)", borderRadius: 12, borderWidth: 1, height: 102, justifyContent: "center", marginRight: 10, width: "34%" },
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
  oneTimeLabel: { color: "#FFC75B", fontSize: 9, fontWeight: "900", letterSpacing: 0.6 },
  sectionHeader: { alignItems: "center", flexDirection: "row", marginBottom: 6, marginTop: 11, paddingHorizontal: 2 },
  sectionTitle: { color: "#E8BD7A", fontSize: 10, fontWeight: "900", letterSpacing: 1.1 },
  sectionRule: { backgroundColor: "rgba(218,129,42,0.3)", flex: 1, height: 1, marginHorizontal: 8 },
  sectionCount: { color: "#98785F", fontSize: 8, fontWeight: "900" },
  itemRow: { alignItems: "center", backgroundColor: "rgba(14,9,10,0.95)", borderColor: "rgba(216,128,38,0.56)", borderRadius: 11, borderWidth: 1, elevation: 3, flexDirection: "row", marginBottom: 6, minHeight: 88, padding: 7, shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.24, shadowRadius: 5 },
  subdued: { opacity: 0.58 },
  itemArt: { alignItems: "center", backgroundColor: "rgba(46,20,14,0.76)", borderColor: "rgba(211,120,36,0.4)", borderRadius: 8, borderWidth: 1, height: 70, justifyContent: "center", marginRight: 8, width: 70 },
  itemEmoji: { fontSize: 38 },
  gearArtOverlay: { alignItems: "center", borderRadius: 14, height: 52, justifyContent: "center", left: 16, position: "absolute", transform: [{ rotate: "45deg" }], width: 52, zIndex: 3 },
  gearMonogram: { color: "#FFF4DE", fontSize: 22, fontWeight: "900", transform: [{ rotate: "-45deg" }] },
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
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginBottom: 7 },
  setCard: { backgroundColor: "rgba(18,10,10,0.97)", borderColor: "#D7923E", borderRadius: 14, borderWidth: 1, gap: 6, marginBottom: 9, padding: 12 },
  setName: { color: "#FFD06A", fontSize: 17, fontWeight: "900" },
  setNote: { color: "#B89B80", fontSize: 9, fontWeight: "800" },
  setPiece: { color: "#FFF0D8", fontSize: 10, fontWeight: "800" },
  setBonus: { color: "#E5A650", fontSize: 10, lineHeight: 14 },
});
