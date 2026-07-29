import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Kind = "achievement" | "achievementClaimed" | "mission" | "daily" | "level";

const labels: Record<Kind, string> = {
  achievement: "ACHIEVEMENT UNLOCKED",
  achievementClaimed: "ACHIEVEMENT REWARD CLAIMED",
  mission: "MISSION COMPLETE",
  daily: "DAILY REWARD CLAIMED",
  level: "LEVEL UP",
};

export default function RetentionNotification({ kind, title, detail, onDismiss }: { kind: Kind; title: string; detail?: string; onDismiss: () => void }) {
  return <View pointerEvents="box-none" style={styles.layer}><Pressable accessibilityLabel={`${labels[kind]}. ${title}. Tap to dismiss.`} accessibilityRole="button" onPress={onDismiss} style={styles.banner}>
    <Text style={styles.eyebrow}>{labels[kind]}</Text>
    <Text style={styles.title}>{title.toUpperCase()}</Text>
    {detail ? <Text style={styles.detail}>{detail.toUpperCase()} · TAP TO DISMISS</Text> : null}
  </Pressable></View>;
}

const styles = StyleSheet.create({
  layer: { left: 12, position: "absolute", right: 12, top: 8, zIndex: 3000 },
  banner: { backgroundColor: "rgba(46,20,12,0.99)", borderColor: "#FFD06A", borderRadius: 14, borderWidth: 1.5, elevation: 12, paddingHorizontal: 16, paddingVertical: 12, shadowColor: "#F17924", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.35, shadowRadius: 10 },
  eyebrow: { color: "#F2A84D", fontSize: 9, fontWeight: "900", letterSpacing: 1.3, textAlign: "center" },
  title: { color: "#FFF1CE", fontSize: 18, fontWeight: "900", marginTop: 3, textAlign: "center" },
  detail: { color: "#D2AE7D", fontSize: 8, fontWeight: "800", marginTop: 3, textAlign: "center" },
});
