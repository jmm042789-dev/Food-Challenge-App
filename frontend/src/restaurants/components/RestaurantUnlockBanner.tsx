import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { RestaurantUnlockNotification } from "../RestaurantTypes";

export default function RestaurantUnlockBanner({ notification, onDismiss }: { notification: RestaurantUnlockNotification; onDismiss: () => void }) {
  return (
    <View pointerEvents="box-none" style={styles.layer}>
      <Pressable accessibilityRole="button" accessibilityLabel={`New restaurant unlocked. ${notification.restaurantName}. ${notification.theme}. Tap to dismiss.`} onPress={onDismiss} style={styles.banner}>
        <Text style={styles.eyebrow}>NEW RESTAURANT UNLOCKED!</Text>
        <Text style={styles.name}>{notification.restaurantName.toUpperCase()}</Text>
        <Text style={styles.theme}>{notification.theme.toUpperCase()} · TAP TO DISMISS</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { left: 12, position: "absolute", right: 12, top: 8, zIndex: 100 },
  banner: { backgroundColor: "rgba(78,30,9,0.98)", borderColor: "#FFD06A", borderRadius: 12, borderWidth: 1.5, elevation: 10, paddingHorizontal: 14, paddingVertical: 10 },
  eyebrow: { color: "#FFB548", fontSize: 8, fontWeight: "900", letterSpacing: 1.1, textAlign: "center" },
  name: { color: "#FFF1CB", fontSize: 17, fontWeight: "900", marginTop: 2, textAlign: "center" },
  theme: { color: "#CFA66D", fontSize: 7, fontWeight: "800", marginTop: 2, textAlign: "center" },
});
