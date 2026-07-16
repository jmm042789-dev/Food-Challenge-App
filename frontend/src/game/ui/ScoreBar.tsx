import React from "react";
import { StyleSheet } from "react-native";
import FireHUDFrame from "../../components/fire/FireHUDFrame";
import FireProgressBar from "../../components/fire/FireProgressBar";

type Props = { label: string; score: number; color?: string; maxScore?: number };

export default function ScoreBar({ label, score, maxScore = 250 }: Props) {
  return (
    <FireHUDFrame compact label={label} value={Math.floor(score)} style={styles.container}>
      <FireProgressBar value={score} max={maxScore} variant="combo" compact />
    </FireHUDFrame>
  );
}

const styles = StyleSheet.create({ container: { marginBottom: 10, width: "100%" } });
