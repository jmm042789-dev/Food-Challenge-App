import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import FireBadge from "../../components/fire/FireBadge";
import FireButton from "../../components/fire/FireButton";
import FirePanel from "../../components/fire/FirePanel";
import { ACHIEVEMENT_BY_ID } from "../../achievements/AchievementCatalog";
import { TITLE_CATALOG } from "../TitleCatalog";
import type { TitleProgressState, TitleRarity, TitleUnlockRequirement } from "../TitleTypes";

const rarityColor: Record<TitleRarity, string> = { Common: "#B9A58E", Rare: "#59A7D8", Epic: "#A875E4", Legendary: "#F0B742", Mythic: "#E677EC" };

const requirementText = (requirement: TitleUnlockRequirement): string => {
  switch (requirement.type) {
    case "MATCHES_PLAYED": return `PLAY ${requirement.value} MATCHES`;
    case "WINS": return `WIN ${requirement.value} MATCHES`;
    case "BELT_RANK": return `REACH BELT RANK ${requirement.value}`;
    case "ACHIEVEMENT": return `COMPLETE ${ACHIEVEMENT_BY_ID.get(requirement.achievementId)?.title ?? "REQUIRED ACHIEVEMENT"}`;
    case "ACHIEVEMENTS_COMPLETED": return `COMPLETE ${requirement.value} ACHIEVEMENTS`;
    case "RESTAURANTS_UNLOCKED": return `UNLOCK ${requirement.value} RESTAURANTS`;
    case "FOOD_MECHANIC_MASTERY": return `MASTER ${ACHIEVEMENT_BY_ID.get(requirement.achievementId)?.title ?? "FOOD MECHANIC"}`;
    case "SEASON_REWARD": return "SEASON REWARD";
    case "TOURNAMENT_REWARD": return "TOURNAMENT REWARD";
  }
};

export default function TitleBrowserPanel({ state, onEquip }: { state: TitleProgressState; onEquip: (titleId: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const unlockedIds = useMemo(() => new Set(state.unlockedTitles.map((record) => record.titleId)), [state.unlockedTitles]);
  return (
    <FirePanel compact title="PLAYER TITLES" subtitle={`${state.unlockedTitles.length} / ${TITLE_CATALOG.length} unlocked`} headerRight={(
      <Pressable accessibilityRole="button" accessibilityLabel={`${expanded ? "Hide" : "Browse"} player titles`} onPress={() => setExpanded((value) => !value)} style={styles.toggle}>
        <Text style={styles.toggleText}>{expanded ? "HIDE" : "BROWSE"}</Text>
      </Pressable>
    )}>
      {expanded ? TITLE_CATALOG.map((title) => {
        const unlocked = unlockedIds.has(title.id);
        const equipped = state.equippedTitleId === title.id;
        return (
          <View key={title.id} accessible accessibilityLabel={`${title.displayName}. ${title.rarity}. ${unlocked ? equipped ? "Equipped" : "Unlocked" : `Locked. ${requirementText(title.unlockRequirement)}`}.`} style={[styles.card, !unlocked && styles.lockedCard, { borderColor: unlocked ? title.colorTheme : "rgba(96,82,76,0.46)" }]}>
            <View style={[styles.icon, { borderColor: unlocked ? title.colorTheme : "#554B49" }]}><Text style={[styles.iconText, { color: unlocked ? title.colorTheme : "#6E6260" }]}>{unlocked ? title.iconPlaceholder : "?"}</Text></View>
            <View style={styles.info}>
              <View style={styles.titleRow}><Text numberOfLines={1} style={[styles.name, unlocked && { color: title.colorTheme }]}>{title.displayName.toUpperCase()}</Text><FireBadge label={equipped ? "EQUIPPED" : title.rarity.toUpperCase()} variant={equipped ? "success" : "muted"} /></View>
              <Text numberOfLines={2} style={styles.description}>{title.description}</Text>
              {!unlocked ? <Text style={styles.requirement}>{requirementText(title.unlockRequirement)}</Text> : null}
            </View>
            {unlocked && !equipped ? <FireButton accessibilityLabel={`Equip ${title.displayName} title`} title="EQUIP" onPress={() => onEquip(title.id)} size="compact" variant="secondary" style={styles.equip} /> : null}
          </View>
        );
      }) : <Text style={styles.summary}>Unlock cosmetic titles through matches, achievements, belts, restaurants, and food mastery.</Text>}
    </FirePanel>
  );
}

const styles = StyleSheet.create({
  toggle: { backgroundColor: "#6F3012", borderColor: "#D88939", borderRadius: 7, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 6 }, toggleText: { color: "#FFE4B5", fontSize: 7, fontWeight: "900" },
  summary: { color: "#B49A84", fontSize: 9, lineHeight: 13 }, card: { alignItems: "center", backgroundColor: "rgba(14,9,10,0.94)", borderRadius: 10, borderWidth: 1, flexDirection: "row", marginBottom: 6, minHeight: 68, padding: 6 }, lockedCard: { opacity: 0.72 },
  icon: { alignItems: "center", backgroundColor: "#211515", borderRadius: 8, borderWidth: 1, height: 48, justifyContent: "center", marginRight: 7, width: 48 }, iconText: { fontSize: 15, fontWeight: "900" }, info: { flex: 1, minWidth: 0 }, titleRow: { alignItems: "flex-start", flexDirection: "row" },
  name: { color: "#BCA896", flex: 1, fontSize: 10, fontWeight: "900", paddingRight: 4 }, description: { color: "#9E8979", fontSize: 7, lineHeight: 10 }, requirement: { color: "#D59A4B", fontSize: 6, fontWeight: "900", marginTop: 3 }, equip: { marginBottom: 0, marginLeft: 5, marginTop: 0 },
});
