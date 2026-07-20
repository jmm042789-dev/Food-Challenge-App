import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import FireButton from "../../components/fire/FireButton";
import FirePanel from "../../components/fire/FirePanel";
import { RESTAURANT_BY_ID } from "../../restaurants/RestaurantCatalog";
import { formatTournamentTimeRemaining } from "../TournamentRotation";
import type { ActiveTournament, TournamentPlayerProgress } from "../TournamentTypes";

type Props = {
  tournament: ActiveTournament;
  progress: TournamentPlayerProgress;
  onEnter: () => void;
  onClaimReward: (rewardId: string) => void;
};

export default function TournamentPanel({ tournament, progress, onEnter, onClaimReward }: Props) {
  const restaurant = RESTAURANT_BY_ID.get(tournament.featuredRestaurantId);
  return (
    <FirePanel highlighted elevated borderColor="#E9A33E" style={styles.panel}>
      <View style={styles.header}>
        <View style={styles.art}><Text style={styles.artText}>{tournament.artworkPlaceholder}</Text></View>
        <View style={styles.heading}>
          <Text style={styles.kicker}>WEEKLY TOURNAMENT · {tournament.difficulty.toUpperCase()}</Text>
          <Text style={styles.name}>{tournament.name.toUpperCase()}</Text>
          <Text style={styles.remaining}>{formatTournamentTimeRemaining(tournament)}</Text>
        </View>
      </View>
      <Text style={styles.description}>{tournament.description}</Text>
      <View style={styles.featureRow}>
        <View style={styles.feature}><Text style={styles.label}>RESTAURANT</Text><Text numberOfLines={1} style={styles.value}>{restaurant?.displayName ?? tournament.featuredRestaurantId}</Text></View>
        <View style={styles.feature}><Text style={styles.label}>FEATURED FOOD</Text><Text numberOfLines={1} style={styles.value}>{tournament.featuredFoods.join(", ")}</Text></View>
        <View style={styles.feature}><Text style={styles.label}>BEST SCORE</Text><Text style={styles.score}>{progress.bestScore.toLocaleString()}</Text></View>
      </View>
      <View style={styles.stats}><Text style={styles.stat}>{progress.matchesEntered} ENTERED</Text><Text style={styles.stat}>{progress.wins} WINS</Text><Text style={styles.stat}>x{progress.highestCombo} COMBO</Text></View>
      <Text style={styles.rewardTitle}>REWARD PREVIEW</Text>
      {tournament.rewardTable.map((reward) => {
        const claimed = progress.claimedRewardIds.includes(reward.id);
        const earned = progress.matchesEntered > 0 && progress.bestScore >= reward.minimumScore;
        return (
          <View key={reward.id} style={styles.rewardRow}>
            <View style={styles.rewardInfo}><Text style={styles.rewardLabel}>{reward.label}</Text><Text style={styles.rewardRequirement}>{reward.minimumScore ? `${reward.minimumScore}+ SCORE` : "ENTER 1 MATCH"}</Text></View>
            <Text style={styles.rewardValue}>+{reward.coins} C · +{reward.xp} XP</Text>
            {earned && !claimed ? <Pressable accessibilityRole="button" accessibilityLabel={`Claim ${reward.label} tournament reward`} onPress={() => onClaimReward(reward.id)} style={styles.claim}><Text style={styles.claimText}>CLAIM</Text></Pressable> : <Text style={[styles.rewardStatus, claimed && styles.claimed]}>{claimed ? "CLAIMED" : "LOCKED"}</Text>}
          </View>
        );
      })}
      <FireButton accessibilityLabel={`Enter ${tournament.name}`} title="ENTER TOURNAMENT" subtitle="PLAY WEEKLY EVENT" onPress={onEnter} fullWidth size="compact" variant="gold" style={styles.enter} />
    </FirePanel>
  );
}

const styles = StyleSheet.create({
  panel: { marginBottom: 10, padding: 10 }, header: { alignItems: "center", flexDirection: "row" },
  art: { alignItems: "center", backgroundColor: "#5D260E", borderColor: "#F0A342", borderRadius: 10, borderWidth: 1, height: 60, justifyContent: "center", marginRight: 9, width: 60 },
  artText: { color: "#FFD170", fontSize: 22, fontWeight: "900" }, heading: { flex: 1, minWidth: 0 },
  kicker: { color: "#C9904E", fontSize: 7, fontWeight: "900", letterSpacing: 0.7 }, name: { color: "#FFF0D8", fontSize: 18, fontWeight: "900", marginTop: 1 }, remaining: { color: "#FFB34E", fontSize: 8, fontWeight: "900", marginTop: 2 },
  description: { color: "#B9A18D", fontSize: 8, lineHeight: 11, marginTop: 7 }, featureRow: { flexDirection: "row", gap: 5, marginTop: 7 },
  feature: { backgroundColor: "rgba(8,6,7,0.72)", borderRadius: 7, flex: 1, minWidth: 0, padding: 5 }, label: { color: "#95765E", fontSize: 5, fontWeight: "900" }, value: { color: "#E8C99C", fontSize: 7, fontWeight: "800", marginTop: 2, textTransform: "uppercase" }, score: { color: "#FFD064", fontSize: 12, fontWeight: "900" },
  stats: { flexDirection: "row", justifyContent: "space-around", marginTop: 7 }, stat: { color: "#C6965F", fontSize: 7, fontWeight: "900" }, rewardTitle: { color: "#E8BD7A", fontSize: 7, fontWeight: "900", letterSpacing: 0.8, marginTop: 8 },
  rewardRow: { alignItems: "center", borderTopColor: "rgba(209,125,39,0.24)", borderTopWidth: 1, flexDirection: "row", minHeight: 31 }, rewardInfo: { flex: 1 }, rewardLabel: { color: "#F5D9AE", fontSize: 7, fontWeight: "900" }, rewardRequirement: { color: "#8E7461", fontSize: 5, fontWeight: "800" }, rewardValue: { color: "#E8A94F", fontSize: 7, fontWeight: "900", marginHorizontal: 5 }, rewardStatus: { color: "#796A60", fontSize: 6, fontWeight: "900", width: 42 }, claimed: { color: "#6DC889" },
  claim: { backgroundColor: "#864010", borderColor: "#ECA14B", borderRadius: 6, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 4 }, claimText: { color: "#FFF0D1", fontSize: 6, fontWeight: "900" }, enter: { marginBottom: 0, marginTop: 7 },
});
