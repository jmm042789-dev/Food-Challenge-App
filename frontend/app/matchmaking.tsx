import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { api } from "../src/api";
import FireArenaBackground from "../src/game/FireArenaBackground";
import FireButton from "../src/components/fire/FireButton";
import FirePanel from "../src/components/fire/FirePanel";
import FireScreenEntrance from "../src/components/fire/FireScreenEntrance";

export default function MatchmakingScreen() {
  const router = useRouter();
  const [status, setStatus] = useState("searching");
  const routeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    let interval: ReturnType<typeof setInterval> | undefined;

    const run = async () => {
      try {
        await api.matchmakingJoin();
        interval = setInterval(async () => {
          const res = await api.matchmakingStatus();
          if (!alive) return;

          if (res.status === "matched") {
            if (interval) clearInterval(interval);
            setStatus("found");
            routeTimer.current = setTimeout(() => {
              router.replace(`/play/${res.match_id}`);
            }, 1800);
          }
        }, 1200);
      } catch {
        if (alive) setStatus("error");
      }
    };

    run();
    return () => {
      alive = false;
      if (interval) clearInterval(interval);
      if (routeTimer.current) clearTimeout(routeTimer.current);
      api.matchmakingLeave().catch(() => {});
    };
  }, [router]);

  const cancel = async () => {
    await api.matchmakingLeave();
    router.back();
  };

  return (
    <View style={styles.container}>
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
