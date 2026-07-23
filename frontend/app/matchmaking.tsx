import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "../src/api";
import FireArenaBackground from "../src/game/FireArenaBackground";
import FireButton from "../src/components/fire/FireButton";
import FirePanel from "../src/components/fire/FirePanel";
import FireScreenEntrance from "../src/components/fire/FireScreenEntrance";

export default function MatchmakingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState("searching");
  const [attempt, setAttempt] = useState(0);
  const routeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const joined = useRef(false);
  const canceling = useRef(false);

  useEffect(() => {
    let alive = true;
    let interval: ReturnType<typeof setInterval> | undefined;
    let statusRequestInFlight = false;
    let matchHandled = false;

    const run = async () => {
      setStatus("searching");
      try {
        if (joined.current) return;
        joined.current = true;
        await api.matchmakingJoin();
        interval = setInterval(async () => {
          if (!alive || statusRequestInFlight || matchHandled) return;

          statusRequestInFlight = true;
          try {
            const res = await api.matchmakingStatus();
            if (!alive || matchHandled) return;

            if (res.status === "matched") {
              matchHandled = true;
              if (interval) clearInterval(interval);
              setStatus("found");
              routeTimer.current = setTimeout(() => {
                router.replace(`/play/${res.match_id}`);
              }, 1800);
            }
          } catch {
            // The API helper logs request failures; keep polling on the next tick.
          } finally {
            statusRequestInFlight = false;
          }
        }, 1200);
      } catch {
        joined.current = false;
        if (alive) setStatus("error");
      }
    };

    run();
    return () => {
      alive = false;
      if (interval) clearInterval(interval);
      if (routeTimer.current) clearTimeout(routeTimer.current);
      if (joined.current) {
        joined.current = false;
        void api.matchmakingLeave().catch(() => {});
      }
    };
  }, [attempt, router]);

  const cancel = () => {
    if (canceling.current) return;
    canceling.current = true;
    if (routeTimer.current) clearTimeout(routeTimer.current);
    router.replace("/(tabs)/home");
    if (joined.current) {
      joined.current = false;
      void api.matchmakingLeave().catch(() => {});
    }
  };

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 16), paddingBottom: Math.max(insets.bottom, 16) }]}>
      <FireArenaBackground />
      <FireScreenEntrance duration="fast" distance={10}>
        <Text style={styles.title}>⚔️ MATCHMAKING</Text>
      </FireScreenEntrance>

      <FireScreenEntrance delay={60} distance={10}>
        <FirePanel title="FIND AN OPPONENT" elevated style={styles.panel}>
          {status === "searching" ? (
            <FireScreenEntrance duration="fast" distance={8}>
              <Text style={styles.text}>Searching for opponent...</Text>
            </FireScreenEntrance>
          ) : null}
          {status === "found" ? (
            <FireScreenEntrance duration="fast" distance={8} scaleFrom={0.97}>
              <Text style={styles.cinematic}>⚡ OPPONENT LOCKED ⚡</Text>
            </FireScreenEntrance>
          ) : null}
          {status === "error" ? (
            <FireScreenEntrance duration="fast" distance={8}>
              <Text style={styles.error}>Connection Error</Text>
              <FireButton title="Retry" onPress={() => setAttempt((current) => current + 1)} variant="secondary" size="small" />
            </FireScreenEntrance>
          ) : null}
          <FireButton title="Cancel" onPress={cancel} variant="ghost" size="small" />
        </FirePanel>
      </FireScreenEntrance>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#070A12", justifyContent: "center", alignItems: "center", paddingHorizontal: 16 },
  title: { fontSize: 30, fontWeight: "900", color: "#fff", marginBottom: 20, textAlign: "center" },
  panel: { alignItems: "center", maxWidth: 360, width: "100%" },
  text: { color: "#aaa", fontSize: 16, textAlign: "center" },
  cinematic: { color: "#FFD700", fontSize: 24, fontWeight: "900", marginTop: 10, textAlign: "center" },
  error: { color: "red", fontSize: 16, textAlign: "center" },
});
