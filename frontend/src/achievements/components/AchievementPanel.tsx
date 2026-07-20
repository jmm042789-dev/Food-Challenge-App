import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import FirePanel from "../../components/fire/FirePanel";
import { getSortedAchievements } from "../AchievementTracker";
import type { AchievementState } from "../AchievementTypes";
import AchievementCard from "./AchievementCard";

type Filter = "ALL" | "IN PROGRESS" | "COMPLETED" | "CLAIMED";
const FILTERS: Filter[] = ["ALL", "IN PROGRESS", "COMPLETED", "CLAIMED"];

type Props = { state: AchievementState; onClaim: (achievementId: string) => void };

export default function AchievementPanel({ state, onClaim }: Props) {
  const [filter, setFilter] = useState<Filter>("ALL");
  const achievements = useMemo(() => getSortedAchievements(state).filter(({ progress }) => {
    if (filter === "IN PROGRESS") return !progress.completed;
    if (filter === "COMPLETED") return progress.completed && !progress.claimed;
    if (filter === "CLAIMED") return progress.claimed;
    return true;
  }), [filter, state]);
  const completedCount = state.progress.filter((item) => item.completed).length;

  return (
    <FirePanel compact title="ACHIEVEMENTS" subtitle={`${completedCount} / ${state.progress.length} completed`}>
      <View accessibilityRole="tablist" style={styles.filters}>
        {FILTERS.map((item) => (
          <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: filter === item }} onPress={() => setFilter(item)} style={[styles.filter, filter === item && styles.filterActive]}>
            <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </View>
      {achievements.map(({ definition, progress }) => <AchievementCard key={definition.id} definition={definition} progress={progress} onClaim={() => onClaim(definition.id)} />)}
      {!achievements.length ? <Text style={styles.empty}>NO ACHIEVEMENTS IN THIS FILTER</Text> : null}
    </FirePanel>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: "row", gap: 4, marginBottom: 8 },
  filter: { backgroundColor: "rgba(32,20,18,0.8)", borderColor: "rgba(195,111,39,0.42)", borderRadius: 7, borderWidth: 1, flex: 1, paddingHorizontal: 3, paddingVertical: 6 },
  filterActive: { backgroundColor: "#793511", borderColor: "#E89B43" },
  filterText: { color: "#A98B75", fontSize: 6, fontWeight: "900", textAlign: "center" },
  filterTextActive: { color: "#FFF0D1" },
  empty: { color: "#A98B75", fontSize: 8, fontWeight: "900", paddingVertical: 12, textAlign: "center" },
});
