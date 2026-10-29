import { useCallback, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { api, ApiRequestError } from "../src/api";
import ArcadeBackground from "../src/game/ui/ArcadeBackground";
import FireButton from "../src/components/fire/FireButton";
import FirePanel from "../src/components/fire/FirePanel";

type Notice = { kind: "success" | "error"; title: string; message: string };

function promotionError(error: unknown): Notice {
  if (error instanceof ApiRequestError) {
    if (error.code === "PROMO_INVALID") return { kind: "error", title: "CODE NOT FOUND", message: "Check the code printed on your Cruise Duck tag and try again." };
    if (error.code === "PROMO_ALREADY_REDEEMED") return { kind: "error", title: "ALREADY REDEEMED", message: "That Cruise Duck bonus has already been claimed." };
    if (error.code === "PROMO_PLAYER_LIMIT") return { kind: "error", title: "BONUS ALREADY CLAIMED", message: "This player has already claimed a Cruise Duck bonus." };
    if (error.code === "PROMO_DISABLED") return { kind: "error", title: "CAMPAIGN UNAVAILABLE", message: "Cruise Duck redemption is not available right now." };
  }
  return { kind: "error", title: "COULD NOT REDEEM", message: "Fire Feast could not reach the game server. Your code was not lost—check your connection and retry." };
}

export default function PromotionsScreen() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const inFlight = useRef(false);
  const normalized = code.trim().toUpperCase().replace(/\s+/g, "");

  const redeem = useCallback(async () => {
    if (inFlight.current || normalized.length < 12) return;
    inFlight.current = true;
    setBusy(true);
    setNotice(null);
    try {
      const result = await api.redeemPromotionCode(normalized);
      setNotice({
        kind: "success",
        title: result.status === "ALREADY_REDEEMED" ? "BONUS CONFIRMED" : "DUCK BONUS CLAIMED!",
        message: `Cruise Duck #${result.duck_number} added ${result.reward.value.toLocaleString()} coins. Your balance is ${result.new_coins.toLocaleString()}.`,
      });
      setCode("");
    } catch (error) {
      setNotice(promotionError(error));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [normalized]);

  return <SafeAreaView style={styles.screen}>
    <ArcadeBackground />
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.fill}>
      <View style={styles.header}><FireButton title="BACK" size="compact" variant="ghost" onPress={() => router.back()} /><View><Text accessibilityRole="header" style={styles.title}>PROMOTIONS</Text><Text style={styles.subtitle}>CRUISE DUCK COLLECTION</Text></View></View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <FirePanel accent="gold" elevated title="YOU FOUND A FIRE FEAST DUCK!" subtitle="One unique tag · one server-verified bonus">
          <Text style={styles.duck} accessibilityElementsHidden>🦆</Text>
          <Text style={styles.copy}>Enter the opaque bonus code printed on the tag after installing or joining Fire Feast. The duck number by itself is not a reward code.</Text>
          <TextInput
            accessibilityLabel="Cruise Duck bonus code"
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!busy}
            maxLength={40}
            onChangeText={(value) => { setCode(value); if (notice?.kind === "error") setNotice(null); }}
            placeholder="XXXX-XXXX-XXXX-XXXX"
            placeholderTextColor="#806B5B"
            returnKeyType="done"
            style={styles.input}
            value={code}
            onSubmitEditing={() => { void redeem(); }}
          />
          <FireButton accessibilityHint="Claims this one-use code for the authenticated player" disabled={normalized.length < 12} fullWidth loading={busy} title="REDEEM DUCK BONUS" variant="gold" onPress={() => { void redeem(); }} />
          {notice ? <View accessibilityRole="alert" style={[styles.notice, notice.kind === "success" ? styles.success : styles.error]}><Text style={styles.noticeTitle}>{notice.title}</Text><Text style={styles.noticeCopy}>{notice.message}</Text>{notice.kind === "error" ? <FireButton fullWidth title="RETRY" size="compact" variant="secondary" disabled={normalized.length < 12} onPress={() => { void redeem(); }} /> : null}</View> : null}
        </FirePanel>
        <FirePanel title="KEEP IT CRUISING" subtitle="A fun cruise tradition">
          <Text style={styles.copy}>Keep your duck or hide it again for another traveler. Each physical duck bonus can be redeemed only once globally, and each player can claim one bonus from this campaign.</Text>
        </FirePanel>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#070405", flex: 1 }, fill: { flex: 1 }, header: { alignItems: "center", alignSelf: "center", flexDirection: "row", gap: 12, maxWidth: 620, paddingHorizontal: 14, paddingTop: 4, width: "100%" }, title: { color: "#FFD06A", fontSize: 26, fontWeight: "900", letterSpacing: 1.2 }, subtitle: { color: "#B68C61", fontSize: 9, fontWeight: "900", letterSpacing: 1 }, content: { alignSelf: "center", gap: 12, maxWidth: 620, paddingBottom: 30, paddingHorizontal: 14, paddingTop: 8, width: "100%" }, duck: { fontSize: 58, marginVertical: 6, textAlign: "center" }, copy: { color: "#D2BCA4", fontSize: 14, lineHeight: 21, textAlign: "center" }, input: { backgroundColor: "#100B0A", borderColor: "#B86C28", borderRadius: 12, borderWidth: 1, color: "#FFF4DF", fontSize: 17, fontWeight: "900", letterSpacing: 1.5, marginTop: 14, minHeight: 54, paddingHorizontal: 14, textAlign: "center" }, notice: { borderRadius: 12, borderWidth: 1, marginTop: 10, padding: 13 }, success: { backgroundColor: "rgba(37,92,54,0.35)", borderColor: "#6FC48A" }, error: { backgroundColor: "rgba(111,39,29,0.35)", borderColor: "#D97766" }, noticeTitle: { color: "#FFF0D8", fontSize: 15, fontWeight: "900", textAlign: "center" }, noticeCopy: { color: "#D5C3B0", fontSize: 12, lineHeight: 18, marginTop: 4, textAlign: "center" },
});
