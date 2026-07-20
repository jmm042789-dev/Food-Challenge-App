import React from "react";
import { StyleSheet, Text, View } from "react-native";
import FireButton from "../../components/fire/FireButton";
import FireProgressBar from "../../components/fire/FireProgressBar";
import type { AchievementDefinition, AchievementProgress } from "../AchievementTypes";

type Props = { definition: AchievementDefinition; progress: AchievementProgress; onClaim: () => void };

export default function AchievementCard({ definition, progress, onClaim }: Props) {
  const shownProgress = Math.min(progress.currentProgress, progress.goal);
  const status = progress.claimed ? "CLAIMED" : progress.completed ? "COMPLETED" : definition.tier ?? definition.category;
  return (
    <View accessible accessibilityLabel={`${definition.title}. ${definition.description}. ${shownProgress} of ${progress.goal}. ${status}.`} style={[styles.card, progress.completed && styles.completeCard]}>
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{definition.title.toUpperCase()}</Text>
          <Text style={styles.description}>{definition.description}</Text>
        </View>
        <Text style={[styles.status, progress.completed && styles.completeStatus]}>{status}</Text>
      </View>
      <FireProgressBar value={shownProgress} max={progress.goal} variant={progress.completed ? "xp" : "combo"} compact />
      <View style={styles.footer}>
        <Text style={styles.progress}>{shownProgress.toLocaleString()} / {progress.goal.toLocaleString()}</Text>
        <Text style={styles.reward}>+{definition.reward.coins} COINS  +{definition.reward.xp} XP</Text>
        {progress.completed && !progress.claimed ? (
          <FireButton accessibilityLabel={`Claim ${definition.title} achievement reward`} title="CLAIM" onPress={onClaim} size="compact" variant="gold" style={styles.claim} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "rgba(18,12,13,0.94)", borderColor: "rgba(208,120,39,0.48)", borderRadius: 11, borderWidth: 1, marginBottom: 7, padding: 9 },
  completeCard: { borderColor: "rgba(246,193,82,0.82)" },
  header: { alignItems: "flex-start", flexDirection: "row", marginBottom: 7 },
  titleBlock: { flex: 1, minWidth: 0, paddingRight: 7 },
  title: { color: "#FFF0D8", fontSize: 11, fontWeight: "900" },
  description: { color: "#A99482", fontSize: 8, lineHeight: 11, marginTop: 2 },
  status: { color: "#B9844B", fontSize: 6, fontWeight: "900", letterSpacing: 0.6 },
  completeStatus: { color: "#FFD169" },
  footer: { alignItems: "center", flexDirection: "row", marginTop: 5 },
  progress: { color: "#D9C2A8", fontSize: 8, fontWeight: "900" },
  reward: { color: "#E8A94E", flex: 1, fontSize: 7, fontWeight: "900", marginLeft: 8 },
  claim: { marginBottom: 0, marginTop: 0 },
});
