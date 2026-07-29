import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../src/api";
import { theme } from "../src/theme";
import FireArenaBackground from "../src/game/FireArenaBackground";
import FirePanel from "../src/components/fire/FirePanel";
import FireText from "../src/components/fire/FireText";
import FireBadge from "../src/components/fire/FireBadge";
import FireButton from "../src/components/fire/FireButton";
import FireScreenEntrance from "../src/components/fire/FireScreenEntrance";

export default function TutorialScreen() {
  const router = useRouter();
  const { replay } = useLocalSearchParams<{ replay?: string | string[] }>();
  const replayMode = (Array.isArray(replay) ? replay[0] : replay) === "1";
  const insets = useSafeAreaInsets();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submissionInFlight = useRef(false);
  const tutorialCompleted = useRef(false);

  async function completeTutorial() {
    if (submissionInFlight.current) return;
    if (replayMode) {
      router.back();
      return;
    }

    submissionInFlight.current = true;
    setSubmitting(true);
    setError(null);

    try {
      if (!tutorialCompleted.current) {
        await api.markTutorialDone();
        tutorialCompleted.current = true;
      }

      await api.claimWelcomeReward();
      router.replace({ pathname: "/(tabs)/home", params: { welcome: "1" } });
    } catch {
      setError(tutorialCompleted.current
        ? "Your tutorial is saved, but we couldn't collect your welcome reward. Please try again."
        : "We couldn't save your progress. Please try again.");
      submissionInFlight.current = false;
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <FireArenaBackground />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 12), paddingBottom: Math.max(insets.bottom, 20) }]}
        showsVerticalScrollIndicator={false}
      >
        <FireScreenEntrance duration="fast" distance={10}>

        <Text accessibilityRole="header" style={styles.title}>{replayMode ? "FIRE FEAST REFRESHER" : "WELCOME TO FIRE FEAST"}</Text>
        <Text style={styles.intro}>{replayMode ? "Review the arena essentials anytime. Your progress and rewards will not be changed." : "Three quick steps, then your first featured contest is ready."}</Text>

        </FireScreenEntrance>
        <FirePanel compact title="Choose a Contest" style={styles.card}>
          <FireBadge label="STEP 1 OF 3" variant="gold" />
          <FireText variant="body" style={styles.text}>
            Pick a featured feast, review its food and difficulty, then enter the arena.
          </FireText>
        </FirePanel>

        <FirePanel compact title="Follow the Action Prompt" style={styles.card}>
          <FireBadge label="STEP 2 OF 3" variant="info" />
          <FireText variant="body" style={styles.text}>
            Use the control shown beneath the food. Build combos, watch your heat, and use Antacid when needed.
          </FireText>
        </FirePanel>

        <FirePanel compact title="Grow Your Career" style={styles.card}>
          <FireBadge label="STEP 3 OF 3" variant="gold" />
          <FireText variant="body" style={styles.text}>
            Complete matches to build your career, achievements, missions, ranks, and collections.
          </FireText>
        </FirePanel>

        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <FireButton
          title={replayMode ? "RETURN TO SETTINGS" : "CLAIM REWARD & ENTER ARENA"}
          accessibilityLabel={replayMode ? "Return to Settings" : "Claim welcome reward and enter arena"}
          disabled={submitting}
          loading={submitting}
          onPress={() => { void completeTutorial(); }}
          variant="gold"
          fullWidth
        />

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
    alignSelf: "center",
    maxWidth: 720,
    paddingHorizontal: theme.spacing.screen,
    width: "100%",
  },

  title: {
    fontSize: 27,
    fontWeight: "900",
    color: theme.colors.primary,
    marginBottom: 6,
    textAlign: "center",
  },
  intro: { color: "#C9B7A5", fontSize: 14, lineHeight: 21, marginBottom: 20, textAlign: "center" },

  card: {
    marginBottom: theme.spacing.cardGap,
  },

  text: {
    marginTop: theme.spacing.xxs,
  },

  error: {
    color: "#E7B5A7",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
    marginBottom: theme.spacing.xxs,
    textAlign: "center",
  },
});
