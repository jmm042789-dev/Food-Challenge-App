import { useRouter } from "expo-router";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/src/theme";
import { api } from "@/src/api";
import { sfx } from "@/src/audio";

const TIPS = [
  { icon: "🍔", title: "TAP TO CHOMP", desc: "Each food item takes 3 chomps. Food shrinks as you bite. Score = items finished." },
  { icon: "🔥", title: "HEARTBURN KO", desc: "The 🔥 meter on the left fills with every bite. Hit 100 and you're out. Use 💊 Tums to reduce it (-50)." },
  { icon: "🍔", title: "BELLY FULLNESS", desc: "The 🍔 meter fills as you eat. Too stuffed (100) and you freeze up. Use 💧 Dunk to soften your gut (-45)." },
  { icon: "🔥", title: "COMBO MULTIPLIER", desc: "Rapid taps within ~half a second build a combo. Every 5-streak gives a BONUS item!" },
  { icon: "🎮", title: "DIFFERENT FOODS, DIFFERENT MOVES", desc: "Wings need a swipe, Ice Cream needs a long press, Burgers reward rapid taps." },
];

export default function Tutorial() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.container} testID="tutorial-screen">
      <ScrollView contentContainerStyle={{ padding: theme.s.lg, paddingBottom: 120 }}>
        <Text style={styles.title}>WELCOME, ROOKIE!</Text>
        <Text style={styles.subtitle}>Quick rundown before you face the champs.</Text>
        {TIPS.map((t, i) => (
          <View key={i} style={styles.tipCard}>
            <Text style={styles.tipIcon}>{t.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.tipTitle}>{t.title}</Text>
              <Text style={styles.tipDesc}>{t.desc}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={styles.footer}>
        <Pressable
          onPress={async () => {
            sfx.play("click");
            await api.markTutorialDone().catch(() => {});
            router.replace("/play/tutorial" as any);
          }}
          style={styles.primaryBtn}
          testID="start-practice-btn"
        >
          <Ionicons name="play" size={18} color="#fff" />
          <Text style={styles.primaryBtnText}>START PRACTICE MATCH</Text>
        </Pressable>
        <Pressable
          onPress={async () => {
            sfx.play("click");
            await api.markTutorialDone().catch(() => {});
            router.replace("/(tabs)/home" as any);
          }}
          style={styles.secondaryBtn}
          testID="skip-tutorial-btn"
        >
          <Text style={styles.secondaryBtnText}>SKIP {String.fromCharCode(8212)} I KNOW WHAT I AM DOING</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.c.surface },
  title: { color: "#fff", fontSize: 36, fontFamily: theme.f.display, letterSpacing: 1, marginTop: 12 },
  subtitle: { color: theme.c.brandSecondary, fontSize: 14, fontWeight: "800", letterSpacing: 1, marginBottom: theme.s.xl },
  tipCard: { flexDirection: "row", gap: theme.s.md, backgroundColor: theme.c.surfaceSecondary, padding: theme.s.md, borderRadius: theme.r.md, marginBottom: theme.s.sm, borderWidth: 1, borderColor: theme.c.border },
  tipIcon: { fontSize: 40 },
  tipTitle: { color: "#fff", fontSize: 14, fontWeight: "900", letterSpacing: 1 },
  tipDesc: { color: theme.c.onSurfaceSecondary, fontSize: 12, marginTop: 4, lineHeight: 16 },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, padding: theme.s.lg, backgroundColor: theme.c.surface, borderTopColor: theme.c.border, borderTopWidth: 1, gap: theme.s.sm },
  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: theme.c.brand, paddingVertical: theme.s.lg, borderRadius: theme.r.pill },
  primaryBtnText: { color: "#fff", fontWeight: "900", letterSpacing: 1 },
  secondaryBtn: { alignItems: "center", paddingVertical: theme.s.md },
  secondaryBtnText: { color: theme.c.onSurfaceTertiary, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
});
