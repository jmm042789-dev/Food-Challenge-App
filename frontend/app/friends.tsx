import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "../src/api";
import FireButton from "../src/components/fire/FireButton";
import FirePanel from "../src/components/fire/FirePanel";
import ArcadeBackground from "../src/game/ui/ArcadeBackground";
import SocialPlayerCard from "../src/social/SocialPlayerCard";
import { createSearchCoordinator } from "../src/social/searchCoordinator";
import { retryPendingPublicIdentitySync, syncPublicIdentity } from "../src/social/publicIdentitySync";
import type { FriendLists, PublicPlayerProfile, PvpChallengeLists, PvpRecentOpponent } from "../src/social/types";
import { DEFAULT_IDENTITY } from "../src/profile/PlayerIdentity";
import { usePlayerIdentity } from "../src/profile/PlayerIdentityContext";
import FirstUseTip from "../src/onboarding/FirstUseTip";

type Tab = "friends" | "requests" | "challenges" | "search";
const EMPTY: FriendLists = { friends: [], incoming: [], outgoing: [] };
const EMPTY_CHALLENGES: PvpChallengeLists = { incoming: [], outgoing: [], history: [] };

export default function FriendsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("friends");
  const [lists, setLists] = useState(EMPTY);
  const [challenges, setChallenges] = useState(EMPTY_CHALLENGES);
  const [recent, setRecent] = useState<PvpRecentOpponent[]>([]);
  const [results, setResults] = useState<PublicPlayerProfile[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [me, setMe] = useState<PublicPlayerProfile | null>(null);
  const [handle, setHandle] = useState("");
  const [handleError, setHandleError] = useState("");
  const [handleAvailable, setHandleAvailable] = useState<boolean | null>(null);
  const { identity } = usePlayerIdentity();
  const coordinator = useMemo(() => createSearchCoordinator(), []);
  const availabilityCoordinator = useMemo(() => createSearchCoordinator(), []);
  const mounted = useRef(true);

  const load = useCallback(async (includeIdentitySync = false) => {
    setLoading(true); setError(false);
    try { if (includeIdentitySync && identity) await syncPublicIdentity(identity); else if (includeIdentitySync) void retryPendingPublicIdentitySync(); const [value, own, pvp, recentValue] = await Promise.all([api.friends(), api.getPublicProfile(), api.pvpChallenges(), api.recentPvpOpponents()]); if (mounted.current) { setLists(value); setChallenges(pvp); setRecent(recentValue.opponents); setMe(own); setHandle(own.handle); } }
    catch { if (mounted.current) setError(true); }
    finally { if (mounted.current) setLoading(false); }
  }, [identity]);
  useEffect(() => { mounted.current = true; void load(true); return () => { mounted.current = false; coordinator.cancel(); availabilityCoordinator.cancel(); }; }, [availabilityCoordinator, coordinator, load]);
  useEffect(() => {
    const normalized = query.trim().toLowerCase();
    if (normalized.length < 3) { coordinator.cancel(); setResults([]); return; }
    coordinator.schedule(normalized, async (value) => (await api.searchPlayers(value)).players, (value) => { setResults(value); setError(false); }, () => setError(true));
  }, [coordinator, query]);
  useEffect(() => {
    const normalized = handle.trim().toLowerCase();
    if (!/^[a-z][a-z0-9_]{2,19}$/.test(normalized)) { availabilityCoordinator.cancel(); setHandleAvailable(null); return; }
    availabilityCoordinator.schedule(normalized, api.publicHandleAvailability, (value) => { setHandleAvailable(value.available); setHandleError(value.available ? "" : "That handle is already taken."); }, () => { setHandleAvailable(null); });
  }, [availabilityCoordinator, handle]);

  const act = async (player: PublicPlayerProfile, action: "send" | "accept" | "decline" | "cancel" | "remove") => {
    if (busyId) return;
    setBusyId(player.public_id);
    try {
      if (action === "send") await api.sendFriendRequest(player.public_id);
      else if (action === "accept") await api.acceptFriendRequest(player.public_id);
      else if (action === "decline") await api.declineFriendRequest(player.public_id);
      else if (action === "cancel") await api.cancelFriendRequest(player.public_id);
      else await api.removeFriend(player.public_id);
      await load();
      if (tab === "search" && query.trim().length >= 3) {
        const refreshed = await api.searchPlayers(query.trim().toLowerCase());
        if (mounted.current) setResults(refreshed.players);
      }
    } catch { setError(true); }
    finally { if (mounted.current) setBusyId(null); }
  };
  const actChallenge = async (challengeId: string, action: "accept" | "decline" | "cancel") => {
    if (busyId) return;
    setBusyId(challengeId);
    try {
      if (action === "accept") { const match = await api.acceptPvpChallenge(challengeId); router.push(`/pvp/match/${encodeURIComponent(match.match_id)}` as never); }
      else if (action === "decline") await api.declinePvpChallenge(challengeId);
      else await api.cancelPvpChallenge(challengeId);
      await load();
    } catch { setError(true); }
    finally { if (mounted.current) setBusyId(null); }
  };
  const actionFor = (player: PublicPlayerProfile) => player.friendship_state === "INCOMING" ? "accept" : player.friendship_state === "OUTGOING" ? "cancel" : player.friendship_state === "FRIENDS" ? "remove" : "send";
  const saveHandle = async () => {
    const normalized = handle.trim().toLowerCase();
    if (!/^[a-z][a-z0-9_]{2,19}$/.test(normalized)) { setHandleError("Use 3–20 lowercase letters, numbers, or underscores; start with a letter."); return; }
    if (handleAvailable !== true) { setHandleError("Confirm that this handle is available first."); return; }
    if (busyId) return;
    setBusyId("self"); setHandleError("");
    try { const own = await api.updatePublicProfile({ handle: normalized, display_name: identity?.gamerName ?? DEFAULT_IDENTITY.gamerName, avatar: identity?.avatar ?? DEFAULT_IDENTITY.avatar }); setMe(own); setHandle(own.handle); }
    catch { setHandleError("That handle is unavailable or could not be saved."); }
    finally { if (mounted.current) setBusyId(null); }
  };

  return <SafeAreaView style={styles.screen}><ArcadeBackground /><View style={styles.header}><FireButton title="BACK" size="compact" variant="ghost" onPress={() => router.back()} /><Text accessibilityRole="header" style={styles.title}>SOCIAL ARENA</Text></View>
    <FirstUseTip tipKey="pvp" title="FRIENDS & PvP">Search public handles, add friends, then send a challenge. Each player gets one server-validated attempt. In-game Quick Chat uses presets only and allows three quips per player.</FirstUseTip>
    <View style={styles.tabs}>{(["friends", "requests", "challenges", "search"] as Tab[]).map((item) => <FireButton key={item} title={item.toUpperCase()} size="compact" variant={tab === item ? "gold" : "secondary"} style={styles.tab} onPress={() => setTab(item)} />)}</View>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {tab === "search" && me ? <FirePanel title="YOUR PUBLIC HANDLE" subtitle="This is how other players find you"><Text style={styles.currentHandle}>CURRENT · @{me.handle}</Text><TextInput accessibilityLabel="Public handle" autoCapitalize="none" autoCorrect={false} maxLength={20} placeholder="choose_a_handle" placeholderTextColor="#78665C" style={styles.input} value={handle} onChangeText={setHandle} />{handleAvailable === true ? <Text style={styles.available}>HANDLE AVAILABLE</Text> : null}{handleError ? <Text accessibilityRole="alert" style={styles.error}>{handleError}</Text> : null}<FireButton disabled={busyId !== null || handleAvailable !== true} loading={busyId === "self"} title="SAVE HANDLE" size="compact" variant="gold" onPress={() => { void saveHandle(); }} /></FirePanel> : null}
      {tab === "search" ? <FirePanel title="FIND PLAYERS" subtitle="Search by public handle · minimum 3 characters"><TextInput accessibilityLabel="Search player handles" autoCapitalize="none" autoCorrect={false} maxLength={20} placeholder="hungryhero247" placeholderTextColor="#78665C" style={styles.input} value={query} onChangeText={setQuery} /></FirePanel> : null}
      {loading ? <Text style={styles.state}>LOADING SOCIAL ARENA…</Text> : null}
      {error ? <FirePanel><Text accessibilityRole="alert" style={styles.error}>Social features are temporarily unavailable.</Text><FireButton title="RETRY" variant="gold" onPress={() => { void load(true); }} /></FirePanel> : null}
      {!loading && !error && tab === "friends" && !lists.friends.length ? <Text style={styles.state}>NO FRIENDS YET · SEARCH FOR A HANDLE</Text> : null}
      {tab === "friends" ? <>{lists.friends.map((player) => <SocialPlayerCard key={player.public_id} player={player} busy={busyId === player.public_id} onChallenge={() => router.push(`/pvp/challenge/${encodeURIComponent(player.public_id)}` as never)} onPrimary={() => { void act(player, "remove"); }} />)}<Text style={styles.section}>RECENT OPPONENTS</Text>{recent.map((item) => <FirePanel key={item.player.public_id} title={item.player.display_name} subtitle={`@${item.player.handle} · LAST: ${item.last_result}`}><Text style={styles.rivalry}>{item.rivalry.wins} W · {item.rivalry.losses} L · {item.rivalry.draws} D</Text><View style={styles.challengeActions}><FireButton title="VIEW PROFILE" size="compact" variant="secondary" onPress={() => router.push(`/player/${encodeURIComponent(item.player.public_id)}` as never)} />{item.player.friendship_state === "FRIENDS" ? <FireButton title="CHALLENGE" size="compact" variant="gold" onPress={() => router.push(`/pvp/challenge/${encodeURIComponent(item.player.public_id)}` as never)} /> : <FireButton title="ADD FRIEND" size="compact" variant="gold" onPress={() => { void act(item.player, "send"); }} />}</View></FirePanel>)}</> : null}
      {tab === "challenges" ? <><Text style={styles.section}>INCOMING CHALLENGES</Text>{challenges.incoming.map((challenge) => <FirePanel key={challenge.challenge_id} title={challenge.player?.display_name ?? "Friend"} subtitle={`@${challenge.player?.handle ?? "player"} · ${challenge.rematch_of ? "REMATCH · " : ""}${challenge.contest.name}`}><View style={styles.challengeActions}><FireButton disabled={busyId !== null} title="ACCEPT" size="compact" variant="gold" onPress={() => { void actChallenge(challenge.challenge_id, "accept"); }} /><FireButton disabled={busyId !== null} title="DECLINE" size="compact" variant="secondary" onPress={() => { void actChallenge(challenge.challenge_id, "decline"); }} /></View></FirePanel>)}{!challenges.incoming.length ? <Text style={styles.state}>NO INCOMING CHALLENGES</Text> : null}<Text style={styles.section}>OUTGOING CHALLENGES</Text>{challenges.outgoing.map((challenge) => <FirePanel key={challenge.challenge_id} title={challenge.player?.display_name ?? "Friend"} subtitle={`${challenge.rematch_of ? "REMATCH · " : ""}${challenge.contest.name} · PENDING`}><FireButton disabled={busyId !== null} title="CANCEL" size="compact" variant="secondary" onPress={() => { void actChallenge(challenge.challenge_id, "cancel"); }} /></FirePanel>)}{!challenges.outgoing.length ? <Text style={styles.state}>NO OUTGOING CHALLENGES</Text> : null}</> : null}
      {tab === "requests" ? <><Text style={styles.section}>INCOMING</Text>{lists.incoming.length ? lists.incoming.map((player) => <SocialPlayerCard key={player.public_id} player={player} busy={busyId === player.public_id} onPrimary={() => { void act(player, "accept"); }} onSecondary={() => { void act(player, "decline"); }} />) : <Text style={styles.state}>NO INCOMING REQUESTS</Text>}<Text style={styles.section}>OUTGOING</Text>{lists.outgoing.length ? lists.outgoing.map((player) => <SocialPlayerCard key={player.public_id} player={player} busy={busyId === player.public_id} onPrimary={() => { void act(player, "cancel"); }} />) : <Text style={styles.state}>NO OUTGOING REQUESTS</Text>}</> : null}
      {tab === "search" && query.trim().length < 3 ? <Text style={styles.state}>ENTER AT LEAST 3 CHARACTERS</Text> : null}
      {tab === "search" && query.trim().length >= 3 && !results.length && !error ? <Text style={styles.state}>NO PLAYERS FOUND</Text> : null}
      {tab === "search" ? results.map((player) => <SocialPlayerCard key={player.public_id} player={player} busy={busyId === player.public_id} onPrimary={() => { void act(player, actionFor(player)); }} onSecondary={player.friendship_state === "INCOMING" ? () => { void act(player, "decline"); } : undefined} />) : null}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({ screen: { backgroundColor: "#070405", flex: 1 }, header: { alignItems: "center", flexDirection: "row", paddingHorizontal: 14 }, title: { color: "#FFD06A", flex: 1, fontSize: 23, fontWeight: "900", letterSpacing: 1, marginLeft: 12 }, tabs: { flexDirection: "row", flexWrap: "wrap", gap: 6, padding: 12 }, tab: { flexBasis: "47%", flexGrow: 1 }, content: { alignSelf: "center", gap: 9, maxWidth: 720, paddingBottom: 34, paddingHorizontal: 14, width: "100%" }, input: { backgroundColor: "rgba(8,6,7,0.9)", borderColor: "#B9692D", borderRadius: 10, borderWidth: 1, color: "#FFF0D8", fontSize: 16, minHeight: 50, paddingHorizontal: 13 }, currentHandle: { color: "#DDA24F", fontSize: 10, fontWeight: "900", marginBottom: 7 }, available: { color: "#70CB8C", fontSize: 9, fontWeight: "900", marginVertical: 6 }, state: { color: "#A9907A", fontSize: 10, fontWeight: "900", letterSpacing: .8, paddingVertical: 16, textAlign: "center" }, error: { color: "#E58A78", marginBottom: 10, textAlign: "center" }, section: { color: "#E8A64E", fontSize: 11, fontWeight: "900", letterSpacing: 1.2, marginTop: 6 }, rivalry: { color: "#FFD06A", fontSize: 10, fontWeight: "900", marginBottom: 7 }, challengeActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 } });
