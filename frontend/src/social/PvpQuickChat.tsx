import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { api } from "../api";
import FireButton from "../components/fire/FireButton";
import type { PvpMatchStatus, PvpQuipCategory, PvpQuipEvent } from "./types";

const MUTE_KEY = "fire_feast_pvp_quips_muted_v1";
const POLL_MS = 5000;
const BUBBLE_MS = 1800;

export default function PvpQuickChat({ matchId, category, status, compact = false, suppressed = false, onStatus }: { matchId: string; category: PvpQuipCategory; status: PvpMatchStatus; compact?: boolean; suppressed?: boolean; onStatus?: (value: PvpMatchStatus) => void }) {
  const [muted, setMuted] = useState(false); const [open, setOpen] = useState(false); const [bubble, setBubble] = useState<PvpQuipEvent | null>(null); const [cooling, setCooling] = useState(false);
  const seen = useRef(new Set<string>()); const mounted = useRef(true); const sending = useRef(false); const generation = useRef(0); const bubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null); const cooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const consume = useCallback((value: PvpMatchStatus, applyStatus = false) => {
    if (applyStatus) onStatus?.(value);
    const incoming = value.quip_events.filter((event) => event.sender_public_id === value.opponent.public_id && event.category === category && !seen.current.has(event.event_id));
    for (const event of incoming) seen.current.add(event.event_id);
    const newest = incoming.at(-1);
    if (!muted && !suppressed && newest) { setBubble(newest); if (bubbleTimer.current) clearTimeout(bubbleTimer.current); bubbleTimer.current = setTimeout(() => setBubble(null), BUBBLE_MS); }
  }, [category, muted, onStatus, suppressed]);
  useEffect(() => { mounted.current = true; void AsyncStorage.getItem(MUTE_KEY).then((value) => { if (mounted.current) setMuted(value === "1"); }); return () => { mounted.current = false; generation.current += 1; if (bubbleTimer.current) clearTimeout(bubbleTimer.current); if (cooldownTimer.current) clearTimeout(cooldownTimer.current); }; }, []);
  useEffect(() => { consume(status); }, [consume, status]);
  useEffect(() => { if (!compact) return; const poll = async () => { const request = ++generation.current; try { const value = await api.pvpMatch(matchId); if (mounted.current && request === generation.current) consume(value, true); } catch {} }; const timer = setInterval(() => { void poll(); }, POLL_MS); return () => { clearInterval(timer); generation.current += 1; }; }, [compact, consume, matchId]);
  const toggleMute = () => { const next = !muted; setMuted(next); if (next) setBubble(null); void AsyncStorage.setItem(MUTE_KEY, next ? "1" : "0"); };
  const send = async (quipId: string) => {
    if (sending.current || cooling || (status.quip_counts[category] ?? 0) >= 3) return;
    sending.current = true;
    try { await api.sendPvpQuip(matchId, category, quipId, `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`); setCooling(true); cooldownTimer.current = setTimeout(() => setCooling(false), category === "IN_GAME" ? 5000 : 3000); const value = await api.pvpMatch(matchId); if (mounted.current) consume(value, true); }
    finally { sending.current = false; }
  };
  const options = Object.entries(status.approved_quips[category] ?? {});
  return <View pointerEvents="box-none" style={[styles.root, compact && styles.compact]}>
    {!suppressed && bubble ? <View style={styles.bubble}><Text numberOfLines={2} style={styles.bubbleText}>{bubble.text}</Text></View> : null}
    <View style={styles.toolbar}><FireButton title={open ? "CLOSE" : `QUIP ${status.quip_counts[category] ?? 0}/3`} size="compact" variant="secondary" onPress={() => setOpen((value) => !value)} /><FireButton title={muted ? "UNMUTE" : "MUTE"} size="compact" variant="ghost" onPress={toggleMute} /></View>
    {open ? <View style={styles.picker}>{options.map(([id, text]) => <FireButton key={id} disabled={cooling || (status.quip_counts[category] ?? 0) >= 3} title={text} size="compact" variant="secondary" onPress={() => { void send(id); }} />)}</View> : null}
  </View>;
}

export function PvpInGameQuickChat({ matchId, suppressed }: { matchId: string; suppressed: boolean }) {
  const [status, setStatus] = useState<PvpMatchStatus | null>(null); const mounted = useRef(true);
  useEffect(() => { mounted.current = true; void api.pvpMatch(matchId).then((value) => { if (mounted.current) setStatus(value); }).catch(() => {}); return () => { mounted.current = false; }; }, [matchId]);
  return status ? <PvpQuickChat compact matchId={matchId} category="IN_GAME" status={status} suppressed={suppressed} onStatus={setStatus} /> : null;
}

const styles = StyleSheet.create({ root: { gap: 6 }, compact: { position: "absolute", right: 10, top: 118, width: 190, zIndex: 70 }, bubble: { alignSelf: "flex-end", backgroundColor: "rgba(35,18,12,0.96)", borderColor: "#E59B43", borderRadius: 12, borderWidth: 1, maxWidth: 190, paddingHorizontal: 10, paddingVertical: 7 }, bubbleText: { color: "#FFF0D8", fontSize: 11, fontWeight: "900", textAlign: "center" }, toolbar: { flexDirection: "row", gap: 5, justifyContent: "flex-end" }, picker: { backgroundColor: "rgba(8,5,6,0.96)", borderColor: "#8D4C28", borderRadius: 12, borderWidth: 1, gap: 5, padding: 7 } });
