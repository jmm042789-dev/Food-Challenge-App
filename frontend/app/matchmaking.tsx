import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FireArenaBackground from "../src/game/FireArenaBackground";
import FireButton from "../src/components/fire/FireButton";
import FirePanel from "../src/components/fire/FirePanel";

// Keep the legacy route safe for old links without joining a matchmaking queue.
export default function MatchmakingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 16), paddingBottom: Math.max(insets.bottom, 16) }]}>
      <FireArenaBackground />
      <FirePanel title="MATCHMAKING UNAVAILABLE" elevated style={styles.panel}>
        <Text accessibilityRole="alert" style={styles.text}>
          Random matchmaking is not available. Choose a contest to play. Friend challenges remain available from player profiles.
        </Text>
        <FireButton title="GO TO CONTESTS" accessibilityLabel="Go to available contests" onPress={() => router.replace("/(tabs)/contests")} fullWidth />
      </FirePanel>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#070A12", justifyContent: "center", alignItems: "center", paddingHorizontal: 16 },
  panel: { maxWidth: 360, width: "100%" },
  text: { color: "#C9B7A5", fontSize: 16, lineHeight: 23, textAlign: "center" },
});
