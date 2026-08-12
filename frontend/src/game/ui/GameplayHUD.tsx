import React from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";

import MatchHUD from "./MatchHUD";
import type { OpponentMood } from "../ai/OpponentMood";
import { useReducedMotionPreference } from "../../components/fire/FireProgressBar";
import { resolveMatchHudLayout } from "./gameplayLayout";

type Props = {
  level: number;
  xp: number;
  nextLevelXp: number;
  coins: number;
  timeRemaining: number;
  playerScore: number;
  opponentScore: number;
  combo: number;
  opponentName?: string;
  opponentAvatar?: string;
  opponentPersonality?: string;
  opponentMood: OpponentMood;
  contestName?: string;
  location?: string;
  difficulty?: string;
  roundLabel?: string;
};

export default function GameplayHUD(props: Props) {
  const reducedMotion = useReducedMotionPreference();
  const { width } = useWindowDimensions();
  const layout = resolveMatchHudLayout(width);

  return (
    <View style={[styles.container, { paddingHorizontal: layout.horizontalPadding }]}>
      <MatchHUD
        timeRemaining={props.timeRemaining}
        playerScore={props.playerScore}
        opponentScore={props.opponentScore}
        opponentName={props.opponentName}
        opponentAvatar={props.opponentAvatar}
        opponentPersonality={props.opponentPersonality}
        opponentMood={props.opponentMood}
        combo={props.combo}
        contestName={props.contestName}
        location={props.location}
        difficulty={props.difficulty}
        roundLabel={props.roundLabel}
        reducedMotion={reducedMotion}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 6, width: "100%", zIndex: 20 },
});
