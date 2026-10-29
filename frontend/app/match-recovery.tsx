import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { api } from "../src/api";
import FireButton from "../src/components/fire/FireButton";
import { resultRecoveryMessage, type OfficialResult, type PendingResult } from "../src/game/pendingResult";

export default function MatchRecovery() {
  const router = useRouter();
  const [pending, setPending] = useState<PendingResult | null>(null);
  const [official, setOfficial] = useState<OfficialResult | null>(null);
  const [message, setMessage] = useState("Restoring your player and saved result...");
  const [busy, setBusy] = useState(false);
  const [terminal, setTerminal] = useState(false);
  const [unresolved, setUnresolved] = useState(false);
  const generation = useRef(0);
  const inFlight = useRef(false);
  const abort = useRef<AbortController | null>(null);
  const recover = async (submit: boolean) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setMessage("Checking official result...");
    const attempt = generation.current;
    const current = () => attempt === generation.current;
    const controller = new AbortController();
    abort.current = controller;
    try {
      await api.getPlayer();
      if (!current()) return;
      const result = await api.recoverPendingResult(controller.signal, submit);
      if (!current()) return;
      setUnresolved(result?.status === "UNRESOLVED");
      if (!result) {
        setPending(null);
        setMessage("No pending completed result was found.");
      } else if (result.status === "SETTLED") {
        setOfficial(result.result);
        setPending(null);
        setMessage("Official result confirmed. Rewards are credited by the server only.");
      } else if (result.status === "TERMINAL_NO_REWARD") {
        setTerminal(true);
        setPending(null);
        setMessage(result.receipt.outcome === "expired" ? "Match expired without rewards. A diagnostic receipt is saved on this device. You can return to contests." : "Match rejected without rewards. A diagnostic receipt is saved on this device. You can return to contests.");
      } else {
        const pendingRecord = await api.pendingResult();
        if (!current()) return;
        setPending(pendingRecord);
        setMessage("Result still unresolved. Your exact saved result remains protected. Retry verification or explicitly retry submission; no new match or entry fee will be created.");
      }
    } catch (error) {
      if (current()) setUnresolved(true);
      if (current()) setMessage(error && typeof error === "object" && "code" in error
        ? resultRecoveryMessage(error) : "Network verification unavailable. Saved evidence remains protected. Please retry.");
    } finally {
      if (current()) { inFlight.current = false; setBusy(false); }
    }
  };
  useEffect(() => {
    inFlight.current = false;
    void recover(false);
    return () => { generation.current += 1; abort.current?.abort(); };
    // Initial authentication/read is performed once per mount; retry is explicit.
  }, []);
  return <View style={styles.screen}>
    <Text accessibilityRole="header" style={styles.title}>MATCH RESULT RECOVERY</Text>
    <Text accessibilityRole="alert" style={styles.text}>{message}</Text>
    {pending ? <Text style={styles.text}>Contest: {pending.contest_id}</Text> : null}
    {official ? <Text style={styles.text}>Result: {official.authoritative_outcome}. Official score: {official.accepted_score}. Coins: {official.coin_reward}. XP: {official.xp_reward}.</Text> : null}
    {!official && !terminal ? <FireButton title="RETRY VERIFICATION" accessibilityLabel="Check official saved match receipt" disabled={busy} loading={busy} onPress={() => { void recover(false); }} /> : null}
    {!official && !terminal && unresolved ? <FireButton title="RETRY SAVED SUBMISSION" accessibilityLabel="Retry the exact saved result without a new entry fee" disabled={busy} onPress={() => { void recover(true); }} /> : null}
    <FireButton title="RETURN TO ARENA" disabled={busy} variant="secondary" onPress={() => router.replace("/(tabs)/contests")} />
    <Text style={styles.text}>Unresolved results remain saved. A new match cannot replace them. Do not clear app data.</Text>
  </View>;
}
const styles = StyleSheet.create({
  screen: {flex:1,justifyContent:"center",padding:24,gap:18,backgroundColor:"#160E0B"},
  title:{color:"#FFFFFF",fontSize:22,fontWeight:"700"},
  text:{color:"#FFFFFF",fontSize:16},
});
