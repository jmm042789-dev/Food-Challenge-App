import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "../src/theme";
import FireArenaBackground from "../src/game/FireArenaBackground";
import FirePanel from "../src/components/fire/FirePanel";
import FireText from "../src/components/fire/FireText";
import FireBadge from "../src/components/fire/FireBadge";
import FireScreenEntrance from "../src/components/fire/FireScreenEntrance";

export default function TutorialScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <FireArenaBackground />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 12), paddingBottom: Math.max(insets.bottom, 20) }]}
        showsVerticalScrollIndicator={false}
      >
        <FireScreenEntrance duration="fast" distance={10}>

        <Text style={styles.title}>🔥 FIRE FEAST GUIDE</Text>

        </FireScreenEntrance>
        <FirePanel compact title="How to Play" style={styles.card}>
          <FireBadge label="STEP 1 OF 3" variant="gold" />
          <FireText variant="body" style={styles.text}>
            Enter contests, compete in food challenges, and earn points in the Fire Feast Arena.
          </FireText>
        </FirePanel>

        <FirePanel compact title="Scoring" style={styles.card}>
          <FireBadge label="STEP 2 OF 3" variant="info" />
          <FireText variant="body" style={styles.text}>
            Your performance is ranked based on speed, completion, and bonus objectives.
          </FireText>
        </FirePanel>

        <FirePanel compact title="Rewards" style={styles.card}>
          <FireBadge label="STEP 3 OF 3" variant="gold" />
          <FireText variant="body" style={styles.text}>
            Win coins, XP, and unlock higher ranked arenas as you progress.
          </FireText>
        </FirePanel>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  content: {
    paddingHorizontal: theme.spacing.screen,
  },

  title: {
    fontSize: 22,
    fontWeight: "900",
    color: theme.colors.primary,
    marginBottom: 20,
  },

  card: {
    marginBottom: theme.spacing.cardGap,
  },

  text: {
    marginTop: theme.spacing.xxs,
  },
});
