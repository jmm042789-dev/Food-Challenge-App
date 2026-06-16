import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Modal } from "react-native";
import { useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/src/theme";
import { api } from "@/src/api";
import { beltForXp, nextBelt, progressToNext } from "@/src/ranks";

const EMOJIS = ["🤤", "😋", "🍔", "🌭", "🍕", "🍗", "🥵", "🤠", "🤖", "👑", "🥷", "🐷"];
const COUNTRIES = ["🌍", "🇺🇸", "🇬🇧", "🇯🇵", "🇰🇷", "🇫🇷", "🇮🇹", "🇩🇪", "🇮🇳", "🇧🇷", "🇲🇽", "🇨🇦", "🇦🇺", "🇨🇳"];

export default function ProfileScreen() {
  const [player, setPlayer] = useState<any>(null);
  const [gear, setGear] = useState<any[]>([]);
  const [editing, setEditing] = useState(false);
  const [equipOpen, setEquipOpen] = useState(false);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [country, setCountry] = useState("");

  const load = useCallback(async () => {
    const [p, g] = await Promise.all([api.getPlayer(), api.gear()]);
    setPlayer(p);
    setGear(g.items || []);
    setName(p.username); setAvatar(p.avatar_emoji); setCountry(p.country);
  }, []);

  useFocusEffect(useCallback(() => { load().catch(console.error); }, [load]));

  const save = async () => {
    const p = await api.updatePlayer({ username: name, avatar_emoji: avatar, country });
    setPlayer(p);
    setEditing(false);
  };

  const equipChoice = async (gear_id: string | null) => {
    const p = await api.equipGear(gear_id);
    setPlayer(p);
    setEquipOpen(false);
  };

  if (!player) return <SafeAreaView style={styles.container} />;
  const belt = beltForXp(player.xp || 0);
  const nb = nextBelt(player.xp || 0);
  const prog = progressToNext(player.xp || 0);
  const equipped = gear.find((g) => g.id === player.equipped_gear);
  const owned = gear.filter((g) => (player.owned_gear || []).includes(g.id));

  return (
    <SafeAreaView edges={["top"]} style={styles.container} testID="profile-screen">
      <ScrollView contentContainerStyle={{ padding: theme.s.lg, paddingBottom: theme.s.xxxl }}>
        <View style={styles.heroBlock}>
          <View style={[styles.avatarBig, { borderColor: belt.color }]}>
            <Text style={{ fontSize: 56 }}>{player.avatar_emoji}</Text>
          </View>
          <Text style={styles.country}>{player.country}</Text>
          <Text style={styles.username}>{player.username}</Text>
          <View style={styles.beltRow}>
            <Text style={styles.beltIcon}>{belt.icon}</Text>
            <Text style={[styles.beltName, { color: belt.color }]}>{belt.name}</Text>
          </View>
          <View style={styles.xpBarLarge}>
            <View style={[styles.xpFillLarge, { width: `${prog * 100}%`, backgroundColor: belt.color }]} />
          </View>
          <Text style={styles.xpHint}>{nb ? `${player.xp} / ${nb.min_xp} XP to ${nb.name}` : "MAX RANK ACHIEVED"}</Text>
          <Pressable style={styles.editBtn} onPress={() => setEditing(true)} testID="edit-profile-btn">
            <Ionicons name="create" size={14} color="#fff" />
            <Text style={styles.editBtnText}>EDIT PROFILE</Text>
          </Pressable>
        </View>

        {/* Equipped Gear */}
        <Text style={styles.sectionTitle}>EQUIPPED GEAR</Text>
        <Pressable style={styles.gearSlot} onPress={() => setEquipOpen(true)} testID="equip-gear-btn">
          <Text style={styles.gearSlotIcon}>{equipped?.icon || "👕"}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.gearSlotName}>{equipped?.name || "No gear equipped"}</Text>
            <Text style={styles.gearSlotPerk} numberOfLines={2}>{equipped?.perk || "Tap to choose gear to equip"}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.c.onSurfaceTertiary} />
        </Pressable>

        <Text style={styles.sectionTitle}>STATS</Text>
        <View style={styles.statsGrid}>
          <Stat label="WINS" value={player.wins} icon="trophy" color={theme.c.brandSecondary} />
          <Stat label="MATCHES" value={player.matches} icon="game-controller" color={theme.c.brandTertiary} />
          <Stat label="BEST SCORE" value={player.best_score} icon="flame" color={theme.c.brand} />
          <Stat label="XP" value={player.xp} icon="star" color={theme.c.success} />
        </View>

        <Text style={styles.sectionTitle}>WALLET</Text>
        <View style={styles.walletRow}>
          <View style={styles.walletCard}>
            <Text style={styles.walletIcon}>🪙</Text>
            <Text style={styles.walletValue}>{player.coins}</Text>
            <Text style={styles.walletLabel}>COINS</Text>
          </View>
          <View style={styles.walletCard}>
            <Text style={styles.walletIcon}>💊</Text>
            <Text style={styles.walletValue}>{player.tums}</Text>
            <Text style={styles.walletLabel}>TUMS</Text>
          </View>
        </View>
        <Text style={styles.note}>+1 Tums every 30 min (max 5 free). Visit the Shop for more.</Text>

        <Text style={styles.sectionTitle}>ACHIEVEMENTS</Text>
        <View style={styles.achievementsCol}>
          <Achievement title="First Bite" desc="Play your first match" earned={player.matches >= 1} />
          <Achievement title="Triple Trouble" desc="Win 3 matches" earned={player.wins >= 3} />
          <Achievement title="Iron Stomach" desc="Score 30+ in one match" earned={player.best_score >= 30} />
          <Achievement title="Silver Stomach" desc="Reach Silver belt (200 XP)" earned={player.xp >= 200} />
          <Achievement title="Gold Glutton" desc="Reach Gold belt (800 XP)" earned={player.xp >= 800} />
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={editing} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>EDIT PROFILE</Text>
            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>USERNAME</Text>
              <TextInput value={name} onChangeText={setName} maxLength={20} style={styles.input}
                placeholder="Your name" placeholderTextColor={theme.c.onSurfaceTertiary} testID="edit-name-input" />
              <Text style={styles.label}>AVATAR</Text>
              <View style={styles.emojiGrid}>
                {EMOJIS.map((e) => (
                  <Pressable key={e} onPress={() => setAvatar(e)} style={[styles.emojiBtn, avatar === e && styles.emojiBtnActive]}>
                    <Text style={{ fontSize: 24 }}>{e}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.label}>COUNTRY</Text>
              <View style={styles.emojiGrid}>
                {COUNTRIES.map((e) => (
                  <Pressable key={e} onPress={() => setCountry(e)} style={[styles.emojiBtn, country === e && styles.emojiBtnActive]}>
                    <Text style={{ fontSize: 22 }}>{e}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable onPress={() => setEditing(false)} style={[styles.modalBtn, { backgroundColor: theme.c.surfaceTertiary }]}>
                <Text style={styles.modalBtnText}>CANCEL</Text>
              </Pressable>
              <Pressable onPress={save} style={[styles.modalBtn, { backgroundColor: theme.c.brand }]} testID="save-profile-btn">
                <Text style={styles.modalBtnText}>SAVE</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Equip Gear Modal */}
      <Modal visible={equipOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>EQUIP GEAR</Text>
            <ScrollView style={{ maxHeight: 420 }}>
              <Pressable style={styles.gearOpt} onPress={() => equipChoice(null)}>
                <Text style={styles.gearOptIcon}>👕</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.gearOptName}>None</Text>
                  <Text style={styles.gearOptPerk}>Play raw — no equipped perk</Text>
                </View>
                {!player.equipped_gear && <Ionicons name="checkmark-circle" color={theme.c.success} size={22} />}
              </Pressable>
              {owned.length === 0 && (
                <Text style={styles.emptyText}>No gear owned. Visit Shop → Gear to buy permanent perks.</Text>
              )}
              {owned.map((g) => (
                <Pressable key={g.id} style={styles.gearOpt} onPress={() => equipChoice(g.id)} testID={`equip-${g.id}`}>
                  <Text style={styles.gearOptIcon}>{g.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.gearOptName}>{g.name}</Text>
                    <Text style={styles.gearOptPerk}>{g.perk}</Text>
                  </View>
                  {player.equipped_gear === g.id && <Ionicons name="checkmark-circle" color={theme.c.success} size={22} />}
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable onPress={() => setEquipOpen(false)} style={[styles.modalBtn, { backgroundColor: theme.c.brand }]}>
                <Text style={styles.modalBtnText}>DONE</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Stat({ label, value, icon, color }: { label: string; value: number; icon: any; color: string }) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}
function Achievement({ title, desc, earned }: { title: string; desc: string; earned: boolean }) {
  return (
    <View style={[styles.achCard, !earned && { opacity: 0.5 }]}>
      <Ionicons name={earned ? "checkmark-circle" : "lock-closed"} size={24} color={earned ? theme.c.success : theme.c.onSurfaceTertiary} />
      <View style={{ flex: 1, marginLeft: theme.s.md }}>
        <Text style={styles.achTitle}>{title}</Text>
        <Text style={styles.achDesc}>{desc}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.c.surface },
  heroBlock: { alignItems: "center", paddingVertical: theme.s.xl },
  avatarBig: { width: 100, height: 100, borderRadius: theme.r.pill, backgroundColor: theme.c.surfaceSecondary, alignItems: "center", justifyContent: "center", borderWidth: 3 },
  country: { fontSize: 28, marginTop: 6 },
  username: { color: theme.c.onSurface, fontSize: 24, fontWeight: "900", marginTop: 4 },
  beltRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  beltIcon: { fontSize: 18 },
  beltName: { fontSize: 14, fontWeight: "900", letterSpacing: 1 },
  xpBarLarge: { width: "70%", height: 8, backgroundColor: theme.c.surfaceSecondary, borderRadius: 4, marginTop: 12, overflow: "hidden" },
  xpFillLarge: { height: "100%" },
  xpHint: { color: theme.c.onSurfaceTertiary, fontSize: 11, marginTop: 6 },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: theme.c.surfaceSecondary, paddingHorizontal: theme.s.md, paddingVertical: 6, borderRadius: theme.r.pill, marginTop: 10, borderWidth: 1, borderColor: theme.c.border },
  editBtnText: { color: "#fff", fontWeight: "800", fontSize: 11, letterSpacing: 1 },
  sectionTitle: { color: theme.c.onSurface, fontSize: 13, fontWeight: "900", letterSpacing: 2, marginTop: theme.s.xl, marginBottom: theme.s.md },
  gearSlot: { flexDirection: "row", alignItems: "center", gap: theme.s.md, backgroundColor: theme.c.surfaceSecondary, padding: theme.s.md, borderRadius: theme.r.md, borderWidth: 1, borderColor: theme.c.border },
  gearSlotIcon: { fontSize: 32 },
  gearSlotName: { color: "#fff", fontSize: 14, fontWeight: "900" },
  gearSlotPerk: { color: theme.c.onSurfaceTertiary, fontSize: 11, marginTop: 2 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: theme.s.sm },
  statCard: { width: "48%", backgroundColor: theme.c.surfaceSecondary, padding: theme.s.md, borderRadius: theme.r.md, borderWidth: 1, borderColor: theme.c.border },
  statValue: { color: theme.c.onSurface, fontSize: 26, fontWeight: "900", marginTop: 6 },
  statLabel: { color: theme.c.onSurfaceTertiary, fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  walletRow: { flexDirection: "row", gap: theme.s.sm },
  walletCard: { flex: 1, backgroundColor: theme.c.surfaceSecondary, padding: theme.s.md, borderRadius: theme.r.md, alignItems: "center", borderWidth: 1, borderColor: theme.c.border },
  walletIcon: { fontSize: 36 },
  walletValue: { color: theme.c.brandSecondary, fontSize: 28, fontWeight: "900", marginTop: 4 },
  walletLabel: { color: theme.c.onSurfaceTertiary, fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  note: { color: theme.c.onSurfaceTertiary, fontSize: 11, marginTop: 8, textAlign: "center" },
  achievementsCol: { gap: theme.s.sm },
  achCard: { flexDirection: "row", alignItems: "center", backgroundColor: theme.c.surfaceSecondary, padding: theme.s.md, borderRadius: theme.r.md, borderWidth: 1, borderColor: theme.c.border },
  achTitle: { color: theme.c.onSurface, fontSize: 14, fontWeight: "800" },
  achDesc: { color: theme.c.onSurfaceTertiary, fontSize: 12, marginTop: 2 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: theme.c.surfaceSecondary, padding: theme.s.lg, borderTopLeftRadius: theme.r.lg, borderTopRightRadius: theme.r.lg, maxHeight: "85%" },
  modalTitle: { color: theme.c.onSurface, fontSize: 20, fontWeight: "900", letterSpacing: 1, marginBottom: theme.s.md },
  label: { color: theme.c.onSurfaceTertiary, fontSize: 11, fontWeight: "700", letterSpacing: 1, marginTop: theme.s.md, marginBottom: 6 },
  input: { backgroundColor: theme.c.surface, color: theme.c.onSurface, padding: theme.s.md, borderRadius: theme.r.md, borderWidth: 1, borderColor: theme.c.border, fontSize: 16 },
  emojiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  emojiBtn: { width: 44, height: 44, borderRadius: theme.r.md, backgroundColor: theme.c.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: theme.c.border },
  emojiBtnActive: { borderColor: theme.c.brand, borderWidth: 2 },
  modalActions: { flexDirection: "row", gap: theme.s.md, marginTop: theme.s.lg },
  modalBtn: { flex: 1, paddingVertical: theme.s.md, borderRadius: theme.r.pill, alignItems: "center" },
  modalBtnText: { color: "#fff", fontWeight: "900", letterSpacing: 1 },
  gearOpt: { flexDirection: "row", alignItems: "center", gap: theme.s.md, padding: theme.s.md, backgroundColor: theme.c.surface, borderRadius: theme.r.md, marginBottom: theme.s.sm, borderWidth: 1, borderColor: theme.c.border },
  gearOptIcon: { fontSize: 32 },
  gearOptName: { color: "#fff", fontSize: 14, fontWeight: "900" },
  gearOptPerk: { color: theme.c.onSurfaceTertiary, fontSize: 11, marginTop: 2 },
  emptyText: { color: theme.c.onSurfaceTertiary, textAlign: "center", padding: theme.s.lg, fontSize: 12 },
});
