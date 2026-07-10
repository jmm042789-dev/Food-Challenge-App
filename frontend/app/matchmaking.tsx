import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Animated } from "react-native";
import { useRouter } from "expo-router";
import { api } from "../src/api";

export default function MatchmakingScreen() {
  const router = useRouter();

  const [status, setStatus] = useState("searching");
  const [dots, setDots] = useState("");
  const [matchId, setMatchId] = useState<string | null>(null);

  const pulse = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;

  // 🔵 pulse animation (main core)
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.2,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // 🔵 glow animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 800,
          useNativeDriver: false,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 800,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, []);

  // 🔵 dots animation
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "" : d + "."));
    }, 400);

    return () => clearInterval(interval);
  }, []);

  // 🔵 matchmaking loop
  useEffect(() => {
    let alive = true;
    let interval: any;

    const run = async () => {
      try {
        await api.matchmakingJoin();

        interval = setInterval(async () => {
          const res = await api.matchmakingStatus();

          if (!alive) return;

          if (res.status === "matched") {
            clearInterval(interval);

            setStatus("matched");
            setMatchId(res.match_id);

            // 🎬 cinematic moment trigger
            triggerFoundCinematic();

            setTimeout(() => {
              router.replace(`/play/${res.match_id}`);
            }, 1800);
          }
        }, 1200);
      } catch (e) {
        setStatus("error");
      }
    };

    run();

    return () => {
      alive = false;
      if (interval) clearInterval(interval);
      api.matchmakingLeave().catch(() => {});
    };
  }, []);

  // 🎬 OPONENT FOUND CINEMATIC
  const triggerFoundCinematic = () => {
    setStatus("found");

    Animated.sequence([
      Animated.timing(shake, {
        toValue: 10,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(shake, {
        toValue: -10,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(shake, {
        toValue: 0,
        duration: 80,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const cancel = async () => {
    await api.matchmakingLeave();
    router.back();
  };

  return (
    <View style={styles.container}>
      <Animated.View
        style={{
          transform: [
            { scale: pulse },
            { translateX: shake },
          ],
        }}
      >
        <Text style={styles.title}>⚔️ MATCHMAKING</Text>
      </Animated.View>

      {status === "searching" && (
        <Text style={styles.text}>
          Searching for opponent{dots}
        </Text>
      )}

      {status === "matched" && (
        <Text style={styles.matched}>
          🎉 Match Found!
        </Text>
      )}

      {status === "found" && (
        <Text style={styles.cinematic}>
          ⚡ OPPONENT LOCKED ⚡
        </Text>
      )}

      {status === "error" && (
        <Text style={styles.error}>
          Connection Error
        </Text>
      )}

      <Pressable style={styles.cancelBtn} onPress={cancel}>
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#070A12",
    justifyContent: "center",
    alignItems: "center",
  },

  title: {
    fontSize: 30,
    fontWeight: "900",
    color: "#fff",
    marginBottom: 20,
  },

  text: {
    color: "#aaa",
    fontSize: 16,
  },

  matched: {
    color: "#00ff88",
    fontSize: 22,
    fontWeight: "bold",
    marginTop: 10,
  },

  cinematic: {
    color: "#FFD700",
    fontSize: 24,
    fontWeight: "900",
    marginTop: 10,
  },

  error: {
    color: "red",
    fontSize: 16,
  },

  cancelBtn: {
    marginTop: 50,
    paddingVertical: 10,
    paddingHorizontal: 25,
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 12,
  },

  cancelText: {
    color: "#fff",
  },
});