import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { TitleUnlockNotification } from "../TitleTypes";

export default function TitleUnlockBanner({ notification, onDismiss }: { notification: TitleUnlockNotification; onDismiss: () => void }) {
  return (
    <View pointerEvents="box-none" style={styles.layer}>
      <Pressable accessibilityRole="button" accessibilityLabel={`New title unlocked. ${notification.titleName}. ${notification.rarity}. Tap to dismiss.`} onPress={onDismiss} style={[styles.banner, { borderColor: notification.colorTheme }]}>
        <Text style={styles.eyebrow}>NEW TITLE UNLOCKED!</Text>
        <Text style={[styles.name, { color: notification.colorTheme }]}>{notification.titleName.toUpperCase()}</Text>
        <Text style={styles.rarity}>{notification.rarity.toUpperCase()} · TAP TO DISMISS</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { left: 12, position: "absolute", right: 12, top: 8, zIndex: 110 },
  banner: { backgroundColor: "rgba(38,16,13,0.98)", borderRadius: 12, borderWidth: 1.5, elevation: 10, paddingHorizontal: 14, paddingVertical: 10 },
  eyebrow: { color: "#FFB548", fontSize: 8, fontWeight: "900", letterSpacing: 1.1, textAlign: "center" },
  name: { fontSize: 17, fontWeight: "900", marginTop: 2, textAlign: "center" },
  rarity: { color: "#CFA66D", fontSize: 7, fontWeight: "800", marginTop: 2, textAlign: "center" },
});
