import React from "react";
import { StyleSheet, Text, View } from "react-native";
import CharacterPortrait from "./CharacterPortrait";
import CinematicCount from "./CinematicCount";
import type { AvatarConfiguration } from "../../profile/PlayerIdentity";

type ResultBannerProps = {
  result: "victory" | "defeat" | "draw";
  playerScore: number;
  playerName: string;
  playerAvatar: AvatarConfiguration;
  opponentScore: number;
  opponentName?: string;
  opponentAvatar?: string;
  opponentPersonality?: string;
  bannerText?: string;
  scoresRevealed?: boolean;
  reducedMotion?: boolean;
};

export default function ResultBanner({ result, playerScore, playerName, playerAvatar, opponentScore, opponentName = "Opponent", opponentAvatar, opponentPersonality, bannerText, scoresRevealed = true, reducedMotion = false }: ResultBannerProps) {
  const isVictory = result === "victory";
  const isDraw = result === "draw";
  const trim = isVictory ? "#F2A43C" : isDraw ? "#B49B75" : "#B84A3D";
  return (
    <View style={styles.wrap}>
      <Text style={[styles.result, isVictory ? styles.victory : isDraw ? styles.draw : styles.defeat]}>{isVictory ? bannerText ?? "VICTORY!" : isDraw ? "DRAW" : "DEFEAT"}</Text>
      <Text style={styles.subtitle}>{isVictory ? "THE FEAST IS YOURS" : isDraw ? "EVENLY MATCHED" : "THE FEAST IS COMPLETE"}</Text>
      <Text style={styles.sectionLabel}>FINAL SCORE</Text>
      <View style={[styles.comparison, { borderColor: trim }]}>
        <View style={styles.topHighlight} pointerEvents="none" />
        <View style={styles.competitor}>
          <CharacterPortrait avatarConfiguration={playerAvatar} name={playerName} subtitle="You" side="player" size="compact" reaction={isDraw ? "idle" : isVictory ? "victory" : "defeat"} reactionKey={result} />
          {scoresRevealed ? <CinematicCount value={Math.floor(playerScore)} active immediate={reducedMotion} style={styles.score} /> : <Text style={styles.score}>—</Text>}
          <Text style={styles.scoreLabel}>FINAL SCORE</Text>
        </View>
        <View style={styles.vsColumn}>
          <View style={styles.rule} />
          <View style={styles.vsBadge}><Text style={styles.vs}>VS</Text></View>
          <View style={styles.rule} />
        </View>
        <View style={styles.competitor}>
          <CharacterPortrait fallback={opponentAvatar} name={opponentName} subtitle={opponentPersonality} side="opponent" size="compact" reaction={isDraw ? "idle" : isVictory ? "defeat" : "victory"} reactionKey={result} />
          {scoresRevealed ? <CinematicCount value={Math.floor(opponentScore)} active immediate={reducedMotion} style={styles.score} /> : <Text style={styles.score}>—</Text>}
          <Text style={styles.scoreLabel}>FINAL SCORE</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", width: "100%" },
  result: { fontSize: 38, fontWeight: "900", letterSpacing: 2.2, lineHeight: 42, marginTop: 5, textAlign: "center" },
  victory: { color: "#FFD06A", textShadowColor: "rgba(255,105,20,0.8)", textShadowRadius: 12 },
  defeat: { color: "#E06E5E", textShadowColor: "rgba(85,10,10,0.8)", textShadowRadius: 9 },
  draw: { color: "#D8C7A3", textShadowColor: "rgba(69,55,37,0.8)", textShadowRadius: 8 },
  subtitle: { color: "#E8CBA5", fontSize: 10, fontWeight: "900", letterSpacing: 1.2, textAlign: "center" },
  sectionLabel: { color: "#E7B565", fontSize: 9, fontWeight: "900", letterSpacing: 1.35, marginBottom: 5, marginTop: 10, textAlign: "center" },
  comparison: { alignItems: "stretch", backgroundColor: "rgba(12,8,9,0.98)", borderRadius: 14, borderWidth: 1, elevation: 6, flexDirection: "row", minHeight: 116, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.32, shadowRadius: 8, width: "100%" },
  topHighlight: { backgroundColor: "rgba(255,218,150,0.12)", height: 1, left: 10, position: "absolute", right: 10, top: 1 },
  competitor: { alignItems: "center", flex: 1, justifyContent: "center", paddingVertical: 7 },
  score: { color: "#FFF1D9", fontSize: 25, fontWeight: "900", lineHeight: 27, textShadowColor: "rgba(255,126,32,0.32)", textShadowRadius: 5 },
  scoreLabel: { color: "#A48A76", fontSize: 7, fontWeight: "900", letterSpacing: 0.9 },
  vsColumn: { alignItems: "center", justifyContent: "center", width: 48 },
  rule: { backgroundColor: "rgba(225,132,43,0.3)", flex: 1, width: 1 },
  vsBadge: { alignItems: "center", backgroundColor: "#35130E", borderColor: "#DF8B31", borderRadius: 18, borderWidth: 1, height: 36, justifyContent: "center", marginVertical: 4, width: 36 },
  vs: { color: "#FFD071", fontSize: 12, fontStyle: "italic", fontWeight: "900" },
});
