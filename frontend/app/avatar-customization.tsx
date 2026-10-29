import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type GestureResponderEvent } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import ArcadeBackground from "../src/game/ui/ArcadeBackground";
import FireButton from "../src/components/fire/FireButton";
import FirePanel from "../src/components/fire/FirePanel";
import AvatarRenderer from "../src/profile/AvatarRenderer";
import { AVATAR_OPTIONS, AVATAR_PRESETS, DEFAULT_AVATAR, PRESENTATION_OPTIONS, clampAvatarSlider, hairColorLabel, resolveHairColor, resolveSkinTone, skinToneLabel, updateAvatarDraft, validateGamerName, type AvatarCategory, type AvatarConfiguration } from "../src/profile/PlayerIdentity";
import { usePlayerIdentity } from "../src/profile/PlayerIdentityContext";
import { useAppPreferences } from "../src/preferences/AppPreferences";

const categories: readonly { key: AvatarCategory; label: string }[] = [
  { key: "base", label: "FACE SHAPE" }, { key: "hair", label: "HAIR STYLE" }, { key: "eyes", label: "EYES" }, { key: "facialHair", label: "FACIAL HAIR" },
  { key: "glasses", label: "GLASSES" }, { key: "headwear", label: "HEADWEAR" }, { key: "clothing", label: "OUTFIT STYLE" }, { key: "apron", label: "APRON STYLE" }, { key: "outfitColor", label: "OUTFIT COLOR" },
  { key: "accessory", label: "ACCESSORIES" }, { key: "background", label: "BACKGROUND / FRAME" },
];

function ValueSlider({ label, value, color, valueLabel, onChange }: { label: string; value: number; color: string; valueLabel: string; onChange: (value: number) => void }) {
  const [width, setWidth] = useState(1);
  const update = (event: GestureResponderEvent) => onChange(clampAvatarSlider(event.nativeEvent.locationX / width * 100, value));
  return <View><View style={styles.sliderHeading}><Text style={styles.sliderLabel}>{valueLabel.toUpperCase()}</Text><Text style={styles.sliderValue}>{value}%</Text></View><View accessible accessibilityActions={[{ name: "increment" }, { name: "decrement" }]} accessibilityLabel={`${label}, ${valueLabel}, ${value} percent`} accessibilityRole="adjustable" accessibilityValue={{ min: 0, max: 100, now: value, text: valueLabel }} onAccessibilityAction={(event) => onChange(clampAvatarSlider(value + (event.nativeEvent.actionName === "increment" ? 5 : -5), value))} onLayout={(event) => setWidth(Math.max(1, event.nativeEvent.layout.width))} onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true} onResponderGrant={update} onResponderMove={update} style={styles.sliderTrack}><View style={[styles.sliderFill, { backgroundColor: color, width: `${value}%` }]} /><View style={[styles.sliderThumb, { backgroundColor: color, left: `${value}%` }]} /></View></View>;
}

export default function AvatarCustomizationScreen() {
  const router = useRouter();
  const { preferences } = useAppPreferences();
  const { identity, hydrated, saveIdentity } = usePlayerIdentity();
  const [gamerName, setGamerName] = useState("Hungry Hero");
  const [avatar, setAvatar] = useState<AvatarConfiguration>(DEFAULT_AVATAR);
  const [saving, setSaving] = useState(false);
  const validation = useMemo(() => validateGamerName(gamerName), [gamerName]);

  useEffect(() => {
    if (!identity) return;
    setGamerName(identity.gamerName);
    setAvatar(identity.avatar);
  }, [identity]);
  const save = async () => {
    if (!validation.valid) return;
    setSaving(true);
    const result = await saveIdentity({ version: 4, gamerName: validation.normalized, avatar });
    setSaving(false);
    if (result.ok) router.back();
    else Alert.alert("Profile not saved", result.error);
  };
  const large = preferences.largeText;

  if (!hydrated) return <SafeAreaView style={styles.screen}><ArcadeBackground reducedMotion={preferences.reducedMotion} /></SafeAreaView>;
  return <SafeAreaView style={styles.screen}><ArcadeBackground reducedMotion={preferences.reducedMotion} />
    <View style={styles.header}><FireButton title="CANCEL" size="compact" variant="ghost" onPress={() => router.back()} /><View style={styles.headerCopy}><Text accessibilityRole="header" style={[styles.title, large && styles.largeTitle]}>AVATAR CREATOR</Text><Text style={styles.subtitle}>BUILD YOUR ARENA IDENTITY</Text></View></View>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <FirePanel accent="gold" elevated style={styles.previewPanel}><View style={styles.preview}><Text style={styles.previewEyebrow}>LIVE ARENA PREVIEW</Text><AvatarRenderer configuration={avatar} size={176} /><Text style={[styles.previewName, large && styles.largePreviewName]}>{validation.normalized || "YOUR GAMER NAME"}</Text><Text style={styles.previewRank}>FIRE FEAST CHALLENGER</Text></View></FirePanel>
      <FirePanel title="GAMER NAME" subtitle="3–20 characters · letters, numbers, spaces, underscores">
        <TextInput accessibilityLabel="Gamer name" autoCapitalize="words" maxLength={20} onChangeText={setGamerName} placeholder="Enter Gamer Name" placeholderTextColor="#76645B" style={[styles.input, large && styles.largeInput]} value={gamerName} />
        {!validation.valid ? <Text accessibilityRole="alert" style={styles.error}>{validation.error}</Text> : <Text style={styles.valid}>NAME AVAILABLE LOCALLY</Text>}
      </FirePanel>
      <FirePanel compact title="COMPETITOR PRESETS" subtitle="Start strong, then make it yours">
        <ScrollView horizontal contentContainerStyle={styles.presetRow} showsHorizontalScrollIndicator={false}>
          {AVATAR_PRESETS.map((item) => <Pressable accessibilityLabel={`Apply ${item.name} preset`} accessibilityHint={item.tagline} accessibilityRole="button" key={item.id} onPress={() => setAvatar({ ...item.avatar })} style={styles.preset}>
            <AvatarRenderer configuration={item.avatar} size={64} /><View style={styles.presetCopy}><Text style={styles.presetName}>{item.name.toUpperCase()}</Text><Text numberOfLines={2} style={styles.presetTagline}>{item.tagline}</Text></View>
          </Pressable>)}
        </ScrollView>
      </FirePanel>
      <FirePanel compact title="PRESENTATION" subtitle="A visual style only; every option below stays available">
        <View style={styles.presentationRow}>{PRESENTATION_OPTIONS.map((item) => <Pressable accessibilityLabel={`${item.label} presentation`} accessibilityRole="button" accessibilityState={{ selected: avatar.presentation === item.id }} key={item.id} onPress={() => setAvatar((current) => ({ ...current, presentation: item.id }))} style={[styles.presentationOption, avatar.presentation === item.id && styles.optionSelected]}><Text style={[styles.presentationLabel, avatar.presentation === item.id && styles.optionLabelSelected]}>{item.label.toUpperCase()}</Text>{avatar.presentation === item.id ? <Text style={styles.selectedMark}>SELECTED</Text> : null}</Pressable>)}</View>
      </FirePanel>
      <FirePanel compact title="SKIN TONE" subtitle="Curated natural tone range">
        <ValueSlider label="Skin tone" value={avatar.skinToneValue} color={resolveSkinTone(avatar.skinToneValue)} valueLabel={skinToneLabel(avatar.skinToneValue)} onChange={(skinToneValue) => setAvatar((current) => ({ ...current, skinToneValue }))} />
      </FirePanel>
      <FirePanel compact title="HAIR COLOR" subtitle="Natural and Fire Feast colors">
        <ValueSlider label="Hair color" value={avatar.hairColorValue} color={resolveHairColor(avatar.hairColorValue).color} valueLabel={hairColorLabel(avatar.hairColorValue)} onChange={(hairColorValue) => setAvatar((current) => ({ ...current, hairColorValue }))} />
      </FirePanel>
      {categories.map(({ key, label }) => <FirePanel compact key={key} title={label}>
        <ScrollView horizontal contentContainerStyle={styles.optionRow} showsHorizontalScrollIndicator={false}>
          {AVATAR_OPTIONS[key].map((item) => {
            const selected = avatar[key] === item.id;
            return <Pressable accessibilityLabel={`${label}, ${item.label}`} accessibilityRole="button" accessibilityState={{ selected }} key={item.id} onPress={() => setAvatar((current) => updateAvatarDraft(current, key, item.id))} style={[styles.option, selected && styles.optionSelected]}>
              {item.color ? <View style={[styles.colorPreview, { backgroundColor: item.color, borderColor: item.secondaryColor ?? "#E8A54A" }]} /> : <Text style={[styles.optionPreview, key === "hair" || key === "clothing" || key === "headwear" ? styles.wordPreview : undefined]}>{item.preview}</Text>}<Text numberOfLines={2} style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{item.label.toUpperCase()}</Text>{selected ? <Text style={styles.selectedMark}>SELECTED</Text> : null}
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
  content: { alignSelf: "center", gap: 10, maxWidth: 760, paddingBottom: 30, paddingHorizontal: 14, paddingTop: 8, width: "100%" }, previewPanel: { alignItems: "center" }, preview: { alignItems: "center" }, previewEyebrow: { color: "#D69B50", fontSize: 8, fontWeight: "900", letterSpacing: 1.6, marginBottom: 8 },
  previewName: { color: "#FFF0D8", fontSize: 24, fontWeight: "900", marginTop: 9 }, largePreviewName: { fontSize: 28 }, previewRank: { color: "#D29A52", fontSize: 9, fontWeight: "900", letterSpacing: 1, marginTop: 2 },
  input: { backgroundColor: "rgba(8,6,7,0.88)", borderColor: "#B9692D", borderRadius: 10, borderWidth: 1, color: "#FFF0D8", fontSize: 16, minHeight: 50, paddingHorizontal: 13 }, largeInput: { fontSize: 20, minHeight: 56 },
  error: { color: "#E78E7C", fontSize: 11, marginTop: 6 }, valid: { color: "#70CB8C", fontSize: 9, fontWeight: "900", marginTop: 6 },
  presetRow: { gap: 8, paddingVertical: 2 }, preset: { alignItems: "center", backgroundColor: "rgba(31,19,18,0.96)", borderColor: "rgba(229,151,60,0.48)", borderRadius: 12, borderWidth: 1, flexDirection: "row", minHeight: 84, padding: 9, width: 190 }, presetCopy: { flex: 1, marginLeft: 9 }, presetName: { color: "#FFD06A", fontSize: 10, fontWeight: "900" }, presetTagline: { color: "#A9917D", fontSize: 8, lineHeight: 11, marginTop: 3 },
  optionRow: { gap: 8, paddingVertical: 2 }, option: { alignItems: "center", backgroundColor: "rgba(34,22,19,0.94)", borderColor: "rgba(207,125,47,0.4)", borderRadius: 10, borderWidth: 1, justifyContent: "center", minHeight: 82, minWidth: 84, padding: 8 },
  optionSelected: { backgroundColor: "rgba(104,45,15,0.98)", borderColor: "#FFD06A", borderWidth: 2 }, optionPreview: { color: "#F0C282", fontSize: 22, fontWeight: "900" }, wordPreview: { fontSize: 9, letterSpacing: 0.5 }, colorPreview: { borderRadius: 18, borderWidth: 3, height: 34, width: 34 }, optionLabel: { color: "#A88D78", fontSize: 7, fontWeight: "900", marginTop: 6, maxWidth: 70, textAlign: "center" }, optionLabelSelected: { color: "#FFF0D0" }, selectedMark: { color: "#FFD06A", fontSize: 6, fontWeight: "900", marginTop: 3 },
  presentationRow: { flexDirection: "row", gap: 8 }, presentationOption: { alignItems: "center", backgroundColor: "rgba(34,22,19,0.94)", borderColor: "rgba(207,125,47,0.4)", borderRadius: 10, borderWidth: 1, flex: 1, justifyContent: "center", minHeight: 52, padding: 8 }, presentationLabel: { color: "#B9A18D", fontSize: 10, fontWeight: "900", textAlign: "center" },
  sliderHeading: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }, sliderLabel: { color: "#FFF0D8", fontSize: 11, fontWeight: "900" }, sliderValue: { color: "#FFD06A", fontSize: 11, fontWeight: "900" }, sliderTrack: { backgroundColor: "#33221D", borderColor: "#82502B", borderRadius: 14, borderWidth: 1, height: 30, justifyContent: "center", marginBottom: 4, overflow: "visible" }, sliderFill: { borderRadius: 12, height: 12, marginLeft: 8, maxWidth: "96%" }, sliderThumb: { borderColor: "#FFF0D8", borderRadius: 14, borderWidth: 3, height: 28, marginLeft: -14, position: "absolute", width: 28 },
});
