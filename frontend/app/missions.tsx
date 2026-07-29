import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import ArcadeBackground from "../src/game/ui/ArcadeBackground";
import FireButton from "../src/components/fire/FireButton";
import FirePanel from "../src/components/fire/FirePanel";
import DailyMissionCard from "../src/components/fire/DailyMissionCard";
import RetentionNotification from "../src/components/fire/RetentionNotification";
import { useDailyMissions } from "../src/missions/useDailyMissions";

export default function MissionsScreen() {
  const router = useRouter();
  const { state, refresh, claim } = useDailyMissions();
  const [notice, setNotice] = useState<string | null>(null);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  return <SafeAreaView style={styles.screen}><ArcadeBackground />
    {notice ? <RetentionNotification kind="mission" title={notice} detail="Reward added to local progression" onDismiss={() => setNotice(null)} /> : null}
    <View style={styles.header}><FireButton title="BACK" size="compact" variant="ghost" onPress={() => router.back()} /><View><Text accessibilityRole="header" style={styles.title}>DAILY MISSIONS</Text><Text style={styles.subtitle}>THREE NEW CHALLENGES EVERY DAY</Text></View></View>
    <ScrollView contentContainerStyle={styles.content}><FirePanel title="TODAY'S MISSIONS" subtitle={state?.lastGeneratedDate ?? "Loading daily rotation"} elevated>
      {state?.missions.map((mission) => <DailyMissionCard key={mission.id} icon={mission.icon} title={mission.title} progress={mission.currentProgress} maxProgress={mission.goal} reward={`+${mission.reward.coins} COINS  +${mission.reward.xp} XP`} completed={mission.completed} claimed={mission.claimed} onClaim={() => { void claim(mission.id).then((reward) => { if (reward) setNotice(mission.title); }); }} />)}
      {!state ? <Text style={styles.loading}>LOADING MISSIONS…</Text> : null}
    </FirePanel></ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({ screen: { backgroundColor: "#070405", flex: 1 }, header: { alignItems: "center", flexDirection: "row", gap: 12, paddingHorizontal: 14, paddingTop: 4 }, title: { color: "#FFD06A", fontSize: 24, fontWeight: "900" }, subtitle: { color: "#B88D61", fontSize: 9, fontWeight: "900", letterSpacing: 0.8 }, content: { padding: 14 }, loading: { color: "#CDAA7E", padding: 30, textAlign: "center" } });
