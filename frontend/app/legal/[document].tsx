import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import FireButton from "../../src/components/fire/FireButton";
import FirePanel from "../../src/components/fire/FirePanel";
import ArcadeBackground from "../../src/game/ui/ArcadeBackground";
import { useAppPreferences } from "../../src/preferences/AppPreferences";

const documents = {
  privacy: { title: "PRIVACY POLICY", description: "The final Fire Feast privacy policy will be published here before public release." },
  terms: { title: "TERMS OF SERVICE", description: "The final Fire Feast terms of service will be published here before public release." },
  disclaimer: { title: "DISCLAIMER", description: "The final Fire Feast disclaimer will be published here before public release." },
} as const;

export default function LegalPlaceholderScreen() {
  const router = useRouter();
  const { preferences } = useAppPreferences();
  const { document } = useLocalSearchParams<{ document?: string | string[] }>();
  const key = (Array.isArray(document) ? document[0] : document) as keyof typeof documents;
  const content = documents[key] ?? documents.disclaimer;

  return <SafeAreaView style={styles.screen}>
    <ArcadeBackground />
    <View style={styles.header}><FireButton title="BACK" size="compact" variant="ghost" onPress={() => router.back()} /><Text accessibilityRole="header" style={[styles.title, preferences.largeText && styles.largeTitle]}>{content.title}</Text></View>
    <ScrollView contentContainerStyle={styles.content}>
      <FirePanel accent="gold" elevated>
        <Text style={styles.kicker}>BETA PLACEHOLDER</Text>
        <Text style={[styles.description, preferences.largeText && styles.largeDescription]}>{content.description}</Text>
        <View style={styles.rule} />
        <Text style={styles.sectionTitle}>DOCUMENT STATUS</Text>
        <Text style={[styles.note, preferences.largeText && styles.largeNote]}>Final copy is pending legal review. This screen will preserve the same readable, scrollable layout when approved text is added.</Text>
        <View style={styles.rule} />
        <Text style={styles.sectionTitle}>BETA CONTACT</Text>
        <Text style={[styles.note, preferences.largeText && styles.largeNote]}>Questions about this document can be sent through Contact Support in Settings.</Text>
      </FirePanel>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#070405", flex: 1 },
  header: { alignItems: "center", alignSelf: "center", flexDirection: "row", maxWidth: 760, paddingHorizontal: 14, paddingTop: 4, width: "100%" },
  title: { color: "#FFD06A", flex: 1, fontSize: 22, fontWeight: "900", letterSpacing: 1, marginLeft: 12 },
  largeTitle: { fontSize: 26 },
  content: { alignSelf: "center", flexGrow: 1, maxWidth: 760, paddingBottom: 32, paddingHorizontal: 16, paddingTop: 12, width: "100%" },
  kicker: { color: "#F0A84E", fontSize: 10, fontWeight: "900", letterSpacing: 1.5 },
  description: { color: "#FFF0D8", fontSize: 17, lineHeight: 26, marginTop: 14 },
  largeDescription: { fontSize: 21, lineHeight: 31 },
  rule: { backgroundColor: "rgba(238,155,65,0.34)", height: 1, marginVertical: 20 },
  sectionTitle: { color: "#E5AD63", fontSize: 10, fontWeight: "900", letterSpacing: 1.2, marginBottom: 7 },
  note: { color: "#BCA591", fontSize: 14, lineHeight: 22 },
  largeNote: { fontSize: 18, lineHeight: 27 },
});
