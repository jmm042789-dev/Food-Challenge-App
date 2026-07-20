import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { api } from "../src/api";
import FireEmptyState from "../src/components/fire/FireEmptyState";
import FireLoading from "../src/components/fire/FireLoading";
import ArcadeBackground from "../src/game/ui/ArcadeBackground";

type BootstrapPlayer = {
  tutorial_done?: unknown;
};

function onboardingIsComplete(player: BootstrapPlayer): boolean | null {
  return typeof player.tutorial_done === "boolean" ? player.tutorial_done : null;
}

export default function Index() {
  const router = useRouter();
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      setError(false);

      try {
        const player = await api.getPlayer() as BootstrapPlayer;
        if (!active) return;

        const completed = onboardingIsComplete(player);
        router.replace(completed === false ? "/tutorial" : "/(tabs)/home");
      } catch {
        if (active) setError(true);
      }
    }

    void bootstrap();
    return () => { active = false; };
  }, [attempt, router]);

  return (
    <View style={styles.screen}>
      <ArcadeBackground />
      {error ? (
        <FireEmptyState
          icon="!"
          title="Unable to Enter the Arena"
          message="Check your connection and try again."
          buttonLabel="RETRY"
          onPress={() => setAttempt((current) => current + 1)}
        />
      ) : (
        <FireLoading title="Loading Arena..." subtitle="Preparing your player profile." />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#070405", flex: 1 },
});
