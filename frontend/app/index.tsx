import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { api, cacheBootstrapPlayer, isAuthenticationError, peekBootstrapPlayer } from "../src/api";
import FireEmptyState from "../src/components/fire/FireEmptyState";
import FireLoading from "../src/components/fire/FireLoading";
import ArcadeBackground from "../src/game/ui/ArcadeBackground";

type BootstrapPlayer = {
  tutorial_done?: unknown;
  welcome_reward_claimed?: unknown;
};

export default function Index() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    async function bootstrap() {
      setError(null);

      try {
        const player = await api.getPlayer() as BootstrapPlayer;
        if (!active) return;

        if (player.tutorial_done === false) {
          router.replace("/tutorial");
          return;
        }

        let playerForHome: unknown = player;
        if (player.tutorial_done === true && player.welcome_reward_claimed === false) {
          try {
            const rewardResult = await api.claimWelcomeReward() as { player?: unknown };
            if (rewardResult.player) playerForHome = rewardResult.player;
          } catch {
            // Reward recovery must never block a completed player from Home.
          }
        }

        if (active) {
          cacheBootstrapPlayer(playerForHome);
          router.replace("/(tabs)/home");
        }
      } catch (bootstrapError) {
        if (!active) return;

        const authenticationFailure = isAuthenticationError(bootstrapError);
        const cachedPlayer = peekBootstrapPlayer() as BootstrapPlayer | undefined;
        if (!authenticationFailure && cachedPlayer && cachedPlayer.tutorial_done !== false) {
          router.replace("/(tabs)/home");
          return;
        }

        if (attempt === 0) {
          retryTimer = setTimeout(() => {
            if (active) setAttempt(1);
          }, 750);
        } else {
          setError(
            authenticationFailure
              ? "This guest account could not be verified. Retry without clearing local app data."
              : "Check your connection and try again.",
          );
        }
      }
    }

    void bootstrap();
    return () => {
      active = false;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [attempt, router]);

  return (
    <View style={styles.screen}>
      <ArcadeBackground />
      {error ? (
        <FireEmptyState
          icon="!"
          title="Unable to Enter the Arena"
          message={error}
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
