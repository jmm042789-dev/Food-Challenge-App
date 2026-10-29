import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import Constants from "expo-constants";

import { api, cacheBootstrapPlayer, describeAuthenticationFailure, publicAuthRuntimeDiagnostics } from "../src/api";
import type { AuthDiagnosticCode } from "../src/guestAuthDiagnostics";
import FireButton from "../src/components/fire/FireButton";
import FireEmptyState from "../src/components/fire/FireEmptyState";
import FireLoading from "../src/components/fire/FireLoading";
import ArcadeBackground from "../src/game/ui/ArcadeBackground";
import { classifyStartupFailure, startupDiagnosticCode, validateBootstrapPlayer, withTransientStartupRetry, type StartupDiagnosticCode, type StartupFailureKind, type StartupOperation } from "../src/startupReliability";

type StartupFailure = {
  code: AuthDiagnosticCode;
  message: string;
  requestId: string | null;
  canStartNewGuest: boolean;
  stage: string;
  httpStatus: number | null;
  backendCode: string | null;
  routeClass: string;
  kind: StartupFailureKind;
  title: string;
  startupCode: StartupDiagnosticCode;
};

type BuildExtra = {
  authImplementation?: string;
  easBuildId?: string;
  gitCommit?: string;
};

function startupFailureFor(error: unknown, operation: StartupOperation): StartupFailure {
  const diagnostic = describeAuthenticationFailure(error);
  const classification = classifyStartupFailure(error);
  return { ...diagnostic, startupCode: startupDiagnosticCode(error, operation, diagnostic.stage), kind: classification.kind, title: classification.kind === "OFFLINE" ? "No Connection" : classification.kind === "TIMEOUT" || classification.kind === "SERVER" ? "Arena Temporarily Unavailable" : "Player Data Could Not Be Loaded", message: classification.message };
}

const runtimeAuth = publicAuthRuntimeDiagnostics();
const buildExtra = (Constants.expoConfig?.extra?.build ?? {}) as BuildExtra;
const nativeBuild = Constants.nativeBuildVersion
  ?? Constants.expoConfig?.android?.versionCode?.toString()
  ?? "unknown";
const publicVersion = Constants.expoConfig?.version ?? "unknown";
const shortCommit = typeof buildExtra.gitCommit === "string" && buildExtra.gitCommit !== "local"
  ? buildExtra.gitCommit.slice(0, 8)
  : "local";

export default function Index() {
  const router = useRouter();
  const [failure, setFailure] = useState<StartupFailure | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [resetting, setResetting] = useState(false);
  const generation = useRef(0);
  const bootstrapInFlight = useRef(false);
  const [slowAuthentication, setSlowAuthentication] = useState(false);
  const loadingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopLoadingTimer = useCallback(() => {
    if (loadingTimer.current !== null) clearTimeout(loadingTimer.current);
    loadingTimer.current = null;
  }, []);
  const startLoadingTimer = useCallback(() => {
    stopLoadingTimer();
    setSlowAuthentication(false);
    loadingTimer.current = setTimeout(() => {
      loadingTimer.current = null;
      setSlowAuthentication(true);
    }, 15000);
  }, [stopLoadingTimer]);
  useEffect(() => stopLoadingTimer, [stopLoadingTimer]);

  useEffect(() => {
    let active = true;
    const currentGeneration = ++generation.current;
    const isCurrent = () => active && generation.current === currentGeneration;

    async function bootstrap() {
      setFailure(null);
      bootstrapInFlight.current = true;
      let operation: StartupOperation = "PLAYER_FETCH";

      try {
        const playerResponse = await withTransientStartupRetry(
          async () => {
            startLoadingTimer();
            try { return await api.getPlayer(); }
            finally {
              stopLoadingTimer();
              if (isCurrent()) setSlowAuthentication(false);
            }
          },
          { operationName: "player-bootstrap", isCurrent, manual: attempt > 0 },
        );
        const player = validateBootstrapPlayer(playerResponse);
        if (!isCurrent()) return;

        try {
          if (await api.pendingResult()) {
            if (isCurrent()) router.replace("/match-recovery" as never);
            return;
          }
        } catch {
          if (isCurrent()) router.replace("/match-recovery" as never);
          return;
        }
        operation = "ACTIVE_MATCH";
        const matchRecovery = await withTransientStartupRetry(
          () => api.startupActiveMatch(),
          { operationName: "active-match-recovery", isCurrent, manual: attempt > 0 },
        );
        if (!isCurrent()) return;
        if (
          matchRecovery.status === "resumable"
          && typeof matchRecovery.contest_id === "string"
          && matchRecovery.contest_id
        ) {
          router.replace(`/play/${encodeURIComponent(matchRecovery.contest_id)}?resumeMatchId=${encodeURIComponent(matchRecovery.match_id ?? "missing")}` as never);
          return;
        }

        operation = "ACTIVE_PVP";
        const pvpRecovery = await withTransientStartupRetry(
          () => api.startupActivePvpMatch(),
          { operationName: "active-pvp-recovery", isCurrent, manual: attempt > 0 },
        );
        if (!isCurrent()) return;
        if (pvpRecovery.status !== "absent" && "match_id" in pvpRecovery) {
          router.replace(`/pvp/match/${encodeURIComponent(pvpRecovery.match_id)}` as never);
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

        if (isCurrent()) {
          cacheBootstrapPlayer(playerForHome);
          router.replace("/(tabs)/home");
        }
      } catch (bootstrapError) {
        if (!isCurrent()) return;

        setFailure(startupFailureFor(bootstrapError, operation));
      } finally {
        stopLoadingTimer();
        if (isCurrent()) bootstrapInFlight.current = false;
      }
    }

    void bootstrap();
    return () => {
      active = false;
      stopLoadingTimer();
      bootstrapInFlight.current = false;
    };
  }, [attempt, router, startLoadingTimer, stopLoadingTimer]);

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
            startLoadingTimer();
            void api.startNewGuestAccount().then((player) => {
              cacheBootstrapPlayer(player);
              router.replace("/tutorial");
            }).catch((error) => {
              setFailure(startupFailureFor(error, "PLAYER_FETCH"));
            }).finally(() => {
              stopLoadingTimer();
              setResetting(false);
            });
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
            title={failure.title}
            message={failure.message}
            buttonLabel="RETRY"
            onPress={() => { if (!bootstrapInFlight.current) setAttempt((current) => current + 1); }}
          />
          <Text selectable style={styles.diagnostic}>Diagnostic {failure.startupCode}{failure.requestId ? ` · Request ${failure.requestId}` : ""}</Text>
          <Text selectable={__DEV__} style={[styles.runtimeDiagnostic, !__DEV__ && styles.hiddenDiagnostic]}>
            {failure.routeClass}{failure.httpStatus ? ` · HTTP ${failure.httpStatus}` : ""}{failure.backendCode ? ` · ${failure.backendCode}` : ""}
          </Text>
          <Text selectable={__DEV__} style={[styles.runtimeDiagnostic, !__DEV__ && styles.hiddenDiagnostic]}>
            {failure.stage} · App {publicVersion} ({nativeBuild}) · {buildExtra.authImplementation ?? runtimeAuth.authImplementation} · {shortCommit} · {runtimeAuth.backendHost}
          </Text>
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
        <FireLoading title="Loading Arena..." subtitle={slowAuthentication
          ? "Connecting to the Arena. This may take a little longer."
          : "Preparing your player profile."} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#070405", flex: 1 },
  failure: { alignSelf: "center", justifyContent: "center", maxWidth: 430, width: "100%" },
  diagnostic: { color: "#A99483", fontSize: 11, marginHorizontal: 24, marginTop: -24, textAlign: "center" },
  runtimeDiagnostic: { color: "#806F65", fontSize: 10, marginHorizontal: 24, marginTop: 6, textAlign: "center" },
  hiddenDiagnostic: { display: "none" },
});
