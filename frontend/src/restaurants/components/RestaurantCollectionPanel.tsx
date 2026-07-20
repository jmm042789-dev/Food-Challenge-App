import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import FireBadge from "../../components/fire/FireBadge";
import FirePanel from "../../components/fire/FirePanel";
import { RESTAURANT_CATALOG } from "../RestaurantCatalog";
import type { RestaurantProgressState, RestaurantUnlockRequirement } from "../RestaurantTypes";

const requirementText = (requirement: RestaurantUnlockRequirement): string => {
  switch (requirement.type) {
    case "XP": return `${requirement.value.toLocaleString()} XP`;
    case "BELT_RANK": return `BELT RANK ${requirement.value}`;
    case "MATCHES_WON": return `${requirement.value} WINS`;
    case "ACHIEVEMENT": return "ACHIEVEMENT REQUIRED";
    case "EVENT": return "EVENT UNLOCK";
    case "SPONSOR": return "SPONSOR UNLOCK";
  }
};

export default function RestaurantCollectionPanel({ state }: { state: RestaurantProgressState }) {
  const [expanded, setExpanded] = useState(false);
  const statusById = useMemo(() => new Map(state.restaurants.map((record) => [record.restaurantId, record])), [state.restaurants]);
  const unlockedCount = state.restaurants.filter((record) => record.status === "unlocked").length;

  return (
    <FirePanel compact title="RESTAURANT COLLECTION" subtitle={`${unlockedCount} / ${RESTAURANT_CATALOG.length} unlocked`} headerRight={(
      <Pressable accessibilityRole="button" accessibilityLabel={`${expanded ? "Hide" : "View"} restaurant collection`} onPress={() => setExpanded((value) => !value)} style={styles.toggle}>
        <Text style={styles.toggleText}>{expanded ? "HIDE" : "VIEW ALL"}</Text>
      </Pressable>
    )}>
      {expanded ? RESTAURANT_CATALOG.map((restaurant) => {
        const unlocked = statusById.get(restaurant.id)?.status === "unlocked";
        return (
          <View key={restaurant.id} accessible accessibilityLabel={`${restaurant.displayName}. ${unlocked ? "Unlocked" : `Locked, requires ${requirementText(restaurant.unlockRequirement)}`}. ${restaurant.difficulty}.`} style={[styles.card, !unlocked && styles.lockedCard]}>
            <View style={[styles.art, !unlocked && styles.lockedArt]}><Text style={styles.artText}>{unlocked ? restaurant.artworkPlaceholder : "??"}</Text></View>
            <View style={styles.info}>
              <View style={styles.nameRow}><Text numberOfLines={1} style={styles.name}>{restaurant.displayName.toUpperCase()}</Text><FireBadge label={unlocked ? "UNLOCKED" : "LOCKED"} variant={unlocked ? "success" : "muted"} /></View>
              <Text numberOfLines={2} style={styles.description}>{restaurant.description}</Text>
              <Text style={styles.meta}>{restaurant.theme.toUpperCase()} · {restaurant.difficulty.toUpperCase()}</Text>
              <Text numberOfLines={1} style={styles.serves}>FOODS: {restaurant.foodsAvailable.join(", ").toUpperCase()}</Text>
              <Text numberOfLines={1} style={styles.serves}>RIVALS: {restaurant.opponentsAvailable.join(", ").replace(/-/g, " ").toUpperCase()}</Text>
              {!unlocked ? <Text style={styles.requirement}>UNLOCK AT {requirementText(restaurant.unlockRequirement)}</Text> : null}
            </View>
          </View>
        );
      }) : <Text style={styles.summary}>Build XP to unlock new fictional venues, foods, and rival lineups.</Text>}
    </FirePanel>
  );
}

const styles = StyleSheet.create({
  toggle: { backgroundColor: "#6F3012", borderColor: "#D88939", borderRadius: 7, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 6 },
  toggleText: { color: "#FFE4B5", fontSize: 7, fontWeight: "900", letterSpacing: 0.5 },
  summary: { color: "#B49A84", fontSize: 9, lineHeight: 13 },
  card: { alignItems: "center", backgroundColor: "rgba(14,9,10,0.94)", borderColor: "rgba(215,128,39,0.48)", borderRadius: 10, borderWidth: 1, flexDirection: "row", marginBottom: 7, minHeight: 94, padding: 7 },
  lockedCard: { borderColor: "rgba(112,94,83,0.42)" },
  art: { alignItems: "center", backgroundColor: "#5B2811", borderColor: "#D47E2F", borderRadius: 9, borderWidth: 1, height: 76, justifyContent: "center", marginRight: 8, width: 76 },
  lockedArt: { backgroundColor: "#171315", borderColor: "#51484A" },
  artText: { color: "#FFD171", fontSize: 22, fontWeight: "900" },
  info: { flex: 1, minWidth: 0 },
  nameRow: { alignItems: "flex-start", flexDirection: "row" },
  name: { color: "#FFF0D8", flex: 1, fontSize: 11, fontWeight: "900", paddingRight: 4 },
  description: { color: "#A99482", fontSize: 7, lineHeight: 10 },
  meta: { color: "#D0934A", fontSize: 6, fontWeight: "900", marginTop: 3 },
  serves: { color: "#A98F7A", fontSize: 6, fontWeight: "800", marginTop: 2 },
  requirement: { color: "#F1B453", fontSize: 7, fontWeight: "900", marginTop: 3 },
});
