import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { api, cacheBootstrapPlayer, describeAuthenticationFailure, peekBootstrapPlayer } from "../src/api";
import type { AuthDiagnosticCode } from "../src/guestAuthDiagnostics";
import FireButton from "../src/components/fire/FireButton";
import FireEmptyState from "../src/components/fire/FireEmptyState";
import FireLoading from "../src/components/fire/FireLoading";
import ArcadeBackground from "../src/game/ui/ArcadeBackground";

type BootstrapPlayer = {
  tutorial_done?: unknown;
  welcome_reward_claimed?: unknown;
};

type StartupFailure = {
  code: AuthDiagnosticCode;
  message: string;
  requestId: string | null;
  canStartNewGuest: boolean;
};

export default function Index() {
  const router = useRouter();
  const [failure, setFailure] = useState<StartupFailure | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    let active = true;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    async function bootstrap() {
      setFailure(null);

      try {
        const player = await api.getPlayer() as BootstrapPlayer;
        if (!active) return;

        const matchRecovery = await api.activeMatch();
        if (!active) return;
        if (
          matchRecovery.status === "resumable"
          && typeof matchRecovery.contest_id === "string"
          && matchRecovery.contest_id
        ) {
          router.replace(`/play/${encodeURIComponent(matchRecovery.contest_id)}`);
          return;
        }

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

        const diagnostic = describeAuthenticationFailure(bootstrapError);
        const cachedPlayer = peekBootstrapPlayer() as BootstrapPlayer | undefined;
        if (diagnostic.code === "AUTH_NETWORK" && cachedPlayer && cachedPlayer.tutorial_done !== false) {
          router.replace("/(tabs)/home");
          return;
        }

        if (attempt === 0) {
          retryTimer = setTimeout(() => {
            if (active) setAttempt(1);
          }, 750);
        } else {
          setFailure(diagnostic);
        }
      }
    }

    void bootstrap();
    return () => {
      active = false;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [attempt, router]);

  const confirmNewGuest = () => {
    Alert.alert(
      "Start a new guest account?",
      "This clears only guest access stored on this device. You may permanently lose local access to the previous guest and its progress. The previous server account is not deleted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Start New Guest",
          style: "destructive",
          onPress: () => {
            setResetting(true);
            setFailure(null);
            void api.startNewGuestAccount().then((player) => {
              cacheBootstrapPlayer(player);
              router.replace("/tutorial");
            }).catch((error) => {
              setFailure(describeAuthenticationFailure(error));
            }).finally(() => setResetting(false));
          },
        },
      ],
    );
  };

  return (
    <View style={styles.screen}>
      <ArcadeBackground />
      {failure ? (
        <View style={styles.failure}>
          <FireEmptyState
            icon="!"
            title="Unable to Enter the Arena"
            message={failure.message}
            buttonLabel="RETRY"
            onPress={() => setAttempt((current) => current + 1)}
          />
          <Text selectable style={styles.diagnostic}>{failure.code}{failure.requestId ? ` · Request ${failure.requestId}` : ""}</Text>
          {failure.canStartNewGuest ? (
            <FireButton
              accessibilityHint="Requires confirmation and may remove local access to the previous guest"
              disabled={resetting}
              fullWidth
              loading={resetting}
              onPress={confirmNewGuest}
              title="START NEW GUEST ACCOUNT"
              variant="danger"
            />
          ) : null}
        </View>
      ) : (
        <FireLoading title="Loading Arena..." subtitle="Preparing your player profile." />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#070405", flex: 1 },
  failure: { alignSelf: "center", justifyContent: "center", maxWidth: 430, width: "100%" },
  diagnostic: { color: "#A99483", fontSize: 11, marginHorizontal: 24, marginTop: -24, textAlign: "center" },
});
