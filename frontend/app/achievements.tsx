import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import ArcadeBackground from "../src/game/ui/ArcadeBackground";
import FireButton from "../src/components/fire/FireButton";
import AchievementPanel from "../src/achievements/components/AchievementPanel";
import { ACHIEVEMENT_BY_ID } from "../src/achievements/AchievementCatalog";
import { useAchievements } from "../src/achievements/useAchievements";
import RetentionNotification from "../src/components/fire/RetentionNotification";

export default function AchievementsScreen() {
  const router = useRouter();
  const { state, claim } = useAchievements();
  const [notice, setNotice] = useState<string | null>(null);
  return <SafeAreaView style={styles.screen}><ArcadeBackground />
    {notice ? <RetentionNotification kind="achievementClaimed" title={notice} detail="Reward added to local progression" onDismiss={() => setNotice(null)} /> : null}
    <View style={styles.header}><FireButton title="BACK" size="compact" variant="ghost" onPress={() => router.back()} /><View><Text accessibilityRole="header" style={styles.title}>ACHIEVEMENTS</Text><Text style={styles.subtitle}>BUILD YOUR FIRE FEAST LEGACY</Text></View></View>
    <ScrollView contentContainerStyle={styles.content}>{state ? <AchievementPanel state={state} onClaim={(id) => { void claim(id).then((result) => { if (result.ok) setNotice(ACHIEVEMENT_BY_ID.get(id)?.title ?? "Achievement"); }); }} /> : <Text style={styles.loading}>LOADING ACHIEVEMENTS…</Text>}</ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({ screen: { backgroundColor: "#070405", flex: 1 }, header: { alignItems: "center", flexDirection: "row", gap: 12, paddingHorizontal: 14, paddingTop: 4 }, title: { color: "#FFD06A", fontSize: 25, fontWeight: "900" }, subtitle: { color: "#B88D61", fontSize: 9, fontWeight: "900", letterSpacing: 0.9 }, content: { padding: 14 }, loading: { color: "#CDAA7E", padding: 30, textAlign: "center" } });
