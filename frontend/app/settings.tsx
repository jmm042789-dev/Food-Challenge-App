import React, { useCallback, useEffect, useState } from "react";
import { Alert, Linking, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import ArcadeBackground from "../src/game/ui/ArcadeBackground";
import FireButton from "../src/components/fire/FireButton";
import FirePanel from "../src/components/fire/FirePanel";
import { loadAudioSettings } from "../src/audio/AudioSettings";
import { updateAudioSettings } from "../src/audio/AdaptiveAudioManager";
import type { AudioSettings } from "../src/audio/AudioTypes";
import { useAppPreferences, type AppPreferences } from "../src/preferences/AppPreferences";

const SUPPORT_EMAIL = "support@firefeast.app";
const version = Constants.expoConfig?.version ?? "1.0.0";
const build = String(Constants.expoConfig?.ios?.buildNumber ?? Constants.expoConfig?.android?.versionCode ?? "1");

function SettingRow({ title, detail, children, largeText = false }: { title: string; detail?: string; children: React.ReactNode; largeText?: boolean }) {
  return <View style={styles.row}><View style={styles.rowCopy}><Text style={[styles.rowTitle, largeText && styles.largeRowTitle]}>{title}</Text>{detail ? <Text style={[styles.rowDetail, largeText && styles.largeRowDetail]}>{detail}</Text> : null}</View>{children}</View>;
}

function Toggle({ label, value, disabled = false, onValueChange }: { label: string; value: boolean; disabled?: boolean; onValueChange: (value: boolean) => void }) {
  return <Switch accessibilityLabel={label} disabled={disabled} onValueChange={onValueChange} trackColor={{ false: "#493B36", true: "#A84B18" }} thumbColor={disabled ? "#71645E" : value ? "#FFD06A" : "#C0AAA0"} value={value} />;
}

function VolumeControl({ label, value, disabled, onChange }: { label: string; value: number; disabled: boolean; onChange: (value: number) => void }) {
  const percentage = Math.round(value * 100);
  return <View accessible accessibilityLabel={`${label}, ${percentage} percent`} style={styles.volume}>
    <FireButton accessibilityLabel={`Decrease ${label}`} disabled={disabled || value <= 0} haptic={false} onPress={() => onChange(Math.max(0, value - 0.1))} size="compact" title="−" variant="ghost" />
    <View style={styles.volumeReadout}><View style={styles.volumeTrack}><View style={[styles.volumeFill, { width: `${percentage}%` }]} /></View><Text style={styles.volumeValue}>{percentage}%</Text></View>
    <FireButton accessibilityLabel={`Increase ${label}`} disabled={disabled || value >= 1} haptic={false} onPress={() => onChange(Math.min(1, value + 0.1))} size="compact" title="+" variant="ghost" />
  </View>;
}

export default function SettingsScreen() {
  const router = useRouter();
  const { preferences, updatePreferences } = useAppPreferences();
  const [audio, setAudio] = useState<AudioSettings | null>(null);

  useEffect(() => { void loadAudioSettings().then(setAudio); }, []);
  const changeAudio = useCallback(async (update: Partial<AudioSettings>) => {
    const next = await updateAudioSettings(update);
    setAudio(next);
  }, []);
  const changePreference = useCallback((update: Partial<AppPreferences>) => { void updatePreferences(update); }, [updatePreferences]);
  const contact = useCallback((subject: string) => {
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
    Linking.openURL(url).catch(() => Alert.alert("Email unavailable", `Contact us at ${SUPPORT_EMAIL}.`));
  }, []);

  const large = preferences.largeText;
  return <SafeAreaView style={styles.screen}>
    <ArcadeBackground />
    <View style={styles.header}><FireButton title="BACK" size="compact" variant="ghost" onPress={() => router.back()} /><View style={styles.headerCopy}><Text accessibilityRole="header" style={[styles.title, large && styles.largeTitle]}>SETTINGS</Text><Text style={styles.subtitle}>TUNE YOUR FIRE FEAST EXPERIENCE</Text></View></View>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <FirePanel title="AUDIO" subtitle="Independent controls for music and effects." elevated>
        {audio ? <>
          <SettingRow title="Master Volume" largeText={large}><VolumeControl label="master volume" value={audio.master} disabled={audio.muted} onChange={(master) => { void changeAudio({ master }); }} /></SettingRow>
          <SettingRow title="Music Volume" largeText={large}><VolumeControl label="music volume" value={audio.music} disabled={audio.muted} onChange={(music) => { void changeAudio({ music }); }} /></SettingRow>
          <SettingRow title="Sound Effects Volume" largeText={large}><VolumeControl label="sound effects volume" value={audio.soundEffects} disabled={audio.muted} onChange={(soundEffects) => { void changeAudio({ soundEffects }); }} /></SettingRow>
          <SettingRow title="Mute All" detail="Silence music and sound effects." largeText={large}><Toggle label="Mute all audio" value={audio.muted} onValueChange={(muted) => { void changeAudio({ muted }); }} /></SettingRow>
        </> : <Text style={styles.loading}>LOADING AUDIO SETTINGS…</Text>}
      </FirePanel>

      <FirePanel title="GAMEPLAY" subtitle="Comfort and feedback controls." elevated>
        <SettingRow title="Haptics" detail="Vibration feedback for buttons and matches." largeText={large}><Toggle label="Haptics" value={preferences.hapticsEnabled} onValueChange={(hapticsEnabled) => changePreference({ hapticsEnabled })} /></SettingRow>
        <SettingRow title="Reduced Motion" detail="Minimizes animated movement and camera motion." largeText={large}><Toggle label="Reduced Motion" value={preferences.reducedMotion} onValueChange={(reducedMotion) => changePreference({ reducedMotion })} /></SettingRow>
        <SettingRow title="Camera Effects" detail="Arcade punches, breathing, and cinematic framing." largeText={large}><Toggle label="Camera Effects" value={preferences.cameraEffectsEnabled} onValueChange={(cameraEffectsEnabled) => changePreference({ cameraEffectsEnabled })} /></SettingRow>
        <FireButton fullWidth title="REPLAY TUTORIAL" variant="secondary" onPress={() => router.push({ pathname: "/tutorial", params: { replay: "1" } })} />
      </FirePanel>

      <FirePanel title="DISPLAY" subtitle="Readability preferences." elevated>
        <SettingRow title="Large Text" detail="Increases text size in supported menus." largeText={large}><Toggle label="Large Text" value={large} onValueChange={(largeText) => changePreference({ largeText })} /></SettingRow>
        <SettingRow title="High Contrast Mode" detail="Coming in a future beta update." largeText={large}><Toggle disabled label="High Contrast Mode, unavailable" value={false} onValueChange={() => {}} /></SettingRow>
      </FirePanel>

      <FirePanel title="SUPPORT" subtitle={`Beta support · ${SUPPORT_EMAIL}`} elevated>
        <FireButton fullWidth title="PRIVACY POLICY" variant="ghost" onPress={() => router.push({ pathname: "/legal/[document]", params: { document: "privacy" } })} />
        <FireButton fullWidth title="TERMS OF SERVICE" variant="ghost" onPress={() => router.push({ pathname: "/legal/[document]", params: { document: "terms" } })} />
        <FireButton fullWidth title="DISCLAIMER" variant="ghost" onPress={() => router.push({ pathname: "/legal/[document]", params: { document: "disclaimer" } })} />
        <FireButton fullWidth title="CONTACT SUPPORT" variant="secondary" onPress={() => contact("Fire Feast Support")} />
        <FireButton fullWidth title="REPORT A BUG" variant="secondary" onPress={() => contact("Fire Feast Beta Bug Report")} />
      </FirePanel>

      <FirePanel title="ABOUT" subtitle="Fire Feast Closed Beta" elevated>
        <SettingRow title="Game Version" largeText={large}><Text style={styles.aboutValue}>{version}</Text></SettingRow>
        <SettingRow title="Build Number" largeText={large}><Text style={styles.aboutValue}>{build}</Text></SettingRow>
        <SettingRow title="Credits" detail="Game design, engineering, art direction, and beta operations." largeText={large}><Text style={styles.aboutValue}>FIRE FEAST TEAM</Text></SettingRow>
      </FirePanel>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#070405", flex: 1 },
  header: { alignItems: "center", alignSelf: "center", flexDirection: "row", maxWidth: 760, paddingHorizontal: 14, paddingTop: 4, width: "100%" },
  headerCopy: { flex: 1, marginLeft: 12 },
  title: { color: "#FFD06A", fontSize: 28, fontWeight: "900", letterSpacing: 1.5 },
  largeTitle: { fontSize: 32 },
  subtitle: { color: "#B68C61", fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  content: { alignSelf: "center", gap: 12, maxWidth: 760, paddingBottom: 28, paddingHorizontal: 14, paddingTop: 8, width: "100%" },
  row: { alignItems: "center", borderBottomColor: "rgba(225,145,63,0.18)", borderBottomWidth: 1, flexDirection: "row", flexWrap: "wrap", minHeight: 58, paddingVertical: 7 },
  rowCopy: { flex: 1, flexBasis: 120, minWidth: 110, paddingRight: 10 },
  rowTitle: { color: "#FFF0D8", fontSize: 15, fontWeight: "900" },
  largeRowTitle: { fontSize: 18 },
  rowDetail: { color: "#AE9785", fontSize: 11, lineHeight: 15, marginTop: 3 },
  largeRowDetail: { fontSize: 14, lineHeight: 19 },
  volume: { alignItems: "center", flexDirection: "row", flexGrow: 1, justifyContent: "flex-end", minWidth: 170, width: 176 },
  volumeReadout: { alignItems: "center", flex: 1, marginHorizontal: 5 },
  volumeTrack: { backgroundColor: "#35241F", borderRadius: 4, height: 7, overflow: "hidden", width: "100%" },
  volumeFill: { backgroundColor: "#F29A38", height: "100%" },
  volumeValue: { color: "#FFDCA0", fontSize: 10, fontWeight: "900", marginTop: 3 },
  loading: { color: "#C7AA87", paddingVertical: 18, textAlign: "center" },
  aboutValue: { color: "#FFD06A", fontSize: 12, fontWeight: "900" },
});
