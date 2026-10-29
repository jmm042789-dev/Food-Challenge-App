
import React from "react";
import { StyleSheet, View } from "react-native";
import FloatingScore from "./FloatingScore";

type Props = {
  showScore?: boolean;
  scoreText?: string;
  showCombo?: boolean;
  comboText?: string;
  combo?: number;
  suppressed?: boolean;
};

export default function EffectsLayer({
  showScore = false,
  scoreText = "+1",
  showCombo = false,
  comboText = "🔥 COMBO!",
  combo = 0,
  suppressed = false,
}: Props) {
  if (suppressed || !showScore) return null;
  return (
    <View pointerEvents="none" style={styles.container}>
      <View style={styles.feedbackRow}>
        <FloatingScore
          visible
          value={scoreText}
        />
        {showCombo ? <FloatingScore visible value={comboText} color="#FF8A2A" size={Math.min(25, 21 + Math.floor(combo / 10))} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    paddingTop: "28%",
    zIndex: 95,
  },
  feedbackRow: {
    alignItems: "center",
    backgroundColor: "rgba(19,9,8,0.72)",
    borderColor: "rgba(255,150,48,0.62)",
    borderRadius: 9,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: 12,
  },
});
