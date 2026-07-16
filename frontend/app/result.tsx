import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Redirect } from "expo-router";

import FirePanel from "../src/components/fire/FirePanel";
import FireScreenEntrance from "../src/components/fire/FireScreenEntrance";
import FireArenaBackground from "../src/game/FireArenaBackground";
import { theme } from "../src/theme";

export default function ResultScreen() {
  if (!__DEV__) return <Redirect href="/" />;

  return (
    <View style={styles.container}>
      <FireArenaBackground />

      <FireScreenEntrance duration="fast" distance={8}>
        <Text style={styles.title}>🔥 MATCH RESULT</Text>
      </FireScreenEntrance>

      <FireScreenEntrance delay={50} duration="fast" distance={8} scaleFrom={0.97} style={styles.fullWidth}>
        <FirePanel title="MATCH RESULT" elevated accent="gold" style={styles.card}>
          <Text style={styles.status}>VICTORY</Text>
          <Text style={styles.score}>You scored <Text style={styles.highlight}>2,450</Text> points</Text>
          <Text style={styles.subtext}>Great performance in the Fire Feast Arena</Text>
        </FirePanel>
      </FireScreenEntrance>

      <FireScreenEntrance delay={100} duration="fast" distance={8} style={styles.fullWidth}>
        <FirePanel compact title="REWARDS" style={styles.statsBox}>
          <FireScreenEntrance delay={120} duration="fast" distance={8}><Text style={styles.stat}>+120 XP</Text></FireScreenEntrance>
          <FireScreenEntrance delay={150} duration="fast" distance={8}><Text style={styles.stat}>+50 Coins</Text></FireScreenEntrance>
          <FireScreenEntrance delay={180} duration="fast" distance={8}><Text style={styles.stat}>Streak: 3 🔥</Text></FireScreenEntrance>
        </FirePanel>
      </FireScreenEntrance>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, justifyContent: "center", alignItems: "center", padding: 20 },
  fullWidth: { width: "100%" },
  title: { fontSize: 24, fontWeight: "900", color: theme.colors.primary, marginBottom: 20 },
  card: { width: "100%", backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 20, alignItems: "center", borderWidth: 1, borderColor: theme.colors.surface2 },
  status: { fontSize: 22, fontWeight: "900", color: theme.colors.gold, marginBottom: 10 },
  score: { fontSize: 16, color: theme.colors.text, textAlign: "center" },
  highlight: { color: theme.colors.primary, fontWeight: "900" },
  subtext: { marginTop: 10, color: theme.colors.textMuted, textAlign: "center" },
  statsBox: { marginTop: 20, width: "100%", backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: 15, borderColor: theme.colors.surface2, borderWidth: 1 },
  stat: { color: theme.colors.text, marginBottom: 5, fontWeight: "600" },
});
