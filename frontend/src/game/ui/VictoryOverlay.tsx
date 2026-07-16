import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import FireButton from "../../components/fire/FireButton";
import FireScreenEntrance from "../../components/fire/FireScreenEntrance";
import ResultBanner from "./ResultBanner";
import RewardSummaryCard from "./RewardSummaryCard";
import TournamentBanner from "./TournamentBanner";

type VictoryOverlayProps = {
  result: "victory" | "defeat";
  playerScore: number;
  opponentScore: number;
  opponentName?: string;
  opponentAvatar?: string;
  opponentPersonality?: string;
  contestName?: string;
  location?: string;
  difficulty?: string;
  roundLabel?: string;
  restaurantName?: string;
  restaurantLogoUrl?: string;
  city?: string;
  state?: string;
  verified?: boolean;
  sponsored?: boolean;
  sponsorName?: string;
  sponsorLogoUrl?: string;
  sponsorMessage?: string;
  highestCombo: number;
  foodName: string;
  matchTime: number;
  onReplay: () => void;
  onContinue: () => void;
  onBackToArena: () => void;
};

export default function VictoryOverlay({ result, playerScore, opponentScore, opponentName = "Opponent", opponentAvatar, opponentPersonality, contestName, location, difficulty, roundLabel, restaurantName, restaurantLogoUrl, city, state, verified, sponsored, sponsorName, sponsorLogoUrl, sponsorMessage, highestCombo, foodName, matchTime, onReplay, onContinue, onBackToArena }: VictoryOverlayProps) {
  const insets = useSafeAreaInsets();
  const isVictory = result === "victory";

  return (
    <View style={[styles.overlay, isVictory ? styles.victoryOverlay : styles.defeatOverlay]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingTop: Math.max(insets.top, 10), paddingBottom: Math.max(insets.bottom, 10) }]}>
        <FireScreenEntrance style={styles.content} distance={8} scaleFrom={0.97} duration="fast">
          <TournamentBanner eventTitle="FIRE FEAST WORLD TOUR" contestName={contestName} location={location} food={foodName} difficulty={difficulty} roundLabel={roundLabel} variant="compact" restaurantName={restaurantName} restaurantLogoUrl={restaurantLogoUrl} city={city} state={state} verified={verified} sponsored={sponsored} sponsorName={sponsorName} sponsorLogoUrl={sponsorLogoUrl} sponsorMessage={sponsorMessage} showPartnerDetails />
          <ResultBanner result={result} playerScore={playerScore} opponentScore={opponentScore} opponentName={opponentName} opponentAvatar={opponentAvatar} opponentPersonality={opponentPersonality} />
          <RewardSummaryCard result={result} coins={isVictory ? 50 : 0} xp={isVictory ? 120 : 0} highestCombo={highestCombo} foodName={foodName} matchTime={matchTime} />
          <View style={styles.actions}>
            <FireButton title="CONTINUE" size="medium" variant={isVictory ? "gold" : "primary"} fullWidth style={styles.continueButton} onPress={onContinue} />
            <View style={styles.secondaryActions}>
              <FireButton title="REPLAY" size="compact" variant="secondary" style={styles.secondaryButton} onPress={onReplay} />
              <FireButton title="BACK TO ARENA" size="compact" variant="ghost" style={styles.secondaryButton} onPress={onBackToArena} />
            </View>
          </View>
        </FireScreenEntrance>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 2000 },
  victoryOverlay: { backgroundColor: "rgba(7,5,6,0.94)" },
  defeatOverlay: { backgroundColor: "rgba(36,7,9,0.95)" },
  scrollContent: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 15 },
  content: { alignItems: "center", alignSelf: "center", maxWidth: 420, width: "100%" },
  actions: { marginTop: 3, width: "100%" },
  continueButton: { marginBottom: 2, marginTop: 7 },
  secondaryActions: { flexDirection: "row", gap: 8, justifyContent: "center" },
  secondaryButton: { flex: 1, marginBottom: 0, marginTop: 0 },
});
