import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import ArcadeBackground from "../src/game/ui/ArcadeBackground";
import FireButton from "../src/components/fire/FireButton";
import FirePanel from "../src/components/fire/FirePanel";
import AvatarRenderer from "../src/profile/AvatarRenderer";
import { AVATAR_OPTIONS, DEFAULT_AVATAR, loadPlayerIdentity, savePlayerIdentity, validateGamerName, type AvatarCategory, type AvatarConfiguration } from "../src/profile/PlayerIdentity";
import { useAppPreferences } from "../src/preferences/AppPreferences";

const categories: readonly { key: AvatarCategory; label: string }[] = [
  { key: "base", label: "BASE CHARACTER" }, { key: "skinTone", label: "SKIN TONE" }, { key: "hair", label: "HAIR" },
  { key: "hairColor", label: "HAIR COLOR" }, { key: "eyes", label: "EYES" }, { key: "facialHair", label: "FACIAL HAIR" },
  { key: "glasses", label: "GLASSES" }, { key: "headwear", label: "HEADWEAR" }, { key: "clothing", label: "CLOTHING" },
  { key: "accessory", label: "ACCESSORIES" }, { key: "background", label: "BACKGROUND" },
];

export default function AvatarCustomizationScreen() {
  const router = useRouter();
  const { preferences } = useAppPreferences();
  const [gamerName, setGamerName] = useState("Hungry Hero");
  const [avatar, setAvatar] = useState<AvatarConfiguration>(DEFAULT_AVATAR);
  const [saving, setSaving] = useState(false);
  const validation = useMemo(() => validateGamerName(gamerName), [gamerName]);

  useEffect(() => { void loadPlayerIdentity().then((identity) => { setGamerName(identity.gamerName); setAvatar(identity.avatar); }); }, []);
  const save = async () => {
    if (!validation.valid) return;
    setSaving(true);
    const result = await savePlayerIdentity({ version: 1, gamerName: validation.normalized, avatar });
    setSaving(false);
    if (result.ok) router.back();
    else Alert.alert("Profile not saved", result.error);
  };
  const large = preferences.largeText;

  return <SafeAreaView style={styles.screen}><ArcadeBackground reducedMotion={preferences.reducedMotion} />
    <View style={styles.header}><FireButton title="CANCEL" size="compact" variant="ghost" onPress={() => router.back()} /><View style={styles.headerCopy}><Text accessibilityRole="header" style={[styles.title, large && styles.largeTitle]}>AVATAR CREATOR</Text><Text style={styles.subtitle}>BUILD YOUR ARENA IDENTITY</Text></View></View>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <FirePanel accent="gold" elevated style={styles.previewPanel}><View style={styles.preview}><AvatarRenderer configuration={avatar} size={150} /><Text style={[styles.previewName, large && styles.largePreviewName]}>{validation.normalized || "YOUR GAMER NAME"}</Text><Text style={styles.previewRank}>FIRE FEAST CHALLENGER</Text></View></FirePanel>
      <FirePanel title="GAMER NAME" subtitle="3–20 characters · letters, numbers, spaces, underscores">
        <TextInput accessibilityLabel="Gamer name" autoCapitalize="words" maxLength={20} onChangeText={setGamerName} placeholder="Enter Gamer Name" placeholderTextColor="#76645B" style={[styles.input, large && styles.largeInput]} value={gamerName} />
        {!validation.valid ? <Text accessibilityRole="alert" style={styles.error}>{validation.error}</Text> : <Text style={styles.valid}>NAME AVAILABLE LOCALLY</Text>}
      </FirePanel>
      {categories.map(({ key, label }) => <FirePanel compact key={key} title={label}>
        <ScrollView horizontal contentContainerStyle={styles.optionRow} showsHorizontalScrollIndicator={false}>
          {AVATAR_OPTIONS[key].map((item) => {
            const selected = avatar[key] === item.id;
            return <Pressable accessibilityLabel={`${label}, ${item.label}`} accessibilityRole="button" accessibilityState={{ selected }} key={item.id} onPress={() => setAvatar((current) => ({ ...current, [key]: item.id }))} style={[styles.option, selected && styles.optionSelected]}>
              <Text style={[styles.optionPreview, item.color ? { color: item.color } : undefined]}>{item.preview}</Text><Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{item.label.toUpperCase()}</Text>
            </Pressable>;
          })}
        </ScrollView>
      </FirePanel>)}
      <FireButton disabled={!validation.valid} fullWidth loading={saving} title="SAVE PROFILE" variant="gold" onPress={() => { void save(); }} />
      <FireButton fullWidth title="RESET APPEARANCE" variant="secondary" onPress={() => setAvatar({ ...DEFAULT_AVATAR })} />
      <FireButton fullWidth title="CANCEL" variant="ghost" onPress={() => router.back()} />
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#070405", flex: 1 }, header: { alignItems: "center", alignSelf: "center", flexDirection: "row", maxWidth: 760, paddingHorizontal: 14, paddingTop: 4, width: "100%" }, headerCopy: { flex: 1, marginLeft: 12 },
  title: { color: "#FFD06A", fontSize: 25, fontWeight: "900", letterSpacing: 1 }, largeTitle: { fontSize: 29 }, subtitle: { color: "#B78D62", fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  content: { alignSelf: "center", gap: 10, maxWidth: 760, paddingBottom: 30, paddingHorizontal: 14, paddingTop: 8, width: "100%" }, previewPanel: { alignItems: "center" }, preview: { alignItems: "center" },
  previewName: { color: "#FFF0D8", fontSize: 24, fontWeight: "900", marginTop: 9 }, largePreviewName: { fontSize: 28 }, previewRank: { color: "#D29A52", fontSize: 9, fontWeight: "900", letterSpacing: 1, marginTop: 2 },
  input: { backgroundColor: "rgba(8,6,7,0.88)", borderColor: "#B9692D", borderRadius: 10, borderWidth: 1, color: "#FFF0D8", fontSize: 16, minHeight: 50, paddingHorizontal: 13 }, largeInput: { fontSize: 20, minHeight: 56 },
  error: { color: "#E78E7C", fontSize: 11, marginTop: 6 }, valid: { color: "#70CB8C", fontSize: 9, fontWeight: "900", marginTop: 6 },
  optionRow: { gap: 8, paddingVertical: 2 }, option: { alignItems: "center", backgroundColor: "rgba(34,22,19,0.94)", borderColor: "rgba(207,125,47,0.4)", borderRadius: 10, borderWidth: 1, justifyContent: "center", minHeight: 72, minWidth: 76, padding: 8 },
  optionSelected: { backgroundColor: "rgba(104,45,15,0.98)", borderColor: "#FFD06A", borderWidth: 2 }, optionPreview: { color: "#F0C282", fontSize: 22, fontWeight: "900" }, optionLabel: { color: "#A88D78", fontSize: 7, fontWeight: "900", marginTop: 6 }, optionLabelSelected: { color: "#FFF0D0" },
});
