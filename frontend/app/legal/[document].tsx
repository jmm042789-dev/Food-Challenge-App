import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import FireButton from "../../src/components/fire/FireButton";
import FirePanel from "../../src/components/fire/FirePanel";
import ArcadeBackground from "../../src/game/ui/ArcadeBackground";
import { useAppPreferences } from "../../src/preferences/AppPreferences";
import MarkdownDocument from "../../src/legal/MarkdownDocument";
import { LEGAL_DOCUMENTS, type LegalDocumentKey } from "../../src/legal/generatedLegalDocuments";

const documents = {
  privacy: { title: "PRIVACY POLICY", markdown: LEGAL_DOCUMENTS.privacy },
  terms: { title: "TERMS OF SERVICE", markdown: LEGAL_DOCUMENTS.terms },
  disclaimer: { title: "GAMEPLAY & HEALTH DISCLAIMER", markdown: LEGAL_DOCUMENTS.disclaimer },
} as const;

export default function LegalDocumentScreen() {
  const router = useRouter();
  const { preferences } = useAppPreferences();
  const { document } = useLocalSearchParams<{ document?: string | string[] }>();
  const requestedKey = Array.isArray(document) ? document[0] : document;
  const key: LegalDocumentKey = requestedKey === "privacy" || requestedKey === "terms" || requestedKey === "disclaimer"
    ? requestedKey
    : "disclaimer";
  const content = documents[key] ?? documents.disclaimer;

  return <SafeAreaView style={styles.screen}>
    <ArcadeBackground />
    <View style={styles.header}><FireButton title="BACK" size="compact" variant="ghost" onPress={() => router.back()} /><Text accessibilityRole="header" style={[styles.title, preferences.largeText && styles.largeTitle]}>{content.title}</Text></View>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <FirePanel accent="gold" elevated>
        <MarkdownDocument markdown={content.markdown} largeText={preferences.largeText} />
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
});
