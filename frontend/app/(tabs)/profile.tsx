import ArcadeBackground from "../../src/game/ui/ArcadeBackground";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/src/theme";
import { api } from "@/src/api";
import { beltForXp, nextBelt, progressToNext } from "@/src/ranks";

export default function ProfileScreen() {
  const [player, setPlayer] = useState<any>(null);
  const [gear, setGear] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [equipOpen, setEquipOpen] = useState(false);

  const xpAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      console.log("🔥 Loading profile...");

      const p = await api.getPlayer();
      const g = await api.gear();

      console.log("✅ Player:", p);
      console.log("✅ Gear:", g);

      setPlayer(p);
      setGear(g?.items || []);
    } catch (err: any) {
      console.log("❌ Profile load error:", err);
      setError("Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    if (!player) return;

    const prog = progressToNext(player.xp || 0);

    Animated.timing(xpAnim, {
      toValue: prog,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [player]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, []);

  // ⛔ LOADING STATE (prevents blank screen)
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ArcadeBackground />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text style={{ color: "white" }}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ⛔ ERROR STATE
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <ArcadeBackground />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text style={{ color: "red" }}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ⛔ NO PLAYER STATE (safe fallback)
  if (!player) {
    return (
      <SafeAreaView style={styles.container}>
        <ArcadeBackground />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text style={{ color: "white" }}>No player data found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const belt = beltForXp(player.xp || 0);
  const nb = nextBelt(player.xp || 0);

  const equipped = gear?.find((g) => g.id === player?.equipped_gear);

  const glowInterpolation = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 1],
  });

  return (
    <SafeAreaView style={styles.container}>
      <ArcadeBackground />

      <ScrollView contentContainerStyle={{ padding: 16 }}>

        {/* HERO CARD */}
        <Animated.View
          style={[
            styles.heroCard,
            {
              shadowOpacity: glowInterpolation,
              borderColor: belt.color,
            },
          ]}
        >
          <Animated.View
            style={[
              styles.avatarRing,
              {
                borderColor: belt.color,
                shadowOpacity: glowInterpolation,
              },
            ]}
          >
            <Text style={styles.avatar}>{player.avatar_emoji}</Text>
          </Animated.View>

          <Text style={styles.country}>{player.country}</Text>
          <Text style={styles.username}>{player.username}</Text>

          <View style={styles.beltRow}>
            <Text style={styles.beltIcon}>{belt.icon}</Text>
            <Text style={[styles.beltName, { color: belt.color }]}>
              {belt.name}
            </Text>
          </View>

          <View style={styles.xpBar}>
            <Animated.View
              style={[
                styles.xpFill,
                {
                  width: xpAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0%", "100%"],
                  }),
                  backgroundColor: belt.color,
                },
              ]}
            />
          </View>

          <Text style={styles.xpText}>
            {nb
              ? `${player.xp} / ${nb.min_xp} XP → ${nb.name}`
              : "MAX RANK"}
          </Text>
        </Animated.View>

        {/* GEAR */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>EQUIPPED GEAR</Text>

          <Pressable
            style={styles.gearRow}
            onPress={() => setEquipOpen(true)}
          >
            <Text style={styles.gearIcon}>{equipped?.icon || "👕"}</Text>

            <View style={{ flex: 1 }}>
              <Text style={styles.gearName}>
                {equipped?.name || "No gear equipped"}
              </Text>
              <Text style={styles.gearPerk}>
                {equipped?.perk || "Tap to equip gear"}
              </Text>
            </View>

            <Ionicons name="chevron-forward" size={20} color="#aaa" />
          </Pressable>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F1115",
  },
  heroCard: {
    backgroundColor: "#1C1F26",
    borderRadius: 18,
    padding: 20,
    alignItems: "center",
    borderWidth: 2,
    marginBottom: 16,
    shadowColor: "#FFD700",
    shadowRadius: 20,
  },
  avatarRing: {
    width: 110,
    height: 110,
    borderRadius: 60,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    shadowColor: "#FFD700",
    shadowRadius: 15,
  },
  avatar: { fontSize: 52 },
  country: { fontSize: 22, marginBottom: 2 },
  username: { color: "white", fontSize: 22, fontWeight: "900" },
  beltRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  beltIcon: { fontSize: 18, marginRight: 6 },
  beltName: { fontWeight: "900", fontSize: 14 },
  xpBar: {
    width: "100%",
    height: 10,
    backgroundColor: "#333",
    borderRadius: 999,
    marginTop: 12,
    overflow: "hidden",
  },
  xpFill: { height: "100%", borderRadius: 999 },
  xpText: { color: "#aaa", fontSize: 11, marginTop: 6 },
  card: {
    backgroundColor: "#1C1F26",
    padding: 16,
    borderRadius: 14,
  },
  sectionTitle: {
    color: "white",
    fontWeight: "900",
    marginBottom: 10,
  },
  gearRow: { flexDirection: "row", alignItems: "center" },
  gearIcon: { fontSize: 32, marginRight: 10 },
  gearName: { color: "white", fontWeight: "900" },
  gearPerk: { color: "#aaa", fontSize: 11 },
});