import React from "react";
import { Animated, StyleSheet } from "react-native";
import { useFadeIn } from "../../animations";
import FireHUDFrame from "./FireHUDFrame";
import FireProgressBar from "./FireProgressBar";

type FireXPBarProps = { level?: number; xp?: number; nextLevelXp?: number };

export default function FireXPBar({ level = 1, xp = 0, nextLevelXp = 100 }: FireXPBarProps) {
  const { opacity } = useFadeIn({ duration: 500, delay: 140 });
  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <FireHUDFrame label={`LEVEL ${level}`} value={`${xp} / ${nextLevelXp} XP`}>
        <FireProgressBar value={xp} max={nextLevelXp} variant="xp" />
      </FireHUDFrame>
    </Animated.View>
  );
}

const styles = StyleSheet.create({ container: { width: "100%" } });
