
import React from "react";
import { StyleSheet, View } from "react-native";
import FloatingScore from "./FloatingScore";
import ImpactEffect from "./ImpactEffect";

type Props = {
  showScore?: boolean;
  scoreText?: string;
  showCombo?: boolean;
  comboText?: string;
  combo?: number;
};

export default function EffectsLayer({
  showScore = false,
  scoreText = "+1",
  showCombo = false,
  comboText = "🔥 COMBO!",
  combo = 0,
}: Props) {
  const comboStrength = combo >= 30 ? 3 : combo >= 20 ? 2 : combo >= 10 ? 1 : 0;
  return (
    <View pointerEvents="none" style={styles.container}>
      <FloatingScore
        visible={showScore}
        value={scoreText}
      />

      <View style={styles.comboContainer}>
        <ImpactEffect trigger={showCombo ? combo : 0} variant="combo" size={150 + comboStrength * 28} />
        <ImpactEffect trigger={showCombo ? combo : 0} variant="warning" size={110 + comboStrength * 22} />
        <FloatingScore
          visible={showCombo}
          value={comboText}
          color="#FF6A00"
          size={42 + comboStrength * 5}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  comboContainer: {
    position: "absolute",
    top: "22%",
    alignItems: "center",
  },
});
