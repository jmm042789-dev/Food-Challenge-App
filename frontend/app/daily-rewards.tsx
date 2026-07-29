import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import ArcadeBackground from "../src/game/ui/ArcadeBackground";
import FireButton from "../src/components/fire/FireButton";
import FirePanel from "../src/components/fire/FirePanel";
import RetentionNotification from "../src/components/fire/RetentionNotification";
import { claimDailyReward, DAILY_REWARDS, loadDailyRewards, type DailyRewardState } from "../src/retention/DailyRewards";

export default function DailyRewardsScreen() {
  const router = useRouter();
  const [state, setState] = useState<DailyRewardState | null>(null);
  const [currentDay, setCurrentDay] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    const loaded = await loadDailyRewards();
    setState(loaded.state); setCurrentDay(loaded.currentDay);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const claim = useCallback(async () => {
    const result = await claimDailyReward();
    setState(result.state); setCurrentDay(result.currentDay);
    if (result.claimed) setNotice(DAILY_REWARDS[result.currentDay - 1].label);
  }, []);

  const alreadyClaimed = state?.claimedDays.includes(currentDay) ?? false;
  return <SafeAreaView style={styles.screen}><ArcadeBackground />
    {notice ? <RetentionNotification kind="daily" title={notice} detail="Saved to this beta reward cycle" onDismiss={() => setNotice(null)} /> : null}
    <View style={styles.header}><FireButton title="BACK" size="compact" variant="ghost" onPress={() => router.back()} /><View><Text accessibilityRole="header" style={styles.title}>DAILY REWARDS</Text><Text style={styles.subtitle}>SEVEN DAYS OF FIRE</Text></View></View>
    <ScrollView contentContainerStyle={styles.content}>
      <FirePanel title={`DAY ${currentDay} OF 7`} subtitle="Return each day to reveal the next reward." elevated>
        <View style={styles.calendar}>{DAILY_REWARDS.map((reward) => {
          const claimed = state?.claimedDays.includes(reward.day) ?? false;
          const active = reward.day === currentDay;
          const locked = reward.day > currentDay;
          return <View accessibilityLabel={`Day ${reward.day}, ${reward.label}, ${claimed ? "claimed" : active ? "available" : "locked"}`} key={reward.day} style={[styles.day, active && styles.activeDay, claimed && styles.claimedDay, locked && styles.lockedDay]}>
            <Text style={styles.dayLabel}>DAY {reward.day}</Text><Text style={styles.icon}>{claimed ? "✓" : locked ? "🔒" : reward.icon}</Text><Text style={styles.reward}>{reward.label}</Text><Text style={[styles.status, claimed && styles.claimed]}>{claimed ? "CLAIMED" : active ? "READY" : "LOCKED"}</Text>
          </View>;
        })}</View>
        <FireButton disabled={!state || alreadyClaimed} fullWidth title={alreadyClaimed ? "TODAY'S REWARD CLAIMED" : "CLAIM DAILY REWARD"} variant="gold" onPress={() => { void claim(); }} />
        <Text style={styles.betaNote}>Beta rewards are stored locally and do not alter your server coin or XP balance.</Text>
      </FirePanel>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#070405", flex: 1 }, header: { alignItems: "center", flexDirection: "row", gap: 12, paddingHorizontal: 14, paddingTop: 4 },
  title: { color: "#FFD06A", fontSize: 25, fontWeight: "900", letterSpacing: 1 }, subtitle: { color: "#B88D61", fontSize: 9, fontWeight: "900", letterSpacing: 1.1 },
  content: { padding: 14 }, calendar: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  day: { alignItems: "center", backgroundColor: "rgba(34,20,17,0.94)", borderColor: "rgba(207,125,46,0.44)", borderRadius: 11, borderWidth: 1, minHeight: 112, padding: 8, width: "30.5%" },
  activeDay: { backgroundColor: "rgba(91,39,12,0.97)", borderColor: "#FFD06A", borderWidth: 2, elevation: 6 }, claimedDay: { borderColor: "#6FC98D" }, lockedDay: { opacity: 0.5 },
  dayLabel: { color: "#D19A58", fontSize: 8, fontWeight: "900" }, icon: { color: "#FFD06A", fontSize: 24, fontWeight: "900", marginVertical: 8 }, reward: { color: "#FFF0D8", fontSize: 9, fontWeight: "900", textAlign: "center" },
  status: { color: "#CF9D5E", fontSize: 7, fontWeight: "900", marginTop: 5 }, claimed: { color: "#76D092" }, betaNote: { color: "#9F8979", fontSize: 10, lineHeight: 15, textAlign: "center" },
});
